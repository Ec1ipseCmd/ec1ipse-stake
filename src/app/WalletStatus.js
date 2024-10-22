"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import './styles.css';

const TOKEN_LIST = [
    { name: 'SOL', mintAddress: null },
    { name: 'ORE', mintAddress: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp' },
    { name: 'ORE-SOL LP', mintAddress: 'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN' },
    { name: 'ORE-ISC LP', mintAddress: 'meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb' },
];

const getTokenProgramId = () => new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

function WalletStatus({ connection }) {
    const { publicKey } = useWallet();
    const [balances, setBalances] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchBalances = async () => {
            if (publicKey && connection) {
                try {
                    setIsLoading(true);
                    const balancePromises = TOKEN_LIST.map(async (token) => {
                        if (token.name === 'SOL') {
                            const balanceLamports = await connection.getBalance(publicKey);
                            const balanceSOL = balanceLamports / 1e9;
                            return { name: token.name, balance: `${balanceSOL} SOL` };
                        } else {
                            const mintPublicKey = new PublicKey(token.mintAddress);
                            const tokenAccount = getAssociatedTokenAddressSync(
                                mintPublicKey,
                                publicKey,
                                false,
                                getTokenProgramId()
                            );

                            const accountInfo = await connection.getAccountInfo(tokenAccount);
                            if (!accountInfo) return { name: token.name, balance: '0' };

                            const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
                            const balance = Number(tokenBalance.value.uiAmount) || 0;
                            return { name: token.name, balance: `${balance} ${token.name.split('-')[0]}` };
                        }
                    });

                    const results = await Promise.all(balancePromises);
                    const balancesObj = results.reduce((acc, curr) => {
                        acc[curr.name] = curr.balance;
                        return acc;
                    }, {});

                    if (isMounted) setBalances(balancesObj);
                } catch (error) {
                    console.error('Error fetching balances:', error);
                    if (isMounted) setBalances({});
                } finally {
                    if (isMounted) setIsLoading(false);
                }
            } else {
                if (isMounted) setBalances({});
            }
        };

        fetchBalances();

        const intervalId = setInterval(fetchBalances, 60000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [publicKey, connection]);

    return (
        <div className="wallet-status">
            {publicKey ? (
                <>
                    <p className="wallet-address">Connected: {publicKey.toString()}</p>
                    <div className="balances">
                        <h3>Balances:</h3>
                        {isLoading ? (
                            <p>Loading balances...</p>
                        ) : (
                            <ul className="balance-list">
                                {TOKEN_LIST.map((token) => (
                                    <li key={token.name}>
                                        <span className="token-name">{token.name}:</span>
                                        <span className="token-balance">
                                            {balances[token.name] !== undefined ? balances[token.name] : 'N/A'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            ) : (
                <p className="no-wallet">No Pubkey Connected</p>
            )}
        </div>
    );
}

export default React.memo(WalletStatus);
