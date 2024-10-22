"use client";

import { Buffer } from 'buffer';
import React, { useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, PublicKey, Connection, TransactionInstruction, SYSVAR_RENT_PUBKEY, SystemProgram } from '@solana/web3.js';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { getAssociatedTokenAddressSync, getMint } from '@solana/spl-token';

import './styles.css';

const TOKEN_LIST = [
    {
        name: 'SOL',
        mintAddress: null,
    },
    {
        name: 'ORE',
        mintAddress: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp',
    },
    {
        name: 'ORE-SOL LP',
        mintAddress: 'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN',
    },
    {
        name: 'ORE-ISC LP',
        mintAddress: 'meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb',
    },
];

// Helper function to get the SPL Token program ID
const getTokenProgramId = () => {
    return new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
};

// WalletStatus Component
function WalletStatus({ connection }) {
    const { publicKey } = useWallet();
    const [balances, setBalances] = useState({}); // State to store balances
    const [isLoading, setIsLoading] = useState(false); // State to handle loading status

    useEffect(() => {
        const fetchBalances = async () => {
            if (publicKey) {
                try {
                    setIsLoading(true);
                    const response = await fetch('/api/rpc', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ publicKey: publicKey.toString(), mintAddress }),
                    });
                    const data = await response.json();
                    if (response.ok) {
                        setBalances({ SOL: data.balanceSOL });
                        // Update with SPL token balances as needed
                    } else {
                        console.error('Error fetching balances:', data.error);
                        setBalances({});
                    }
                } catch (error) {
                    console.error('Error fetching balances:', error);
                    setBalances({});
                } finally {
                    setIsLoading(false);
                }
            } else {
                setBalances({});
            }
        };

        fetchBalances();
    }, [publicKey, connection]);

    useEffect(() => {
        console.log('Wallet status updated:', publicKey?.toString());
    }, [publicKey]);

    return (
        <div className="wallet-status">
            {publicKey ? (
                <>
                    <p className="wallet-address">Connected: {publicKey.toString()}</p>
                    {/* Display SOL and Token Balances */}
                    <div className="balances">
                        <h3>Balances:</h3>
                        {isLoading ? (
                            <p>Loading balances...</p>
                        ) : (
                            <ul className="balance-list">
                                {TOKEN_LIST.map((token) => (
                                    <li key={token.name}>
                                        <span className="token-name">{token.name}:</span> 
                                        <span className="token-balance">{balances[token.name] !== undefined ? balances[token.name] : 'N/A'}</span>
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

function AppContent() {
    const { publicKey, sendTransaction } = useWallet();
    const [amount, setAmount] = useState(''); // State to handle input field value
    const [mintAddress, setMintAddress] = useState('oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp'); // Default token mint for boost
    const [decimals, setDecimals] = useState(11); // Default decimals
    const [isProcessing, setIsProcessing] = useState(false); // State to handle loading
    const [stake_pda, setstake_pda] = useState(new PublicKey('2fpUVijnhKkDoSQaHfDVPpLmeKRpcGtNRQgwjBk4Jd5E')); // Default stake PDA

    // Timer states
    const [isStakeActive, setIsStakeActive] = useState(false);
    const [countdown, setCountdown] = useState('');

    // Initialize the connection using useMemo for performance optimization
    const connection = useMemo(() => new Connection(process.env.RPC_URL), []);
    const miner = useMemo(() => new PublicKey('mineXqpDeBeMR8bPQCyy9UneJZbjFywraS3koWZ8SSH'), []);

    // Fetch token decimals dynamically
    useEffect(() => {
        const fetchDecimals = async () => {
            try {
                console.log('Fetching mint decimals for mintAddress:', mintAddress);
                const mintPublicKey = new PublicKey(mintAddress);
                const mintInfo = await getMint(connection, mintPublicKey);
                console.log('Fetched mint info:', mintInfo);
                setDecimals(mintInfo.decimals);
            } catch (error) {
                console.error('Error fetching mint decimals:', error);
                setDecimals(11);
            }
        };

        fetchDecimals();
    }, [mintAddress, connection]);

    useEffect(() => {
        if (publicKey) {
            console.log(`Wallet is connected with public key: ${publicKey.toString()}`);
        } else {
            console.log(`No wallet connected`);
        }
    }, [publicKey]);

    // Update the stake_pda based on the selected mintAddress
    useEffect(() => {
        if (mintAddress === 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp') {
            setstake_pda(new PublicKey('2fpUVijnhKkDoSQaHfDVPpLmeKRpcGtNRQgwjBk4Jd5E'));
        } else if (mintAddress === 'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN') {
            setstake_pda(new PublicKey('6e5CSgGEHRTx4twiPsfk1jxsns6SPPh19m9XRw1RRYNE'));
        } else if (mintAddress === 'meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb') {
            setstake_pda(new PublicKey('9vYiNNEcRwqTi5iCaKqg1brntgq46yrihPe3nQvHGW31'));
        }
    }, [mintAddress]);

    // Timer logic to control Stake Boost button availability
    useEffect(() => {
        const updateStakeAvailability = () => {
            const now = new Date();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            const millis = now.getMilliseconds();

            if (minutes < 5) {
                setIsStakeActive(true);
                setCountdown('');
            } else {
                setIsStakeActive(false);
                // Calculate time until next hour
                const nextHour = new Date(now.getTime());
                nextHour.setMinutes(0);
                nextHour.setSeconds(0);
                nextHour.setMilliseconds(0);
                nextHour.setHours(now.getHours() + 1);

                const diff = nextHour - now; // Difference in milliseconds

                // Convert difference to minutes and seconds
                const diffSeconds = Math.floor(diff / 1000) % 60;
                const diffMinutes = Math.floor(diff / (1000 * 60)) % 60;

                // Format countdown string
                const countdownStr = `${diffMinutes.toString().padStart(2, '0')}:${diffSeconds.toString().padStart(2, '0')}`;
                setCountdown(countdownStr);
            }
        };

        // Initial check
        updateStakeAvailability();

        // Update every second
        const interval = setInterval(updateStakeAvailability, 1000);

        // Cleanup interval on unmount
        return () => clearInterval(interval);
    }, []);

    const handleInitDelegateBoost = async () => {
        if (!publicKey) {
            alert('Please connect your wallet');
            return;
        }

        try {
            setIsProcessing(true);
            console.log('Initializing Delegate Boost...');
            console.log('Public Key:', publicKey.toString());
            console.log('Mint Address:', mintAddress);

            const transaction = new Transaction();
            const staker = publicKey;
            const mint = new PublicKey(mintAddress);

            const instruction = await createInitDelegateBoostInstruction(staker, miner, staker, mint);
            console.log('Created Init Delegate Boost Instruction:', instruction);
            transaction.add(instruction);

            console.log('Sending Transaction...');
            const signature = await sendTransaction(transaction, connection);
            console.log('Transaction Signature:', signature);

            // Wait for confirmation
            console.log('Confirming Transaction...');
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            console.log('Transaction Confirmation:', confirmation);

            console.log('Boost account initialization successful with signature:', signature);
            alert('Boost account initialized successfully!');
        } catch (error) {
            console.error('Error sending init delegate boost transaction:', error);
            alert(`Error sending init delegate boost transaction: ${error.message || error}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStakeBoost = async () => {
        if (!publicKey) {
            alert('Please connect your wallet');
            return;
        }

        // Parse and validate the amount
        const stakeAmountFloat = parseFloat(amount);
        if (isNaN(stakeAmountFloat) || stakeAmountFloat <= 0) {
            alert('Please enter a valid amount to stake.');
            return;
        }

        try {
            setIsProcessing(true);
            console.log('Staking Boost...');
            console.log('Public Key:', publicKey.toString());
            console.log('Mint Address:', mintAddress);
            console.log('Amount to Stake:', stakeAmountFloat);

            const transaction = new Transaction();
            const mint = new PublicKey(mintAddress);

            // Convert the entered amount to smallest unit based on decimals
            const stakeAmount = BigInt(Math.round(stakeAmountFloat * (10 ** decimals)));
            console.log('Stake Amount in smallest units:', stakeAmount.toString());

            const instruction = await createStakeBoostInstruction(publicKey, miner, mint, stakeAmount);
            console.log('Created Stake Boost Instruction:', instruction);
            transaction.add(instruction);

            console.log('Sending Transaction...');
            const signature = await sendTransaction(transaction, connection);
            console.log('Transaction Signature:', signature);

            // Wait for confirmation
            console.log('Confirming Transaction...');
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            console.log('Transaction Confirmation:', confirmation);

            console.log('Stake boost successful with signature:', signature);
            alert('Stake transaction sent successfully!');
        } catch (error) {
            console.error('Error sending stake transaction:', error);
            alert(`Error sending stake transaction: ${error.message || error}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUnstakeBoost = async () => {
        if (!publicKey) {
            alert('Please connect your wallet');
            return;
        }

        // Parse and validate the amount
        const unstakeAmountFloat = parseFloat(amount);
        if (isNaN(unstakeAmountFloat) || unstakeAmountFloat <= 0) {
            alert('Please enter a valid amount to unstake.');
            return;
        }

        try {
            setIsProcessing(true);
            console.log('Unstaking Boost...');
            console.log('Public Key:', publicKey.toString());
            console.log('Mint Address:', mintAddress);
            console.log('Amount to Unstake:', unstakeAmountFloat);

            const transaction = new Transaction();
            const mint = new PublicKey(mintAddress);

            // Convert the entered amount to smallest unit based on decimals
            const unstakeAmount = BigInt(Math.round(unstakeAmountFloat * (10 ** decimals)));
            console.log('Unstake Amount in smallest units:', unstakeAmount.toString());

            const instruction = await createUnstakeBoostInstruction(publicKey, miner, mint, unstakeAmount);
            console.log('Created Unstake Boost Instruction:', instruction);
            transaction.add(instruction);

            console.log('Sending Transaction...');
            const signature = await sendTransaction(transaction, connection);
            console.log('Transaction Signature:', signature);

            // Wait for confirmation
            console.log('Confirming Transaction...');
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            console.log('Transaction Confirmation:', confirmation);

            console.log('Unstake boost successful with signature:', signature);
            alert('Unstake transaction sent successfully!');
        } catch (error) {
            console.error('Error sending unstake boost transaction:', error);
            alert('Error sending unstake boost transaction. See console for details.');
        } finally {
            setIsProcessing(false);
        }
    };

    const createStakeBoostInstruction = async (staker, miner, mint, amount) => {
        try {
            console.log('Creating Stake Boost Instruction...');
            const programId = new PublicKey('J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we');
            const boostProgramId = new PublicKey('boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc');

            const TOKEN_PROGRAM_ID = getTokenProgramId();
            const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

            const managed_proof_address = PublicKey.findProgramAddressSync(
                [Buffer.from("managed-proof-account"), miner.toBuffer()],
                programId
            )[0];
            console.log('Managed Proof Address:', managed_proof_address.toString());

            const delegated_boost_address = PublicKey.findProgramAddressSync(
                [Buffer.from("delegated-boost"), staker.toBuffer(), mint.toBuffer(), managed_proof_address.toBuffer()],
                programId
            )[0];
            console.log('Delegated Boost Address:', delegated_boost_address.toString());

            const boost_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("boost"), mint.toBuffer()],
                boostProgramId
            )[0];
            console.log('Boost PDA:', boost_pda.toString());

            const managed_proof_token_account = getAssociatedTokenAddressSync(mint, managed_proof_address, true);
            console.log('Managed Proof Token Account:', managed_proof_token_account.toString());

            const staker_token_account = getAssociatedTokenAddressSync(mint, staker);
            console.log('Staker Token Account:', staker_token_account.toString());

            const boost_tokens_address = getAssociatedTokenAddressSync(mint, boost_pda, true);
            console.log('Boost Tokens Address:', boost_tokens_address.toString());

            // Create a buffer with little-endian format for the amount
            const amountBuffer = Buffer.alloc(8);
            amountBuffer.writeBigUInt64LE(amount);
            console.log('Amount Buffer:', amountBuffer);

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
                data: Buffer.concat([Buffer.from([6]), amountBuffer]) // Instruction code 6 for stake
            });

            console.log('Stake Boost Transaction Instruction:', instruction);
            return instruction;
        } catch (error) {
            console.error('Error creating stake boost instruction:', error);
            throw error;
        }
    };

    const createUnstakeBoostInstruction = async (staker, miner, mint, amount) => {
        try {
            console.log('Creating Unstake Boost Instruction...');
            const programId = new PublicKey('J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we');
            const boostProgramId = new PublicKey('boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc');

            const TOKEN_PROGRAM_ID = getTokenProgramId();
            const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

            const managed_proof_address = PublicKey.findProgramAddressSync(
                [Buffer.from("managed-proof-account"), miner.toBuffer()],
                programId
            )[0];
            console.log('Managed Proof Address:', managed_proof_address.toString());

            const delegated_boost_address = PublicKey.findProgramAddressSync(
                [Buffer.from("delegated-boost"), staker.toBuffer(), mint.toBuffer(), managed_proof_address.toBuffer()],
                programId
            )[0];
            console.log('Delegated Boost Address:', delegated_boost_address.toString());

            const boost_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("boost"), mint.toBuffer()],
                boostProgramId
            )[0];
            console.log('Boost PDA:', boost_pda.toString());

            console.log('Stake PDA:', stake_pda.toString());

            const managed_proof_token_account = getAssociatedTokenAddressSync(mint, managed_proof_address, true);
            console.log('Managed Proof Token Account:', managed_proof_token_account.toString());

            const staker_token_account = getAssociatedTokenAddressSync(mint, staker);
            console.log('Staker Token Account:', staker_token_account.toString());

            const boost_tokens_address = getAssociatedTokenAddressSync(mint, boost_pda, true);
            console.log('Boost Tokens Address:', boost_tokens_address.toString());

            // Create a buffer with little-endian format for the amount
            const amountBuffer = Buffer.alloc(8);
            amountBuffer.writeBigUInt64LE(amount);
            console.log('Amount Buffer:', amountBuffer);

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
                data: Buffer.concat([Buffer.from([7]), amountBuffer]) // Instruction code 7 for unstake
            });

            console.log('Unstake Boost Transaction Instruction:', instruction);
            return instruction;
        } catch (error) {
            console.error('Error creating unstake boost instruction:', error);
            throw error;
        }
    };

    const createInitDelegateBoostInstruction = async (staker, miner, payer, mint) => {
        try {
            console.log('Creating Init Delegate Boost Instruction...');
            const programId = new PublicKey('J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we');

            const managed_proof_address = PublicKey.findProgramAddressSync(
                [Buffer.from("managed-proof-account"), miner.toBuffer()],
                programId
            )[0];
            console.log('Managed Proof Address:', managed_proof_address.toString());

            const boost_pda = PublicKey.findProgramAddressSync(
                [Buffer.from("delegated-boost"), mint.toBuffer()],
                programId
            )[0];
            console.log('Boost PDA:', boost_pda.toString());

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: staker, isSigner: false, isWritable: true },
                    { pubkey: miner, isSigner: false, isWritable: true },
                    { pubkey: payer, isSigner: true, isWritable: true },
                    { pubkey: managed_proof_address, isSigner: false, isWritable: true },
                    { pubkey: boost_pda, isSigner: false, isWritable: true },
                    { pubkey: mint, isSigner: false, isWritable: false },
                    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
                ],
                programId: programId,
                data: Buffer.from([8]) // Instruction code 8 for init delegate boost
            });

            console.log('Init Delegate Boost Transaction Instruction:', instruction);
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

            {/* Pass the `connection` prop to WalletStatus */}
            <WalletStatus connection={connection} />

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
                            {isProcessing ? 'Processing...' : 'Stake Boost'}
                        </button>
                        <button
                            onClick={handleUnstakeBoost}
                            className="button unstake-button"
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Unstake Boost'}
                        </button>
                        <button
                            onClick={handleInitDelegateBoost}
                            className="button init-button"
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Initialize Account'}
                        </button>
                    </div>
                ) : (
                    <p className="connect-wallet-message">Please connect your wallet to stake or unstake.</p>
                )}

                {/* Display countdown timer when staking is inactive */}
                {!isStakeActive && countdown && (
                    <div className="countdown">
                        <p>Stake Boost is available next in: {countdown}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function App() {
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter()
        ],
        []
    );

    const network = process.env.RPC_URL;

    return (
        <ConnectionProvider endpoint={network}>
            <WalletProvider wallets={wallets} autoConnect={false}>
                <WalletModalProvider>
                    <AppContent />
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}

export default App;
