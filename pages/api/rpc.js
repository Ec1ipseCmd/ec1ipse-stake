// pages/api/rpc.js

import { Connection, PublicKey } from '@solana/web3.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { publicKey, mintAddress } = req.body;

    if (!publicKey || !mintAddress) {
        return res.status(400).json({ error: 'Missing publicKey or mintAddress' });
    }

    try {
        const connection = new Connection(process.env.RPC_URL); // Notice no NEXT_PUBLIC_ prefix
        const pubKey = new PublicKey(publicKey);
        const mintPubKey = new PublicKey(mintAddress);

        // Example: Fetch SOL balance
        const balanceLamports = await connection.getBalance(pubKey);
        const balanceSOL = balanceLamports / 1e9;

        // Example: Fetch SPL Token balance
        // Add your token balance fetching logic here

        res.status(200).json({ balanceSOL });
    } catch (error) {
        console.error('RPC Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
