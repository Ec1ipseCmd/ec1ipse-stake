"use client";

import "../styles.css";
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const TOKEN_LIST = [
    { name: 'SOL', mintAddress: null },
    { name: 'ORE', mintAddress: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp' },
    { name: 'ORE-SOL', mintAddress: 'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN' },
    { name: 'ORE-ISC', mintAddress: 'meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb' },
];

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

const formatPubkey = (pubkey) => {
    if (!pubkey || pubkey.length < 8) return pubkey;
    return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
};

const useInterval = (callback, delay) => {
    const savedCallback = useRef();

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (delay !== null) {
            const id = setInterval(() => savedCallback.current(), delay);
            return () => clearInterval(id);
        }
    }, [delay]);
};

const WalletBalances = memo(({ publicKey, connection }) => {
    const [balances, setBalances] = useState({});
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    const fetchBalances = useCallback(async () => {
        if (publicKey && connection) {
            try {
                const balancePromises = TOKEN_LIST.map(async (token) => {
                    if (token.name === 'SOL') {
                        const balanceLamports = await connection.getBalance(publicKey);
                        const balanceSOL = balanceLamports / 1e9;
                        return { name: token.name, balance: balanceSOL.toFixed(2) }; // 2 decimal places
                    } else {
                        const mintPublicKey = new PublicKey(token.mintAddress);
                        const tokenAccount = getAssociatedTokenAddressSync(
                            mintPublicKey,
                            publicKey,
                            false,
                            TOKEN_PROGRAM_ID
                        );

                        const accountInfo = await connection.getAccountInfo(tokenAccount);
                        if (!accountInfo) return { name: token.name, balance: '0.00' }; // Default to '0.00'

                        const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
                        const balance = Number(tokenBalance.value.uiAmount) || 0;
                        return { name: token.name, balance: balance.toFixed(2) }; // 2 decimal places
                    }
                });

                const results = await Promise.all(balancePromises);
                const balancesObj = results.reduce((acc, curr) => {
                    acc[curr.name] = curr.balance;
                    return acc;
                }, {});

                setBalances((prevBalances) => {
                    const prev = JSON.stringify(prevBalances);
                    const current = JSON.stringify(balancesObj);
                    if (prev !== current) {
                        if (isFirstLoad) setIsFirstLoad(false);
                        return balancesObj;
                    }
                    return prevBalances;
                });
            } catch (error) {
                console.error('Error fetching balances:', error);
                setBalances({});
            }
        } else {
            setBalances({});
        }
    }, [publicKey, connection, isFirstLoad]);

    useEffect(() => {
        fetchBalances();
    }, [fetchBalances]);

    useInterval(fetchBalances, publicKey && connection ? 1000 : null);

    return (
        <div className="balances">
            <h3 className="large-heading">Wallet Balance:</h3>
            {isFirstLoad && Object.keys(balances).length === 0 ? (
                <p className="loading-text">Loading balances...</p>
            ) : (
                <ul className="balance-list">
                    {TOKEN_LIST.map((token) => (
                        <li key={token.name}>
                            <span className="token-name">{token.name}:</span>
                            <span className="token-balance">
                                {balances[token.name] !== undefined ? balances[token.name] : '0.00'} {/* Changed 'N/A' to '0.00' */}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
});

const StakedBalances = memo(({ publicKey, connection }) => {
    const [stakedBalances, setStakedBalances] = useState({});
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    // Define mintAddresses based on TOKEN_LIST
    const mintAddresses = TOKEN_LIST
        .filter(token => token.mintAddress)
        .reduce((acc, token) => {
            acc[token.name] = token.mintAddress;
            return acc;
        }, {});

    const fetchStakedBalances = useCallback(async () => {
        if (!publicKey || !connection) return;

        try {
            const baseUrl = 'https://ec1ipse.me/v2/miner/boost/stake';
            const fetchPromises = Object.entries(mintAddresses).map(async ([tokenName, mintAddress]) => {
                const url = `${baseUrl}?pubkey=${publicKey.toBase58()}&mint=${mintAddress}`;
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const text = await response.text();
                    const parsed = parseFloat(text);
                    if (isNaN(parsed)) {
                        console.warn(`Invalid response for ${tokenName}: ${text}`);
                        return { name: tokenName, balance: '0.00' }; // Default to '0.00'
                    }
                    return { name: tokenName, balance: parsed.toFixed(2) }; // 2 decimal places
                } catch (error) {
                    console.error(`Error fetching staked balance for ${tokenName}:`, error);
                    return { name: tokenName, balance: '0.00' }; // Default to '0.00'
                }
            });

            const results = await Promise.all(fetchPromises);

            const successfulBalances = results.reduce((acc, curr) => {
                acc[curr.name] = curr.balance;
                return acc;
            }, {});

            setStakedBalances((prevStakedBalances) => {
                const newStakedBalances = { ...prevStakedBalances, ...successfulBalances };
                const current = JSON.stringify(newStakedBalances);
                const prev = JSON.stringify(prevStakedBalances);
                if (current !== prev) {
                    if (isFirstLoad) setIsFirstLoad(false);
                    return newStakedBalances;
                }
                return prevStakedBalances;
            });
        } catch (error) {
            console.error('Error fetching staked balances:', error);
        }
    }, [publicKey, mintAddresses, isFirstLoad, connection]);

    useEffect(() => {
        fetchStakedBalances();
    }, [fetchStakedBalances]);

    useInterval(fetchStakedBalances, publicKey && connection ? 1000 : null);

    return (
        <div className="staked-balances">
            <h3 className="large-heading">Staked Balance:</h3>
            <p>(Yield earning):</p>
            {isFirstLoad && Object.keys(stakedBalances).length === 0 ? (
                <p className="loading-text">Loading staked balances...</p>
            ) : (
                <ul className="balance-list">
                    {Object.keys(mintAddresses).map((tokenName) => (
                        <li key={tokenName}>
                            <span className="token-name">{tokenName}:</span>
                            <span className="token-balance">{stakedBalances[tokenName] || '0.00'}</span> {/* Defaults to '0.00' */}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
});

function WalletStatus({ connection }) {
    const { publicKey } = useWallet();
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        if (publicKey) {
            navigator.clipboard.writeText(publicKey.toString())
                .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                })
                .catch((err) => {
                    console.error('Failed to copy!', err);
                });
        }
    }, [publicKey]);

    return (
        <div className="wallet-status">
            {publicKey ? (
                <>
                    <div className="wallet-address-container">
                        <span>Connected:</span>
                        <p className="wallet-address">{formatPubkey(publicKey.toString())}</p>
                        <button 
                            className="copy-button" 
                            onClick={handleCopy} 
                            aria-label="Copy wallet address"
                        >
                            📜
                        </button>
                        {copied && <span className="copy-feedback">Copied!</span>}
                    </div>
                    <WalletBalances publicKey={publicKey} connection={connection} />
                    <hr className="separator" />
                    <StakedBalances publicKey={publicKey} connection={connection} />
                </>
            ) : (
                <p className="no-wallet">No Pubkey Connected</p>
            )}
        </div>
    );
}

export default memo(WalletStatus);
