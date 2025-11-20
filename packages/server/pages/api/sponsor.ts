import { PublicKey, sendAndConfirmRawTransaction, Transaction, VersionedTransaction } from '@solana/web3.js';
import type { NextApiRequest, NextApiResponse } from 'next';
import base58 from 'bs58';
import { core } from '@solana/octane-core';
import {
    cache,
    connection,
    ENV_SECRET_KEYPAIR,
    cors,
    rateLimit,
    isReturnedSignatureAllowed,
    ReturnSignatureConfigField,
} from '../../src';
import config from '../../../../config.json';

const { sha256, validateTransaction, validateInstructions, simulateRawTransaction } = core;

// Endpoint to sponsor transactions - completely free for users, Octane pays all fees
// Supports both legacy and v0 transactions
export default async function (request: NextApiRequest, response: NextApiResponse) {
    await cors(request, response);
    await rateLimit(request, response);

    // Deserialize a base58 wire-encoded transaction from the request
    const serialized = request.body?.transaction;
    if (typeof serialized !== 'string') {
        response.status(400).send({ status: 'error', message: 'request should contain transaction' });
        return;
    }

    const buffer = base58.decode(serialized);
    let versionedTransaction: VersionedTransaction;
    
    try {
        // VersionedTransaction.deserialize() handles both legacy and v0 transactions
        versionedTransaction = VersionedTransaction.deserialize(buffer);
    } catch (e) {
        const message = e instanceof Error ? e.message : "can't decode transaction";
        response.status(400).send({ status: 'error', message });
        return;
    }

    try {
        // Prevent simple duplicate transactions using a hash of the message
        const messageBytes = versionedTransaction.message.serialize();
        const key = `transaction/${base58.encode(sha256(messageBytes))}`;
        if (await cache.get(key)) {
            throw new Error('duplicate transaction');
        }
        await cache.set(key, true);

        // Basic validation
        if (versionedTransaction.version === 'legacy') {
            // For legacy transactions, use existing validation
            const legacyTx = Transaction.from(buffer);
            
            // Check fee payer
            if (!legacyTx.feePayer?.equals(ENV_SECRET_KEYPAIR.publicKey)) {
                throw new Error('invalid fee payer');
            }
            
            // Check blockhash
            if (!legacyTx.recentBlockhash) {
                throw new Error('missing recent blockhash');
            }
            
            // Validate blockhash with RPC (using modern API)
            const isValid = await connection.isBlockhashValid(legacyTx.recentBlockhash);
            if (!isValid.value) {
                throw new Error('blockhash not found or expired');
            }
            
            // Check signatures
            if (!legacyTx.signatures.length) {
                throw new Error('no signatures');
            }
            if (legacyTx.signatures.length > config.maxSignatures) {
                throw new Error('too many signatures');
            }
            
            const [primary, ...secondary] = legacyTx.signatures;
            if (!primary.publicKey.equals(ENV_SECRET_KEYPAIR.publicKey)) {
                throw new Error('invalid fee payer pubkey');
            }
            if (primary.signature) {
                throw new Error('invalid fee payer signature');
            }
            
            // Check if transaction is completely unsigned (OKX) or partially signed (Jupiter/LiFi)
            const allUnsigned = secondary.every(sig => !sig.signature || 
                Array.from(sig.signature).every(byte => byte === 0));
            
            if (!allUnsigned) {
                // Partially signed - validate user signatures are present
                for (const sig of secondary) {
                    if (!sig.publicKey) throw new Error('missing public key');
                    if (!sig.signature) throw new Error('missing signature');
                }
            }
            
            // Validate instructions
            await validateInstructions(legacyTx, ENV_SECRET_KEYPAIR);
            
            // Sign the transaction
            legacyTx.partialSign(ENV_SECRET_KEYPAIR);
            const rawTransaction = Buffer.from(legacyTx.serialize());
            
            // Simulate
            await simulateRawTransaction(connection, rawTransaction);
            
            const signature = base58.encode(legacyTx.signature!);
            
            if (config.returnSignature !== undefined && config.returnSignature !== null) {
                if (!await isReturnedSignatureAllowed(
                    request,
                    config.returnSignature as ReturnSignatureConfigField
                )) {
                    response.status(400).send({ status: 'error', message: 'anti-spam check failed' });
                    return;
                }
                response.status(200).send({ status: 'ok', signature });
                return;
            }
            
            await sendAndConfirmRawTransaction(
                connection,
                rawTransaction,
                {commitment: 'confirmed'}
            );
            
            response.status(200).send({ status: 'ok', signature });
            
        } else {
            // Handle v0 transactions
            const message = versionedTransaction.message;
            
            // Check fee payer
            const feePayer = message.staticAccountKeys[0];
            if (!feePayer.equals(ENV_SECRET_KEYPAIR.publicKey)) {
                throw new Error('invalid fee payer');
            }
            
            // Check blockhash
            const recentBlockhash = message.recentBlockhash;
            if (!recentBlockhash) {
                throw new Error('missing recent blockhash');
            }
            
            // Validate blockhash with RPC (using modern API)
            const isValid = await connection.isBlockhashValid(recentBlockhash);
            if (!isValid.value) {
                throw new Error('blockhash not found or expired');
            }
            
            // Check signatures
            const numRequiredSignatures = message.header.numRequiredSignatures;
            if (numRequiredSignatures > config.maxSignatures) {
                throw new Error('too many signatures');
            }
            if (versionedTransaction.signatures.length !== numRequiredSignatures) {
                throw new Error('signature count mismatch');
            }
            
            // Check fee payer signature - allow both null (unsigned) and non-null (OKX might pre-sign)
            const firstSig = versionedTransaction.signatures[0];
            const isNullSignature = firstSig.every((byte: number) => byte === 0);
            
            // For single-signer transactions (OKX with no user signatures)
            if (numRequiredSignatures === 1) {
                // OKX style - only fee payer, no user signatures
                // Fee payer signature can be null or present, Octane will sign/re-sign
            } else {
                // Multi-signature transaction
                if (!isNullSignature) {
                    throw new Error('invalid fee payer signature');
                }
                
                // Check user signatures
                const allUnsigned = versionedTransaction.signatures.slice(1).every(
                    sig => sig.every((byte: number) => byte === 0)
                );
                
                if (!allUnsigned) {
                    // Partially signed - validate user signatures are present
                    for (let i = 1; i < versionedTransaction.signatures.length; i++) {
                        const sig = versionedTransaction.signatures[i];
                        const isNull = sig.every((byte: number) => byte === 0);
                        if (isNull) {
                            throw new Error('missing required signature');
                        }
                    }
                }
            }
            
            // Sign the v0 transaction
            versionedTransaction.sign([ENV_SECRET_KEYPAIR]);
            const rawTransaction = Buffer.from(versionedTransaction.serialize());
            
            // Simulate the transaction
            const simulation = await connection.simulateTransaction(versionedTransaction);
            
            if (simulation.value.err) {
                throw new Error(`simulation failed: ${JSON.stringify(simulation.value.err)}`);
            }
            
            const signature = base58.encode(versionedTransaction.signatures[0]);
            
            if (config.returnSignature !== undefined && config.returnSignature !== null) {
                if (!await isReturnedSignatureAllowed(
                    request,
                    config.returnSignature as ReturnSignatureConfigField
                )) {
                    response.status(400).send({ status: 'error', message: 'anti-spam check failed' });
                    return;
                }
                response.status(200).send({ status: 'ok', signature });
                return;
            }
            
            await sendAndConfirmRawTransaction(
                connection,
                rawTransaction,
                {commitment: 'confirmed'}
            );
            
            response.status(200).send({ status: 'ok', signature });
        }
    } catch (error) {
        let message = '';
        if (error instanceof Error) {
            message = error.message;
        }
        response.status(400).send({ status: 'error', message });
    }
}

