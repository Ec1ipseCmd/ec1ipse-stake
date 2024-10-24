"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

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
    const [stakedBalances, setStakedBalances] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false); // New state for copy feedback

    // Fetch regular balances
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

    // Fetch staked balances (moved from AppContent)
    useEffect(() => {
        const fetchStakedBalances = async () => {
            if (!publicKey) return;

            try {
                const baseUrl = 'https://ec1ipse.me/v2/miner/boost/stake';
                const mintAddresses = {
                    ORE: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp',
                    'ORE-SOL LP': 'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN',
                    'ORE-ISC LP': 'meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb',
                };

                const fetchUrls = Object.entries(mintAddresses).map(([tokenName, mintAddress]) => {
                    const url = `${baseUrl}?pubkey=${publicKey.toBase58()}&mint=${mintAddress}`;
                    return fetch(url)
                        .then(response => response.text())
                        .then(text => {
                            const parsed = parseFloat(text);
                            return {
                                name: tokenName,
                                balance: isNaN(parsed) ? '0.00' : parsed.toFixed(4),
                            };
                        })
                        .catch(() => ({
                            name: tokenName,
                            balance: '0.00',
                        }));
                });

                const results = await Promise.all(fetchUrls);

                const stakedBalancesObj = results.reduce((acc, curr) => {
                    acc[curr.name] = curr.balance;
                    return acc;
                }, {});

                setStakedBalances(stakedBalancesObj);
            } catch (error) {
                console.error('Error fetching staked balances:', error);
                // Optionally, reset stakedBalances to default values
                setStakedBalances({
                    ORE: '0.00',
                    'ORE-SOL LP': '0.00',
                    'ORE-ISC LP': '0.00',
                });
            }
        };

        fetchStakedBalances();
    }, [publicKey]);

    // Handler to copy wallet address
    const handleCopy = () => {
        if (publicKey) {
            navigator.clipboard.writeText(publicKey.toString())
                .then(() => {
                    setCopied(true);
                    // Reset the copied state after 2 seconds
                    setTimeout(() => setCopied(false), 2000);
                })
                .catch((err) => {
                    console.error('Failed to copy!', err);
                    // Optionally, you can set an error state here
                });
        }
    };

    return (
        <div className="wallet-status">
            {publicKey ? (
                <>
                    <div className="wallet-address-container">
                        <p className="wallet-address">Connected: {publicKey.toString()}</p>
                        <button className="copy-button" onClick={handleCopy} aria-label="Copy wallet address">
                            📜
                        </button>
                        {copied && <span className="copy-feedback">Copied</span> && <div><br></br></div>}
                    </div>
                    <div className="balances">
                        <h3 class="large-heading">Wallet Balances:</h3>
                        {isLoading ? (
                            <p className="loading-text">Loading balances...</p>
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

                        {/* Separator Line */}
                        <hr className="separator" />

                        <h3 class="large-heading">Staked Balances (Yield):</h3>
                        <ul className="balance-list">
                            <li>
                                <span className="token-name">ORE:</span>
                                <span className="token-balance">{stakedBalances.ORE || '0.00'}</span>
                            </li>
                            <li>
                                <span className="token-name">ORE-SOL LP:</span>
                                <span className="token-balance">{stakedBalances['ORE-SOL LP'] || '0.00'}</span>
                            </li>
                            <li>
                                <span className="token-name">ORE-ISC LP:</span>
                                <span className="token-balance">{stakedBalances['ORE-ISC LP'] || '0.00'}</span>
                            </li>
                        </ul>
                    </div>
                </>
            ) : (
                <p className="no-wallet">No Pubkey Connected</p>
            )}
        </div>
    );
}

export default React.memo(WalletStatus);
