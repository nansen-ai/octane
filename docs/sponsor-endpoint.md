# Sponsor Endpoint Documentation

## Overview

The `/api/sponsor` endpoint allows Octane to **fully sponsor user transactions** on Solana. Users can submit transactions without paying any SOL fees - Octane covers all transaction costs as the fee payer.

## Key Features

✅ **Full V0 Transaction Support** - Works with modern versioned transactions  
✅ **Legacy Transaction Support** - Backward compatible with traditional transactions  
✅ **Multi-Provider Compatible** - Supports OKX, Jupiter, LiFi, and other aggregators  
✅ **Flexible Signing** - Handles both unsigned and partially-signed transactions  
✅ **Built-in Security** - Rate limiting, duplicate detection, and transaction simulation  

## API Reference

### Endpoint

```
POST /api/sponsor
```

### Request Body

```json
{
  "transaction": "base58-encoded-serialized-transaction"
}
```

### Response

**Success (200):**
```json
{
  "status": "ok",
  "signature": "transaction-signature-here"
}
```

**Error (400):**
```json
{
  "status": "error",
  "message": "error-description"
}
```

## How It Works

### Transaction Flow

```
1. Client builds transaction with OCTANE as fee payer
2. Client signs with their wallet (if needed)
3. Client sends to /api/sponsor
4. Octane validates transaction
5. Octane signs as fee payer
6. Octane simulates transaction
7. Octane submits to Solana
8. Octane waits for confirmation
9. Returns confirmed signature
```

### Supported Transaction Types

#### 1. OKX Style (Single Signer - Unsigned)
- **Signatures Required:** 1 (only fee payer)
- **User Signatures:** None
- **Use Case:** OKX DEX aggregator
- **Example:** Token swaps where Octane is the only signer

#### 2. OKX/Unsigned Multi-Sig
- **Signatures Required:** Multiple
- **User Signatures:** All null/empty
- **Use Case:** Complex transactions with no user signing
- **Example:** Automated operations

#### 3. Jupiter/LiFi Style (Partially Signed)
- **Signatures Required:** Multiple
- **User Signatures:** Present (signed)
- **Use Case:** Jupiter, LiFi, other DEX aggregators
- **Example:** User authorizes specific actions, Octane pays fees

## Usage Examples

### Example 1: OKX Single-Signer Transaction

```javascript
import { 
    Connection, 
    VersionedTransaction, 
    TransactionMessage,
    SystemProgram 
} from '@solana/web3.js';
import bs58 from 'bs58';

// Step 1: Get Octane's fee payer
const config = await fetch('http://localhost:3000/api/').then(r => r.json());
const octaneFeePayer = new PublicKey(config.feePayer);

// Step 2: Build transaction with Octane as ONLY signer
const connection = new Connection('https://api.mainnet-beta.solana.com');
const { blockhash } = await connection.getLatestBlockhash();

const messageV0 = new TransactionMessage({
    payerKey: octaneFeePayer,  // Octane is fee payer
    recentBlockhash: blockhash,
    instructions: [
        // Your swap/transfer instructions
        SystemProgram.transfer({
            fromPubkey: tokenAccount,
            toPubkey: destinationAccount,
            lamports: amount,
        })
    ],
}).compileToV0Message();

const transaction = new VersionedTransaction(messageV0);

// Step 3: DON'T sign - send unsigned to Octane
const response = await fetch('http://localhost:3000/api/sponsor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        transaction: bs58.encode(transaction.serialize())
    })
});

const result = await response.json();
console.log('Transaction confirmed:', result.signature);
```

### Example 2: Jupiter/LiFi Partially-Signed Transaction

```javascript
import { VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import bs58 from 'bs58';

// Step 1: Get Octane's fee payer
const config = await fetch('http://localhost:3000/api/').then(r => r.json());
const octaneFeePayer = new PublicKey(config.feePayer);

// Step 2: Build transaction with Octane as fee payer
const { blockhash } = await connection.getLatestBlockhash();

const messageV0 = new TransactionMessage({
    payerKey: octaneFeePayer,  // Octane pays fees
    recentBlockhash: blockhash,
    instructions: [
        // Swap instructions that require user authorization
    ],
}).compileToV0Message();

const transaction = new VersionedTransaction(messageV0);

// Step 3: User signs their part
transaction.sign([userWallet]);

// Step 4: Send to Octane (user signed, fee payer signature still null)
const response = await fetch('http://localhost:3000/api/sponsor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        transaction: bs58.encode(transaction.serialize())
    })
});

const result = await response.json();
console.log('Transaction confirmed:', result.signature);
```

### Example 3: Legacy Transaction

```javascript
import { Transaction, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';

// Get Octane's fee payer
const config = await fetch('http://localhost:3000/api/').then(r => r.json());
const octaneFeePayer = new PublicKey(config.feePayer);

// Build legacy transaction
const transaction = new Transaction();
transaction.feePayer = octaneFeePayer;  // Octane pays
transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

transaction.add(
    SystemProgram.transfer({
        fromPubkey: userWallet.publicKey,
        toPubkey: recipient,
        lamports: amount,
    })
);

// User signs
transaction.sign(userWallet);

// Send to Octane
const response = await fetch('http://localhost:3000/api/sponsor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        transaction: bs58.encode(transaction.serialize({ 
            requireAllSignatures: false 
        }))
    })
});

const result = await response.json();
console.log('Transaction confirmed:', result.signature);
```

## Configuration

### `config.json` Settings

```json
{
    "rpcUrl": "https://api.mainnet-beta.solana.com",
    "maxSignatures": 2,
    "lamportsPerSignature": 5000,
    "corsOrigin": true,
    "returnSignature": null
}
```

#### Key Settings

**`returnSignature`** - Controls transaction submission behavior:

| Value | Behavior | Use Case |
|-------|----------|----------|
| `null` | Octane submits transaction | **Full sponsor (recommended)** |
| `{ "type": "allowAll" }` | Returns signed transaction | Client-side submission |
| `{ "type": "reCaptcha", ... }` | Returns with spam protection | Client-side + security |

**`maxSignatures`** - Maximum allowed signatures (including fee payer)

**`lamportsPerSignature`** - Maximum fee per signature (spam prevention)

## Transaction Requirements

### ✅ Required

1. **Fee Payer = Octane's Public Key**
   - Get from `/api/` endpoint
   - Must match exactly

2. **Valid Recent Blockhash**
   - Must not be expired
   - Verified against RPC

3. **Correct Signature Structure**
   - Fee payer signature in position 0 (null/empty)
   - User signatures (if needed) properly signed

### ❌ Limitations

- Cannot create new accounts (use `/api/createAssociatedTokenAccount` for tokens)
- Maximum 2 signatures by default (configurable)
- Must pass simulation before submission

## Security Features

### Built-in Protections

1. **Duplicate Transaction Prevention**
   - Hashes transaction message
   - Caches to prevent replays
   - 5-second lockout window

2. **Transaction Simulation**
   - Pre-flight check before submission
   - Prevents failed transactions
   - Validates all accounts and instructions

3. **Rate Limiting**
   - Configurable per endpoint
   - Prevents abuse
   - IP-based throttling

4. **Fee Validation**
   - Checks fee payer matches Octane
   - Validates blockhash
   - Ensures reasonable fees

### Optional Enhancements

**reCAPTCHA Integration:**
```json
{
    "returnSignature": {
        "type": "reCaptcha",
        "reCaptchaProjectId": "your-project-id",
        "reCaptchaSiteKey": "your-site-key",
        "reCaptchaMinScore": 0.5
    }
}
```

## Troubleshooting

### Common Errors

#### `invalid fee payer`
**Cause:** Transaction fee payer doesn't match Octane's public key  
**Solution:** Set `payerKey: octaneFeePayer` when building transaction

#### `blockhash not found or expired`
**Cause:** Recent blockhash is too old  
**Solution:** Get fresh blockhash immediately before creating transaction

#### `simulation failed`
**Cause:** Transaction would fail on-chain  
**Solution:** Check accounts, balances, and instruction parameters

#### `duplicate transaction`
**Cause:** Same transaction submitted multiple times  
**Solution:** Wait 5 seconds or create new transaction with fresh blockhash

#### `missing required signature`
**Cause:** User signature missing in partially-signed transaction  
**Solution:** Ensure user wallet signs before sending to Octane

## Monitoring

### Check Octane Balance

```bash
# Check balance using Solana CLI
solana balance BHT95q86NWKocotLhj9dxumnFKgpX9zXncCtL2m8km4d

# Or using Node.js
node -e "
const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const key = require('./keys/octane.json');
const config = require('./config.json');
const kp = Keypair.fromSecretKey(Uint8Array.from(key));
const conn = new Connection(config.rpcUrl);
conn.getBalance(kp.publicKey).then(b => 
    console.log('Balance:', (b/LAMPORTS_PER_SOL).toFixed(9), 'SOL')
);
"
```

### Transaction Costs

- Average fee: ~0.000005 SOL per transaction
- With 1 SOL: ~200,000 sponsored transactions
- Monitor balance regularly for production use

## Best Practices

### 1. Always Get Fresh Config

```javascript
// Do this at the start of each transaction flow
const config = await fetch(`${OCTANE_URL}/api/`).then(r => r.json());
const octaneFeePayer = new PublicKey(config.feePayer);
```

### 2. Handle Errors Gracefully

```javascript
try {
    const response = await fetch(`${OCTANE_URL}/api/sponsor`, { ... });
    const result = await response.json();
    
    if (result.status === 'error') {
        console.error('Octane error:', result.message);
        // Show user-friendly error
    } else {
        console.log('Success:', result.signature);
        // Show confirmation with link to explorer
    }
} catch (error) {
    console.error('Network error:', error);
    // Handle network/timeout errors
}
```

### 3. Use Appropriate RPC

- **Development:** Use devnet with free RPC
- **Production:** Use paid RPC provider (Helius, QuickNode, Alchemy)
- **Avoid:** Public mainnet RPC (rate limited)

### 4. Monitor and Alert

- Set up balance alerts (< 0.1 SOL)
- Monitor transaction success rate
- Track RPC performance
- Log failed transactions for debugging

## Integration Examples

### React Integration

```typescript
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

function SponsoredSwapButton() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    
    const executeSponsoredSwap = async () => {
        // Get Octane config
        const config = await fetch('http://localhost:3000/api/')
            .then(r => r.json());
        const octaneFeePayer = new PublicKey(config.feePayer);
        
        // Build your swap transaction
        const { blockhash } = await connection.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
            payerKey: octaneFeePayer,  // Octane pays!
            recentBlockhash: blockhash,
            instructions: [/* your swap instructions */],
        }).compileToV0Message();
        
        const transaction = new VersionedTransaction(messageV0);
        
        // If user needs to sign
        if (requiresUserSignature) {
            await wallet.signTransaction(transaction);
        }
        
        // Submit to Octane
        const response = await fetch('http://localhost:3000/api/sponsor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transaction: bs58.encode(transaction.serialize())
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'ok') {
            console.log('Transaction confirmed:', result.signature);
            // Show success notification
        } else {
            console.error('Error:', result.message);
            // Show error notification
        }
    };
    
    return <button onClick={executeSponsoredSwap}>Swap (Free!)</button>;
}
```

### Node.js Backend Integration

```javascript
const express = require('express');
const { Connection, VersionedTransaction, TransactionMessage } = require('@solana/web3.js');
const bs58 = require('bs58');

const app = express();
const OCTANE_URL = process.env.OCTANE_URL || 'http://localhost:3000';

app.post('/execute-swap', async (req, res) => {
    try {
        // Get Octane config
        const config = await fetch(`${OCTANE_URL}/api/`).then(r => r.json());
        const octaneFeePayer = new PublicKey(config.feePayer);
        
        // Build transaction
        const connection = new Connection(config.rpcUrl);
        const { blockhash } = await connection.getLatestBlockhash();
        
        const messageV0 = new TransactionMessage({
            payerKey: octaneFeePayer,
            recentBlockhash: blockhash,
            instructions: req.body.instructions,
        }).compileToV0Message();
        
        const transaction = new VersionedTransaction(messageV0);
        
        // Submit to Octane
        const response = await fetch(`${OCTANE_URL}/api/sponsor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transaction: bs58.encode(transaction.serialize())
            })
        });
        
        const result = await response.json();
        res.json(result);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

## Provider-Specific Notes

### OKX
- Sends **unsigned** transactions
- Single signer (fee payer only)
- No user wallet interaction needed
- Octane signs everything

**Transaction Structure:**
```
numRequiredSignatures: 1
signatures[0]: null (fee payer - Octane will sign)
```

### Jupiter
- Sends **partially signed** transactions
- User signs swap approval
- Octane co-signs as fee payer
- Multi-signature transaction

**Transaction Structure:**
```
numRequiredSignatures: 2+
signatures[0]: null (fee payer - Octane will sign)
signatures[1+]: signed (user authorization)
```

### LiFi
- Similar to Jupiter
- User authorizes bridge/swap
- Octane provides gas sponsorship
- Supports complex cross-chain flows

**Transaction Structure:**
```
numRequiredSignatures: 2+
signatures[0]: null (fee payer - Octane will sign)
signatures[1+]: signed (user authorization)
```

## Configuration Reference

### config.json Options

```json
{
    "rpcUrl": "https://api.mainnet-beta.solana.com",
    "maxSignatures": 2,
    "lamportsPerSignature": 5000,
    "corsOrigin": true,
    "returnSignature": null
}
```

#### returnSignature Options

**Option 1: Full Sponsor (Recommended)**
```json
"returnSignature": null
```
- Octane submits transaction to Solana
- Returns confirmed signature
- True gasless experience

**Option 2: Sign-Only Mode**
```json
"returnSignature": {
    "type": "allowAll"
}
```
- Octane only signs, doesn't submit
- Returns signed transaction to client
- Client must submit themselves

**Option 3: Sign-Only with Anti-Spam**
```json
"returnSignature": {
    "type": "reCaptcha",
    "reCaptchaProjectId": "your-project-id",
    "reCaptchaSiteKey": "your-site-key",
    "reCaptchaMinScore": 0.5
}
```
- Requires reCAPTCHA token in request
- Octane signs but doesn't submit
- Spam protection enabled

## Security Considerations

### For Production Deployment

1. **Enable Rate Limiting**
   ```javascript
   // In config or environment
   RATE_LIMIT=100  // requests per interval
   RATE_LIMIT_INTERVAL=60000  // 1 minute
   ```

2. **Use Private RPC**
   - Don't use public RPCs in production
   - Get API key from Helius, QuickNode, or Alchemy
   - Better performance and reliability

3. **Monitor Balance**
   - Set up alerts for low balance (< 0.1 SOL)
   - Auto-refill mechanism recommended
   - Track spending patterns

4. **Consider reCAPTCHA**
   - Prevents bot abuse
   - Especially important for public endpoints
   - Free tier usually sufficient

5. **Whitelist Instructions (Optional)**
   - Restrict to specific program IDs
   - Add custom validation logic
   - Prevent unexpected behavior

## Monitoring and Maintenance

### Daily Checks

```bash
# Check balance
solana balance BHT95q86NWKocotLhj9dxumnFKgpX9zXncCtL2m8km4d --url mainnet-beta

# View recent transactions
solana transaction-history BHT95q86NWKocotLhj9dxumnFKgpX9zXncCtL2m8km4d --url mainnet-beta
```

### Metrics to Track

- Total sponsored transactions per day
- Average transaction cost
- Success rate (confirmed vs failed)
- Balance depletion rate
- RPC response times

### Alerting

Set up alerts for:
- Balance < 0.1 SOL
- Success rate < 95%
- RPC errors > 5%
- Unusual traffic spikes

## Advanced Topics

### Custom Validation

Fork and add custom validation logic:

```typescript
// In sponsor.ts
// Add after fee payer validation

// Example: Only allow specific programs
const allowedPrograms = [
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Whirlpools
];

for (const instruction of transaction.instructions) {
    if (!allowedPrograms.includes(instruction.programId.toBase58())) {
        throw new Error('program not allowed');
    }
}
```

### Priority Fees

Add compute budget for faster confirmation:

```javascript
import { ComputeBudgetProgram } from '@solana/web3.js';

const instructions = [
    ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000  // Priority fee
    }),
    // ... your other instructions
];
```

### Transaction Versioning

The endpoint automatically detects and handles:

```javascript
// Legacy format
const legacy = new Transaction();

// V0 format (recommended)
const v0 = new VersionedTransaction(messageV0);
```

Both work seamlessly with the sponsor endpoint!

## Troubleshooting

### Debug Checklist

1. ✅ Is Octane server running? (`curl http://localhost:3000/api/`)
2. ✅ Is fee payer correct? (Must match Octane's public key)
3. ✅ Is blockhash fresh? (< 150 blocks old)
4. ✅ Are user signatures present? (If required)
5. ✅ Does Octane have SOL balance? (`solana balance <fee-payer-address>`)
6. ✅ Is RPC endpoint working? (Check provider status)

### Getting Help

1. Check the error message in the response
2. Verify transaction on Solana Explorer
3. Review Octane server logs
4. Test with a simple transfer first
5. Ensure all dependencies are up to date

## Performance Tips

1. **Use Connection Pooling** - Reuse Connection instances
2. **Cache Octane Config** - Don't fetch on every transaction
3. **Batch Requests** - Group multiple operations when possible
4. **Monitor RPC Latency** - Switch providers if slow
5. **Implement Retries** - Handle temporary failures gracefully

## Cost Estimation

### Per Transaction
- Average: ~0.000005 SOL (~$0.0005 at $100/SOL)
- With priority: ~0.00001 SOL (~$0.001 at $100/SOL)

### Monthly Estimates
- 1,000 txs: ~0.005 SOL (~$0.50)
- 10,000 txs: ~0.05 SOL (~$5)
- 100,000 txs: ~0.5 SOL (~$50)
- 1,000,000 txs: ~5 SOL (~$500)

## API Rate Limits

Default limits (configurable):
- 100 requests per minute per IP
- Adjustable in environment variables
- Consider your use case when setting limits

## Support

For issues or questions:
- Review error messages carefully
- Check Solana Explorer for on-chain details
- Verify Octane balance is sufficient
- Ensure RPC endpoint is operational
- Review the endpoint code at `packages/server/pages/api/sponsor.ts`

## License

Apache 2.0 - See LICENSE file in repository root

