"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Connection, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { getMint, getAssociatedTokenAddressSync  } from '@solana/spl-token';
import WalletStatus from './WalletStatus';
import StakingTimer from './StakingTimer';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
    { ssr: false }
);
import './styles.css';
import { Buffer } from 'buffer';

const TOKEN_LIST = [
    { name: 'SOL', mintAddress: null },
    { name: 'ORE', mintAddress: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp' },
    { name: 'ORE-SOL LP', mintAddress: 'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN' },
    { name: 'ORE-ISC LP', mintAddress: 'meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb' },
];

const getTokenProgramId = () => new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

function AppContent() {
    const { publicKey, sendTransaction } = useWallet();
    const [amount, setAmount] = useState('');
    const [mintAddress, setMintAddress] = useState('oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp');
    const [decimals, setDecimals] = useState(11);
    const [isProcessing, setIsProcessing] = useState(false);
    const [stake_pda, setStakePda] = useState(new PublicKey('2fpUVijnhKkDoSQaHfDVPpLmeKRpcGtNRQgwjBk4Jd5E'));
    const [isStakeActive, setIsStakeActive] = useState(false);
    const [countdown, setCountdown] = useState('');

    const connection = useMemo(() => new Connection(process.env.NEXT_PUBLIC_RPC_URL), []);

    const miner = useMemo(() => new PublicKey('mineXqpDeBeMR8bPQCyy9UneJZbjFywraS3koWZ8SSH'), []);

    useEffect(() => {
        const fetchDecimals = async () => {
            try {
                const mintPubKey = new PublicKey(mintAddress);
                const mintInfo = await getMint(connection, mintPubKey);
                setDecimals(mintInfo.decimals);
            } catch (error) {
                console.error('Error fetching mint decimals:', error);
                setDecimals(11);
            }
        };
        fetchDecimals();
    }, [mintAddress, connection]);

    useEffect(() => {
        const pdaMap = {
            'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp': '2fpUVijnhKkDoSQaHfDVPpLmeKRpcGtNRQgwjBk4Jd5E',
            'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN': '6e5CSgGEHRTx4twiPsfk1jxsns6SPPh19m9XRw1RRYNE',
            'meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb': '9vYiNNEcRwqTi5iCaKqg1brntgq46yrihPe3nQvHGW31',
        };
        const pda = pdaMap[mintAddress];
        if (pda) setStakePda(new PublicKey(pda));
    }, [mintAddress]);

    const handleInitDelegateBoost = useCallback(async () => {
        if (!publicKey) {
            alert('Please connect your wallet');
            return;
        }

        try {
            setIsProcessing(true);
            const transaction = new Transaction();
            const staker = publicKey;
            const mint = new PublicKey(mintAddress);

            const instruction = await createInitDelegateBoostInstruction(staker, miner, staker, mint);
            transaction.add(instruction);

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'confirmed');

            alert('Boost account initialized successfully!');
        } catch (error) {
            console.error('Error initializing boost:', error);
            alert(`Error initializing boost: ${error.message || error}`);
        } finally {
            setIsProcessing(false);
        }
    }, [publicKey, sendTransaction, mintAddress, miner, connection]);

    const handleStakeBoost = useCallback(async () => {
        if (!publicKey) {
            alert('Please connect your wallet');
            return;
        }

        const stakeAmountFloat = parseFloat(amount);
        if (isNaN(stakeAmountFloat) || stakeAmountFloat <= 0) {
            alert('Please enter a valid amount to stake.');
            return;
        }

        try {
            setIsProcessing(true);
            const transaction = new Transaction();
            const mint = new PublicKey(mintAddress);
            const stakeAmount = BigInt(Math.round(stakeAmountFloat * (10 ** decimals)));

            const instruction = await createStakeBoostInstruction(publicKey, miner, mint, stakeAmount);
            transaction.add(instruction);

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'confirmed');

            alert('Stake transaction sent successfully!');
        } catch (error) {
            console.error('Error staking boost:', error);
            alert(`Error staking boost: ${error.message || error}`);
        } finally {
            setIsProcessing(false);
        }
    }, [publicKey, sendTransaction, amount, mintAddress, decimals, miner, connection]);

    const handleUnstakeBoost = useCallback(async () => {
        if (!publicKey) {
            alert('Please connect your wallet');
            return;
        }

        const unstakeAmountFloat = parseFloat(amount);
        if (isNaN(unstakeAmountFloat) || unstakeAmountFloat <= 0) {
            alert('Please enter a valid amount to unstake.');
            return;
        }

        try {
            setIsProcessing(true);
            const transaction = new Transaction();
            const mint = new PublicKey(mintAddress);
            const unstakeAmount = BigInt(Math.round(unstakeAmountFloat * (10 ** decimals)));

            const instruction = await createUnstakeBoostInstruction(publicKey, miner, mint, unstakeAmount);
            transaction.add(instruction);

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'confirmed');

            alert('Unstake transaction sent successfully!');
        } catch (error) {
            console.error('Error unstaking boost:', error);
            alert('Error unstaking boost. See console for details.');
        } finally {
            setIsProcessing(false);
        }
    }, [publicKey, sendTransaction, amount, mintAddress, decimals, miner, connection]);

    const createStakeBoostInstruction = async (staker, miner, mint, amount) => {
        
        try {
            const programId = new PublicKey('J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we');
            const boostProgramId = new PublicKey('boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc');

            const TOKEN_PROGRAM_ID = getTokenProgramId();
            const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

            const managed_proof_address = PublicKey.findProgramAddressSync(
                [Buffer.from("managed-proof-account"), miner.toBuffer()],
                programId
            )[0];

            const delegated_boost_address = PublicKey.findProgramAddressSync(
                [Buffer.from("delegated-boost"), staker.toBuffer(), mint.toBuffer(), managed_proof_address.toBuffer()],
                programId
            )[0];

            const boost_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("boost"), mint.toBuffer()],
                boostProgramId
            )[0];

            const managed_proof_token_account = getAssociatedTokenAddressSync(mint, managed_proof_address, true);

            const staker_token_account = getAssociatedTokenAddressSync(mint, staker);

            const boost_tokens_address = getAssociatedTokenAddressSync(mint, boost_pda, true);

            const amountBuffer = Buffer.alloc(8);
            amountBuffer.writeBigUInt64LE(amount);

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: staker, isSigner: true, isWritable: true },
                    { pubkey: miner, isSigner: false, isWritable: false },
                    { pubkey: managed_proof_address, isSigner: false, isWritable: true },
                    { pubkey: managed_proof_token_account, isSigner: false, isWritable: true },
                    { pubkey: delegated_boost_address, isSigner: false, isWritable: true },
                    { pubkey: boost_pda, isSigner: false, isWritable: true },
                    { pubkey: mint, isSigner: false, isWritable: false },
                    { pubkey: staker_token_account, isSigner: false, isWritable: true },
                    { pubkey: boost_tokens_address, isSigner: false, isWritable: true },
                    { pubkey: stake_pda, isSigner: false, isWritable: true },
                    { pubkey: boostProgramId, isSigner: false, isWritable: false },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
                ],
                programId: programId,
                data: Buffer.concat([Buffer.from([6]), amountBuffer])
            });

            return instruction;
        } catch (error) {
            throw error;
        }
    };

    const createUnstakeBoostInstruction = async (staker, miner, mint, amount) => {
        try {
            const programId = new PublicKey('J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we');
            const boostProgramId = new PublicKey('boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc');

            const TOKEN_PROGRAM_ID = getTokenProgramId();
            const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

            const managed_proof_address = PublicKey.findProgramAddressSync(
                [Buffer.from("managed-proof-account"), miner.toBuffer()],
                programId
            )[0];

            const delegated_boost_address = PublicKey.findProgramAddressSync(
                [Buffer.from("delegated-boost"), staker.toBuffer(), mint.toBuffer(), managed_proof_address.toBuffer()],
                programId
            )[0];

            const boost_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("boost"), mint.toBuffer()],
                boostProgramId
            )[0];

            const managed_proof_token_account = getAssociatedTokenAddressSync(mint, managed_proof_address, true);
            const staker_token_account = getAssociatedTokenAddressSync(mint, staker);
            const boost_tokens_address = getAssociatedTokenAddressSync(mint, boost_pda, true);
            const amountBuffer = Buffer.alloc(8);
            amountBuffer.writeBigUInt64LE(amount);

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: staker, isSigner: true, isWritable: true },
                    { pubkey: miner, isSigner: false, isWritable: false },
                    { pubkey: managed_proof_address, isSigner: false, isWritable: true },
                    { pubkey: managed_proof_token_account, isSigner: false, isWritable: true },
                    { pubkey: delegated_boost_address, isSigner: false, isWritable: true },
                    { pubkey: boost_pda, isSigner: false, isWritable: true },
                    { pubkey: mint, isSigner: false, isWritable: false },
                    { pubkey: staker_token_account, isSigner: false, isWritable: true },
                    { pubkey: boost_tokens_address, isSigner: false, isWritable: true },
                    { pubkey: stake_pda, isSigner: false, isWritable: true },
                    { pubkey: boostProgramId, isSigner: false, isWritable: false },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
                ],
                programId: programId,
                data: Buffer.concat([Buffer.from([7]), amountBuffer])
            });

            return instruction;
        } catch (error) {
            console.error('Error creating unstake boost instruction:', error);
            throw error;
        }
    };

    const createInitDelegateBoostInstruction = async (staker, miner, payer, mint) => {
        try {
            const programId = new PublicKey('J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we');

            const managed_proof_address = PublicKey.findProgramAddressSync(
                [Buffer.from("managed-proof-account"), miner.toBuffer()],
                programId
            )[0];

            const boost_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("delegated-boost"), mint.toBuffer()],
                programId
            )[0];

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: staker, isSigner: false, isWritable: true },
                    { pubkey: miner, isSigner: false, isWritable: true },
                    { pubkey: payer, isSigner: true, isWritable: true },
                    { pubkey: managed_proof_address, isSigner: false, isWritable: true },
                    { pubkey: boost_pda, isSigner: false, isWritable: true },
                    { pubkey: mint, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: programId,
                data: Buffer.from([8])
            });

            return instruction;
        } catch (error) {
            console.error('Error creating init delegate boost instruction:', error);
            throw error;
        }
    };

    return (
        <div className="container">
            <header className="header">
                <h1>Ec1ipse Stake</h1>
                <WalletMultiButton className="wallet-button" />
            </header>

            <WalletStatus connection={connection} />
            
            {/* Pass the state and setter functions as props */}
            <StakingTimer 
                isStakeActive={isStakeActive} 
                setIsStakeActive={setIsStakeActive} 
                countdown={countdown} 
                setCountdown={setCountdown} 
            />

            <div className="card">
                <h2>Manage Your Stake</h2>
                <div className="input-group">
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="amount-input"
                        min="0"
                        step="any"
                    />
                </div>

                <div className="input-group">
                    <select
                        value={mintAddress}
                        onChange={(e) => setMintAddress(e.target.value)}
                        className="select-token"
                    >
                        <option value="oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp">ORE Token</option>
                        <option value="DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN">ORE-SOL LP</option>
                        <option value="meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb">ORE-ISC LP</option>
                    </select>
                </div>

                {publicKey ? (
                    <div className="button-group">
                        <button
                            onClick={handleStakeBoost}
                            className={`button stake-button ${isStakeActive ? 'active' : 'inactive'}`}
                            disabled={!isStakeActive || isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Stake'}
                        </button>
                        <button
                            onClick={handleUnstakeBoost}
                            className="button unstake-button"
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Unstake'}
                        </button>
                        <button
                            onClick={handleInitDelegateBoost}
                            className="button init-button"
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Initialize'}
                        </button>
                    </div>
                ) : (
                    <p className="connect-wallet-message">Please connect your wallet to stake or unstake.</p>
                )}

                {/* The StakingTimer component handles its own display */}
            </div>
        </div>
    );
}

export default AppContent;