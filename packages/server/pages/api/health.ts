import type { NextApiRequest, NextApiResponse } from 'next';
import { connection, ENV_FEE_PAYER } from '../../src';

interface HealthResponse {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    feePayer: string;
    rpc: {
        connected: boolean;
        blockheight?: number;
        error?: string;
    };
}

// Lightweight health check endpoint for Kubernetes probes
export default async function (request: NextApiRequest, response: NextApiResponse<HealthResponse>) {
    const timestamp = new Date().toISOString();
    
    try {
        // Quick RPC check - get current block height
        const blockHeight = await connection.getBlockHeight();
        
        response.status(200).json({
            status: 'healthy',
            timestamp,
            feePayer: ENV_FEE_PAYER.toBase58(),
            rpc: {
                connected: true,
                blockheight: blockHeight,
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        response.status(503).json({
            status: 'unhealthy',
            timestamp,
            feePayer: ENV_FEE_PAYER.toBase58(),
            rpc: {
                connected: false,
                error: errorMessage,
            }
        });
    }
}

