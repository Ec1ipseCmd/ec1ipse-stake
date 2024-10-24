"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
    PublicKey, 
    Connection, 
    Transaction, 
    SystemProgram, 
    TransactionInstruction, 
    SYSVAR_RENT_PUBKEY 
} from '@solana/web3.js';
import { getMint, getAssociatedTokenAddressSync } from '@solana/spl-token';
import WalletStatus from '../components/WalletStatus';
import StakingTimer from '../components/StakingTimer';
import dynamic from 'next/dynamic';
import './styles.css';
import { Buffer } from 'buffer';

// Dynamically import WalletMultiButton to avoid SSR issues
const WalletMultiButton = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
    { ssr: false }
);

// Define the list of tokens
const TOKEN_LIST = [
    { name: 'SOL', mintAddress: null },
    { name: 'ORE', mintAddress: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp' },
    { name: 'ORE-SOL LP', mintAddress: 'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN' },
    { name: 'ORE-ISC LP', mintAddress: 'meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb' },
];

// Helper function to get the Token Program ID
const getTokenProgramId = () => new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

function AppContent() {
    const { publicKey, sendTransaction } = useWallet();
    const [amount, setAmount] = useState('');
    const [mintAddress, setMintAddress] = useState('oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp');
    const [decimals, setDecimals] = useState(11);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isStakeActive, setIsStakeActive] = useState(false);
    const [countdown, setCountdown] = useState('');

    // Initialize connection and miner PublicKey
    const connection = useMemo(() => new Connection(process.env.NEXT_PUBLIC_RPC_URL), []);
    const miner = useMemo(() => new PublicKey('mineXqpDeBeMR8bPQCyy9UneJZbjFywraS3koWZ8SSH'), []);

    // Fetch decimals based on selected mint address
    useEffect(() => {
        const fetchDecimals = async () => {
            try {
                if (!mintAddress) {
                    setDecimals(9); // Default to SOL decimals
                    return;
                }
                const mintPubKey = new PublicKey(mintAddress);
                const mintInfo = await getMint(connection, mintPubKey);
                setDecimals(mintInfo.decimals);
            } catch (error) {
                console.error('Error fetching mint decimals:', error);
                setDecimals(11); // Fallback decimals
            }
        };
        fetchDecimals();
    }, [mintAddress, connection]);

    // Helper function to get Delegated Boost Address PDA
    const getDelegatedBoostAddress = async (staker, mint) => {
        const programId = new PublicKey('J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we');
        const managed_proof_address = PublicKey.findProgramAddressSync(
            [Buffer.from("managed-proof-account"), miner.toBuffer()],
            programId
        )[0];

        const delegated_boost_address = PublicKey.findProgramAddressSync(
            [Buffer.from("v2-delegated-boost"), staker.toBuffer(), mint.toBuffer(), managed_proof_address.toBuffer()],
            programId
        )[0];

        return delegated_boost_address;
    };

    // Handler for Stake Boost
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
            const staker = publicKey;
            const mint = new PublicKey(mintAddress);
            const stakeAmount = BigInt(Math.round(stakeAmountFloat * (10 ** decimals)));

            // Compute Delegated Boost Address
            const delegated_boost_address = await getDelegatedBoostAddress(staker, mint);

            // Check if Delegated Boost Account Exists
            const accountInfo = await connection.getAccountInfo(delegated_boost_address);
            if (!accountInfo) {
                // DelegateBoost account does not exist, initialize it
                const initInstruction = await createInitDelegateBoostInstruction(staker, miner, staker, mint);
                transaction.add(initInstruction);
            }

            // Create Stake Boost Instruction
            const stakeInstruction = await createStakeBoostInstruction(staker, miner, mint, stakeAmount);
            transaction.add(stakeInstruction);

            // Send Transaction
            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'confirmed');

            if (!accountInfo) {
                alert('Boost account initialized and stake transaction sent successfully!');
            } else {
                alert('Stake transaction sent successfully!');
            }

        } catch (error) {
            console.error('Error staking boost:', error);
            alert(`Error staking boost: ${error.message || error}`);
        } finally {
            setIsProcessing(false);
        }
    }, [publicKey, sendTransaction, amount, mintAddress, decimals, miner, connection]);

    // Handler for Unstake Boost
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
            const staker = publicKey;
            const mint = new PublicKey(mintAddress);
            const unstakeAmount = BigInt(Math.round(unstakeAmountFloat * (10 ** decimals)));

            // Create Unstake Boost Instruction (v2 or other version if applicable)
            const instruction = await createUnstakeBoostInstruction(staker, miner, mint, unstakeAmount);
            transaction.add(instruction);

            // Send Transaction
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

    // **Modified Handler for Boost Transaction**
    const handleBoostTransaction = useCallback(async () => {
        if (!publicKey) {
            alert('Please connect your wallet');
            return;
        }

        try {
            setIsProcessing(true);
            const staker = publicKey;
            const mint = new PublicKey(mintAddress);

            // **Fetch the entire staked amount from the API (v2)**
            const apiUrl = `https://ec1ipse.me/miner/boost/stake?pubkey=${publicKey.toBase58()}&mint=${mintAddress}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch staked amount: ${response.statusText}`);
            }

            const amountText = await response.text();
            const boostAmountFloat = parseFloat(amountText);
            console.log(boostAmountFloat);

            if (isNaN(boostAmountFloat) || boostAmountFloat <= 0) {
                throw new Error('Invalid staked amount fetched from the server.');
            }

            // **Convert the fetched human-readable amount to the smallest unit**
            const amountBigInt = BigInt(Math.round(boostAmountFloat * (10 ** decimals)));
            console.log(amountBigInt);

            const transaction = new Transaction();

            // 1. Create Unstake Boost Instruction v1
            const unstakeInstructionV1 = await createUnstakeBoostInstruction_v1(staker, miner, mint, amountBigInt);
            transaction.add(unstakeInstructionV1);
            console.log("unstakeInstructionV1");

            const delegated_boost_address = await getDelegatedBoostAddress(staker, mint);

            // Check if Delegated Boost Account Exists
            const accountInfo = await connection.getAccountInfo(delegated_boost_address);
            if (!accountInfo) {
                console.log("Check for Delegate Boost Account");


                // DelegateBoost account does not exist, initialize it
                const initInstruction = await createInitDelegateBoostInstruction(staker, miner, staker, mint);
                transaction.add(initInstruction);
                console.log("No Delegate Boost Account found, creating");
            }

            // Send Transaction
            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'confirmed');
            console.log("Sending Transaction");

            alert('Boost transaction completed successfully!');

        } catch (error) {
            console.error('Error performing boost transaction:', error);
            alert(`Error performing boost transaction: ${error.message || error}`);
        } finally {
            setIsProcessing(false);
        }
    }, [publicKey, sendTransaction, mintAddress, decimals, miner, connection]);

    // Function to create Stake Boost Instruction
    const createStakeBoostInstruction = async (staker, miner, mint, amount) => {
        try {
            const programId = new PublicKey('J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we');
            const boostProgramId = new PublicKey('boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc');

            const TOKEN_PROGRAM_ID = getTokenProgramId();

            const managed_proof_address = PublicKey.findProgramAddressSync(
                [Buffer.from("managed-proof-account"), miner.toBuffer()],
                programId
            )[0];

            const delegated_boost_address = PublicKey.findProgramAddressSync(
                [Buffer.from("v2-delegated-boost"), staker.toBuffer(), mint.toBuffer(), managed_proof_address.toBuffer()],
                programId
            )[0];

            const boost_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("boost"), mint.toBuffer()],
                boostProgramId
            )[0];

            const stake_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("stake"), managed_proof_address.toBuffer(), boost_pda.toBuffer()],
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
                data: Buffer.concat([Buffer.from([9]), amountBuffer]) // Instruction data: [9] + amount
            });

            return instruction;
        } catch (error) {
            throw error;
        }
    };

    // Function to create Unstake Boost Instruction v1
    const createUnstakeBoostInstruction_v1 = async (staker, miner, mint, amount) => {
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

            const stake_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("stake"), managed_proof_address.toBuffer(), boost_pda.toBuffer()],
                boostProgramId
            )[0];

            const managed_proof_token_account = getAssociatedTokenAddressSync(mint, managed_proof_address, true);
            const staker_token_account = getAssociatedTokenAddressSync(mint, staker);
            const boost_tokens_address = getAssociatedTokenAddressSync(mint, boost_pda, true);
            const amountBuffer = Buffer.alloc(8);
            amountBuffer.writeBigUInt64LE(amount);

            const instruction_v1 = new TransactionInstruction({
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
                data: Buffer.concat([Buffer.from([6]), amountBuffer]) // Instruction data: [6] + amount
            });

            return instruction_v1;
        } catch (error) {
            console.error('Error creating unstake boost instruction v1:', error);
            throw error;
        }
    };

    // Function to create Unstake Boost Instruction (Assuming v2 or other version)
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
                [Buffer.from("v2-delegated-boost"), staker.toBuffer(), mint.toBuffer(), managed_proof_address.toBuffer()],
                programId
            )[0];

            const boost_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("boost"), mint.toBuffer()],
                boostProgramId
            )[0];

            const stake_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("stake"), managed_proof_address.toBuffer(), boost_pda.toBuffer()],
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
                data: Buffer.concat([Buffer.from([10]), amountBuffer]) // Instruction data: [10] + amount
            });

            return instruction;
        } catch (error) {
            console.error('Error creating unstake boost instruction:', error);
            throw error;
        }
    };

    // Function to create Init Delegate Boost Instruction
    const createInitDelegateBoostInstruction = async (staker, miner, payer, mint) => {
        try {
            const programId = new PublicKey('J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we');
            const boostProgramId = new PublicKey('boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc');

            const managed_proof_address = PublicKey.findProgramAddressSync(
                [Buffer.from("managed-proof-account"), miner.toBuffer()],
                programId
            )[0];

            const delegated_boost_address = PublicKey.findProgramAddressSync(
                [Buffer.from("v2-delegated-boost"), staker.toBuffer(), mint.toBuffer(), managed_proof_address.toBuffer()],
                programId
            )[0];
            
            const boost_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("boost"), mint.toBuffer()],
                boostProgramId
            )[0];

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: staker, isSigner: false, isWritable: true },
                    { pubkey: miner, isSigner: false, isWritable: true },
                    { pubkey: payer, isSigner: true, isWritable: true },
                    { pubkey: managed_proof_address, isSigner: false, isWritable: true },
                    { pubkey: delegated_boost_address, isSigner: false, isWritable: true },
                    { pubkey: mint, isSigner: false, isWritable: false },
                    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: programId,
                data: Buffer.from([11]) // Instruction data: [11]
            });

            return instruction;
        } catch (error) {
            console.error('Error creating init delegate boost instruction:', error);
            throw error;
        }
    };

    // Helper function to format balance based on decimals
    const formatBalance = (balance) => {
        if (balance === null || balance === undefined) return '0.0000';
        // Since the API returns a human-readable number, we display it as is
        return balance.toFixed(4); // Adjust decimal places as needed
    };

    return (
        <div className="container">
            <header className="header">
                <h1>Ec1ipse Stake</h1>
                <WalletMultiButton className="wallet-button" />
            </header>

            {/* Balances Section */}
            <div className="balances-section">
                <WalletStatus connection={connection} />

                {/* Separator Line */}
                <hr className="separator" />
                <br></br>
            </div>

            {/* Staking Timer Component */}
            <StakingTimer 
                isStakeActive={isStakeActive} 
                setIsStakeActive={setIsStakeActive} 
                countdown={countdown} 
                setCountdown={setCountdown} 
            />

            <div className="card">
                <h2>Manage Your Stake</h2>
                <div className="input-group">
                    {/* **Optionally Disable Amount Input for Boost Transactions** */}
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="amount-input"
                        min="0"
                        step="any"
                        disabled={isProcessing && !isStakeActive} // Example condition
                    />
                </div>

                <div className="input-group">
                    <select
                        value={mintAddress}
                        onChange={(e) => setMintAddress(e.target.value)}
                        className="select-token"
                    >
                        {TOKEN_LIST.filter(token => token.mintAddress).map(token => (
                            <option key={token.name} value={token.mintAddress}>{token.name}</option>
                        ))}
                    </select>
                </div>

                {publicKey ? (
                    <div className="button-group">
                        <button
                            onClick={handleStakeBoost}
                            className={`button stake-button ${isStakeActive ? 'active' : 'inactive'}`}
                            disabled={!isStakeActive || isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Stake Boost'}
                        </button>
                        <button
                            onClick={handleUnstakeBoost}
                            className="button unstake-button"
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Unstake Boost'}
                        </button>
                        {/* New Boost Button */}
                        <button
                            onClick={handleBoostTransaction}
                            className={`button convert-button ${isStakeActive ? 'active' : 'inactive'}`}
                            disabled={!isStakeActive || isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Convert Stake'}
                        </button>
                    </div>
                ) : (
                    <p className="connect-wallet-message">Please connect your wallet to stake, unstake, or boost.</p>
                )}

                {/* The StakingTimer component handles its own display */}
            </div>
        </div>
    );
}

export default AppContent;
