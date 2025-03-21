"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getBoostStakeInfo } from '../components/WalletStatus';
import {
  PublicKey,
  Connection,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { getMint, getAssociatedTokenAddressSync, withdrawWithheldTokensFromMintInstructionData } from "@solana/spl-token";
import WalletStatus from "../components/WalletStatus";
import dynamic from "next/dynamic";
import { particlesConfig, initParticles } from './components/particles';

import { Buffer } from "buffer";
import Script from "next/script";
import Image from "next/image";
import { 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import { TOKEN_LIST } from "../components/tokens";

import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

const getTokenProgramId = () =>
  new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

function AppContent() {
  const { publicKey, sendTransaction } = useWallet();
  const [amount, setAmount] = useState("");
  const [mintAddress, setMintAddress] = useState(
    "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp"
  );
  const [decimals, setDecimals] = useState(11);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStakeActive, setIsStakeActive] = useState(false);
  const [countdown, setCountdown] = useState("");

  const connection = useMemo(
    () => new Connection(process.env.NEXT_PUBLIC_RPC_URL),
    []
  );

  const miner = useMemo(
    () => new PublicKey("mineXqpDeBeMR8bPQCyy9UneJZbjFywraS3koWZ8SSH"),
    []
  );

  const NEW_BOOST_PROGRAM_ID = new PublicKey("BoosTyJFPPtrqJTdi49nnztoEWDJXfDRhyb2fha6PPy");

  useEffect(() => {
    const fetchDecimals = async () => {
      try {
        if (!mintAddress) {
          setDecimals(9);
          return;
        }
        const mintPubKey = new PublicKey(mintAddress);
        const mintInfo = await getMint(connection, mintPubKey);
        setDecimals(mintInfo.decimals);
      } catch (error) {
        console.error("Error fetching mint decimals:", error);
        setDecimals(11);
      }
    };
    fetchDecimals();
  }, [mintAddress, connection]);

  const handleBalanceClick = useCallback((tokenName, balance) => {
    const selectedToken = TOKEN_LIST.find((token) => token.name === tokenName);
    if (selectedToken && selectedToken.mintAddress) {
      setAmount(balance.toString());
      setMintAddress(selectedToken.mintAddress);
    }
  }, []);

  const getDelegatedBoostAddress = useCallback(
    async (staker, mint) => {
      const programId = new PublicKey(
        "J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we"
      );

      const managed_proof_address = PublicKey.findProgramAddressSync(
        [Buffer.from("managed-proof-account"), miner.toBuffer()],
        programId
      )[0];

      const delegated_boost_address = PublicKey.findProgramAddressSync(
        [
          Buffer.from("v2-delegated-boost"),
          staker.toBuffer(),
          mint.toBuffer(),
          managed_proof_address.toBuffer(),
        ],
        programId
      )[0];

      return delegated_boost_address;
    },
    [miner]
  );

  const MIN_BALANCE = 5000;

  const handleStakeClaim = useCallback(async () => {
    if (!publicKey) {
      toast.dismiss();
      toast.error("Please connect your wallet");
      return;
    }
  
    const pubkeyMapping = {
      "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp": "ORE",
      "DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN": "ORE-SOL LP",
      "meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb": "ORE-ISC LP"
    };
  
    try {
      setIsProcessing(true);
      const url = `https://ec1ipse.me/v2/miner/boost/stake-accounts?pubkey=${publicKey.toBase58()}`;
      let response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const datas = await response.json();
  
      let errorShown = false;
  
      await Promise.all(datas.map(async (data) => {
        const tokenName = pubkeyMapping[data.mint_pubkey] || data.mint_pubkey;
        if (data.rewards_balance >= MIN_BALANCE) {
          try {
            response = await fetch(`https://ec1ipse.me/v3/claim-stake-rewards?pubkey=${publicKey.toBase58()}&mint=${data.mint_pubkey}&amount=${data.rewards_balance}`, {
              method: "POST",
            });
            if (!response.ok) {
              if (!errorShown) {
                errorShown = true;
                toast.error("Error queueing claim request: Is a claim already queued?");
              }
            } else {
              toast.success(`Claim of ${(data.rewards_balance * 10 ** -11).toFixed(11)} ${tokenName} for rewards added to queue.`);
            }
          } catch (err) {
            console.error("Error processing claim for:", tokenName, err);
          }
        } else {
          toast.error(`Reward balance too low for ${tokenName} to claim.`);
        }
      }));
  
    } catch (error) {
      toast.dismiss();
      console.error("Error queueing claim request:", error);
      toast.error(`Claim not added to queue. Please Retry.: ${error.message || error}`);
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey]);


  















  const handleMigration = useCallback(async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet");
      return;
    }
  
    const migrateAmountFloat = parseFloat(amount);
    if (isNaN(migrateAmountFloat) || migrateAmountFloat <= 0) {
      toast.error("Please enter a valid amount to migrate.");
      return;
    }
  
    try {
      setIsProcessing(true);
      const transaction = new Transaction();
      const staker = publicKey;
      const mint = new PublicKey(mintAddress);
      const migrateAmount = BigInt(
        Math.round(migrateAmountFloat * 10 ** decimals)
      );
  
      const instructions = await createMigrationInstruction(
        staker,
        miner,
        mint,
        migrateAmount
      );
      
      instructions.forEach(instruction => transaction.add(instruction));
      
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      toast.success("Migration transaction sent successfully!");
    } catch (error) {
      console.error("Error during migration:", error);
      toast.error("Error during migration. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [
    publicKey,
    sendTransaction,
    amount,
    mintAddress,
    decimals,
    connection,
    miner
  ]);






  const createMigrationInstruction = async (staker, miner, mint, amount) => {
    try {
      const DELEGATION_PROGRAM_ID = new PublicKey("J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we");
      const OLD_BOOST_PROGRAM_ID = new PublicKey("boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc");
      const NEW_BOOST_PROGRAM_ID = new PublicKey("BoosTyJFPPtrqJTdi49nnztoEWDJXfDRhyb2fha6PPy");
      const TOKEN_PROGRAM_ID = getTokenProgramId();
  
      // PDAs for managed proof and delegated boost
      const managed_proof_address = PublicKey.findProgramAddressSync(
        [Buffer.from("managed-proof-account"), miner.toBuffer()],
        DELEGATION_PROGRAM_ID
      )[0];
  
      const delegated_boost_address = PublicKey.findProgramAddressSync(
        [
          Buffer.from("v2-delegated-boost"),
          staker.toBuffer(),
          mint.toBuffer(),
          managed_proof_address.toBuffer(),
        ],
        DELEGATION_PROGRAM_ID
      )[0];
  
      // PDAs for old boost program
      const old_boost_pda = PublicKey.findProgramAddressSync(
        [Buffer.from("boost"), mint.toBuffer()],
        OLD_BOOST_PROGRAM_ID
      )[0];
  
      const old_stake_pda = PublicKey.findProgramAddressSync(
        [
          Buffer.from("stake"),
          managed_proof_address.toBuffer(), 
          old_boost_pda.toBuffer()
        ],
        OLD_BOOST_PROGRAM_ID
      )[0];
  
      // PDAs for new boost program
      const new_boost_pda = PublicKey.findProgramAddressSync(
        [Buffer.from("boost"), mint.toBuffer()],
        NEW_BOOST_PROGRAM_ID
      )[0];
  
      const new_stake_pda = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), staker.toBuffer(), new_boost_pda.toBuffer()],
        NEW_BOOST_PROGRAM_ID
      )[0];
  
      // Get token accounts
      const managed_proof_token_account = getAssociatedTokenAddressSync(
        mint,
        managed_proof_address,
        true
      );
      const staker_token_account = getAssociatedTokenAddressSync(mint, staker);
      const old_boost_tokens_address = getAssociatedTokenAddressSync(mint, old_boost_pda, true);
      const new_boost_deposits_address = getAssociatedTokenAddressSync(mint, new_boost_pda, true);
  
      // Create amount buffer
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(amount);
  
      let instructions = [];

      // Create withdraw instruction
      const withdrawInstruction = new TransactionInstruction({
        programId: DELEGATION_PROGRAM_ID,
        keys: [
          { pubkey: staker, isSigner: true, isWritable: true },
          { pubkey: miner, isSigner: false, isWritable: false },
          { pubkey: managed_proof_address, isSigner: false, isWritable: true },
          { pubkey: managed_proof_token_account, isSigner: false, isWritable: true },
          { pubkey: delegated_boost_address, isSigner: false, isWritable: true },
          { pubkey: old_boost_pda, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: staker_token_account, isSigner: false, isWritable: true },
          { pubkey: old_boost_tokens_address, isSigner: false, isWritable: true },
          { pubkey: old_stake_pda, isSigner: false, isWritable: true },
          { pubkey: OLD_BOOST_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([Buffer.from([10]), amountBuffer])
      });
      instructions.push(withdrawInstruction);

      const stakeAccount = await connection.getAccountInfo(new_stake_pda);
      if (!stakeAccount) {
        const openInstruction = new TransactionInstruction({
          programId: NEW_BOOST_PROGRAM_ID,
          keys: [
            { pubkey: staker, isSigner: true, isWritable: true },
            { pubkey: staker, isSigner: true, isWritable: true }, // payer
            { pubkey: new_boost_pda, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: new_stake_pda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([2])
        });
        instructions.push(openInstruction);
      }
  
      const depositInstruction = new TransactionInstruction({
        programId: NEW_BOOST_PROGRAM_ID,
        keys: [
          { pubkey: staker, isSigner: true, isWritable: true },
          { pubkey: new_boost_pda, isSigner: false, isWritable: true },
          { pubkey: new_boost_deposits_address, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: staker_token_account, isSigner: false, isWritable: true },
          { pubkey: new_stake_pda, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([Buffer.from([1]), amountBuffer])
      });
      instructions.push(depositInstruction);
  
      return instructions;
    } catch (error) {
      throw error;
    }
  };









  const handleOreClaim = useCallback(async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet");
      return;
    }
  
    try {
      setIsProcessing(true);
      
      // First check if ORE token account exists
      const ORE_MINT = new PublicKey("oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp");
      const oreTokenAccount = getAssociatedTokenAddressSync(ORE_MINT, publicKey);
      const accountInfo = await connection.getAccountInfo(oreTokenAccount);
  
      const transaction = new Transaction();
  
      // If ORE token account doesn't exist, create it first
      if (!accountInfo) {
        console.log("Creating ORE token account");
        const createTokenAccountIx = createAssociatedTokenAccountInstruction(
          publicKey,
          oreTokenAccount,
          publicKey,
          ORE_MINT,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(createTokenAccountIx);
      }
  
      // Get stake info and create claim instructions
      const stakeInfo = await getBoostStakeInfo(connection, publicKey);
      const tokensWithRewards = stakeInfo.filter(info => info.stake?.rewards > 0);
      
      if (tokensWithRewards.length === 0) {
        toast.error("No rewards available to claim");
        return;
      }
  
      console.log("Found rewards for tokens:", tokensWithRewards);
  
      // Add claim instructions
      for (const info of tokensWithRewards) {
        const mint = new PublicKey(info.mint);
        const rewardsAmount = BigInt(Math.floor(info.stake.rewards * Math.pow(10, 11)));
        
        const claimIx = await createClaimInstruction(
          publicKey,
          mint,
          rewardsAmount
        );
        
        transaction.add(claimIx);
      }
  
      console.log("Sending transaction with", transaction.instructions.length, "instructions");
      
      const signature = await sendTransaction(transaction, connection);
      console.log("Transaction sent:", signature);
      
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
  
      toast.success("Successfully claimed rewards!");
    } catch (error) {
      console.error("Detailed error:", error);
      if (error.message?.includes("insufficient funds")) {
        toast.error("Insufficient SOL for transaction");
      } else {
        toast.error(`Error claiming rewards: ${error.message || "Unknown error"}`);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, sendTransaction, connection]);
  
  const createClaimInstruction = async (signer, mint, amount) => {
    try {
      const NEW_BOOST_PROGRAM_ID = new PublicKey("BoosTyJFPPtrqJTdi49nnztoEWDJXfDRhyb2fha6PPy");
      const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      const ORE_MINT = new PublicKey("oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp");
  
      // PDAs for boost program
      const [boost_pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("boost"), mint.toBuffer()],
        NEW_BOOST_PROGRAM_ID
      );
  
      const [stake_pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), signer.toBuffer(), boost_pda.toBuffer()],
        NEW_BOOST_PROGRAM_ID
      );
  
      // Get token accounts
      const beneficiary_token_account = getAssociatedTokenAddressSync(ORE_MINT, signer);
      const boost_rewards_address = getAssociatedTokenAddressSync(ORE_MINT, boost_pda, true);
  
      console.log("Creating claim instruction for:", {
        programId: NEW_BOOST_PROGRAM_ID.toBase58(),
        signer: signer.toBase58(),
        beneficiaryAccount: beneficiary_token_account.toBase58(),
        boostPda: boost_pda.toBase58(),
        boostRewards: boost_rewards_address.toBase58(),
        stakePda: stake_pda.toBase58(),
        tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
        amount: amount.toString()
      });
  
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(amount);
  
      const instruction = new TransactionInstruction({
        programId: NEW_BOOST_PROGRAM_ID,
        keys: [
          { pubkey: signer, isSigner: true, isWritable: true },
          { pubkey: beneficiary_token_account, isSigner: false, isWritable: true },
          { pubkey: boost_pda, isSigner: false, isWritable: false },
          { pubkey: boost_rewards_address, isSigner: false, isWritable: true },
          { pubkey: stake_pda, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
        ],
        data: Buffer.concat([Buffer.from([0]), amountBuffer])
      });
  
      return instruction;
    } catch (error) {
      console.error("Error in createClaimInstruction:", error);
      throw error;
    }
  };









  const handleOreStake = useCallback(async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet");
      return;
    }
  
    const stakeAmountFloat = parseFloat(amount);
    if (isNaN(stakeAmountFloat) || stakeAmountFloat <= 0) {
      toast.error("Please enter a valid amount to stake.");
      return;
    }
  
    try {
      setIsProcessing(true);
      const transaction = new Transaction();
      const staker = publicKey;
      const mint = new PublicKey(mintAddress);
      const stakeAmount = BigInt(
        Math.round(stakeAmountFloat * 10 ** decimals)
      );
  
      const instructions = await createOreStakeInstruction(
        staker,
        mint,
        stakeAmount
      );
      
      instructions.forEach(instruction => transaction.add(instruction));
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      toast.success("Stake transaction sent successfully!");
    } catch (error) {
      console.error("Error during staking:", error);
      toast.error("Error during staking. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [
    publicKey,
    sendTransaction,
    amount,
    mintAddress,
    decimals,
    connection
  ]);



  const createOreStakeInstruction = async (staker, mint, amount) => {
    try {
      const NEW_BOOST_PROGRAM_ID = new PublicKey("BoosTyJFPPtrqJTdi49nnztoEWDJXfDRhyb2fha6PPy");
      const TOKEN_PROGRAM_ID = getTokenProgramId();
  
      // PDAs for new boost program
      const new_boost_pda = PublicKey.findProgramAddressSync(
        [Buffer.from("boost"), mint.toBuffer()],
        NEW_BOOST_PROGRAM_ID
      )[0];
  
      const new_stake_pda = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), staker.toBuffer(), new_boost_pda.toBuffer()],
        NEW_BOOST_PROGRAM_ID
      )[0];
  
      // Get token accounts
      const staker_token_account = getAssociatedTokenAddressSync(mint, staker);
      const new_boost_deposits_address = getAssociatedTokenAddressSync(mint, new_boost_pda, true);
  
      // Create amount buffer
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(amount);
  
      let instructions = [];

      // Check if stake account exists, if not create it
      const stakeAccount = await connection.getAccountInfo(new_stake_pda);
      if (!stakeAccount) {
        const openInstruction = new TransactionInstruction({
          programId: NEW_BOOST_PROGRAM_ID,
          keys: [
            { pubkey: staker, isSigner: true, isWritable: true },
            { pubkey: staker, isSigner: true, isWritable: true }, // payer
            { pubkey: new_boost_pda, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: new_stake_pda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([2]) // Open discriminator
        });
        instructions.push(openInstruction);
      }
  
      // Create deposit instruction
      const depositInstruction = new TransactionInstruction({
        programId: NEW_BOOST_PROGRAM_ID,
        keys: [
          { pubkey: staker, isSigner: true, isWritable: true },
          { pubkey: new_boost_pda, isSigner: false, isWritable: true },
          { pubkey: new_boost_deposits_address, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: staker_token_account, isSigner: false, isWritable: true },
          { pubkey: new_stake_pda, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([Buffer.from([1]), amountBuffer]) // Deposit discriminator + amount
      });
      instructions.push(depositInstruction);
  
      return instructions;
    } catch (error) {
      throw error;
    }
  };


  



  async function getAccountsData(connection, publicKey) {
    // Build array of all accounts we need to fetch
    const accountsToFetch = [];
    
    // Add token accounts
    TOKEN_LIST.forEach(token => {
        if (token.mintAddress) {  // Skip SOL
            const mintPublicKey = new PublicKey(token.mintAddress);
            const tokenAccount = getAssociatedTokenAddressSync(
                mintPublicKey,
                publicKey,
                false,
                TOKEN_PROGRAM_ID
            );
            accountsToFetch.push(tokenAccount);
        }
    });

    // Add boost and stake accounts
    const BOOST_MINTS = [
        '8H8rPiWW4iTFCfEkSnf7jpqeNpFfvdH9gLouAL3Fe2Zx',
        'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN',
        '7G3dfZkSk1HpDGnyL37LMBbPEgT4Ca6vZmZPUyi2syWt',
        'meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb',
        'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp',
    ];

    BOOST_MINTS.forEach(mintAddress => {
        const mint = new PublicKey(mintAddress);
        const [boostAddress] = findBoostPDA(mint);
        const [stakeAddress] = findStakePDA(publicKey, boostAddress);
        accountsToFetch.push(boostAddress);
        accountsToFetch.push(stakeAddress);
    });

    // Get SOL balance in same batch by adding publicKey
    accountsToFetch.push(publicKey);

    // Fetch all accounts in one request
    const accounts = await connection.getMultipleAccountsInfo(accountsToFetch);

    // Process results
    const results = {
        tokenBalances: {},
        boostStakeInfo: [],
        solBalance: 0
    };

    let accountIndex = 0;

    // Process token accounts
    TOKEN_LIST.forEach(token => {
        if (token.mintAddress) {
            const accountInfo = accounts[accountIndex++];
            if (accountInfo) {
                // Parse token account data
                const data = Buffer.from(accountInfo.data);
                // You'll need to implement parseTokenAccount based on SPL token account layout
                const amount = parseTokenAccount(data);
                results.tokenBalances[token.name] = amount;
            } else {
                results.tokenBalances[token.name] = 0;
            }
        }
    });

    // Process boost and stake accounts
    BOOST_MINTS.forEach(mintAddress => {
        const boostAccount = accounts[accountIndex++];
        const stakeAccount = accounts[accountIndex++];
        
        if (boostAccount && stakeAccount) {
            const boost = decodeBoost(boostAccount.data);
            const stake = decodeStake(stakeAccount.data, mintAddress);
            
            results.boostStakeInfo.push({
                mint: mintAddress,
                boost,
                stake
            });
        }
    });

    // Process SOL balance
    const solAccount = accounts[accountIndex];
    if (solAccount) {
        results.solBalance = solAccount.lamports / 1e9;
    }

    return results;
}

function parseTokenAccount(data) {
  const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // Token account amount is at offset 64
  const amount = dataView.getBigUint64(64, true);
  return Number(amount);
}




  const handleOreUnstake = useCallback(async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet");
      return;
    }
  
    const unstakeAmountFloat = parseFloat(amount);
    if (isNaN(unstakeAmountFloat) || unstakeAmountFloat <= 0) {
      toast.error("Please enter a valid amount to unstake.");
      return;
    }
  
    try {
      setIsProcessing(true);
      const transaction = new Transaction();
      const withdrawer = publicKey;
      const mint = new PublicKey(mintAddress);
      const withdrawAmount = BigInt(
        Math.round(unstakeAmountFloat * 10 ** decimals)
      );
  
      const withdrawInstruction = await createOreUnstake(
        withdrawer,
        mint,
        withdrawAmount
      );
      
      transaction.add(withdrawInstruction);

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");  
      toast.success("Withdrawal transaction sent successfully!");
    } catch (error) {
      console.error("Error during withdrawal:", error);
      toast.error("Error during withdrawal. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [
    publicKey,
    sendTransaction,
    amount,
    mintAddress,
    decimals,
    connection
  ]);
  



const createOreUnstake = async (withdrawer, mint, amount) => {
    try {
      const NEW_BOOST_PROGRAM_ID = new PublicKey("BoosTyJFPPtrqJTdi49nnztoEWDJXfDRhyb2fha6PPy");
      const TOKEN_PROGRAM_ID = getTokenProgramId();
  
      // PDAs for new boost program
      const new_boost_pda = PublicKey.findProgramAddressSync(
        [Buffer.from("boost"), mint.toBuffer()],
        NEW_BOOST_PROGRAM_ID
      )[0];
  
      const new_stake_pda = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), withdrawer.toBuffer(), new_boost_pda.toBuffer()],
        NEW_BOOST_PROGRAM_ID
      )[0];
  
      // Get token accounts
      const withdrawer_token_account = getAssociatedTokenAddressSync(mint, withdrawer);
      const new_boost_deposits_address = getAssociatedTokenAddressSync(mint, new_boost_pda, true);
  
      // Create amount buffer
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(amount);
  
      // Create withdraw instruction
      const withdrawInstruction = new TransactionInstruction({
        programId: NEW_BOOST_PROGRAM_ID,
        keys: [
          { pubkey: withdrawer, isSigner: true, isWritable: true },
          { pubkey: withdrawer_token_account, isSigner: false, isWritable: true },
          { pubkey: new_boost_pda, isSigner: false, isWritable: true },
          { pubkey: new_boost_deposits_address, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: new_stake_pda, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([Buffer.from([6]), amountBuffer]) // Withdraw discriminator (6) + amount
      });
  
      return withdrawInstruction;
    } catch (error) {
      throw error;
    }
  };





  










  const handleUnstakeBoost = useCallback(async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet");
      return;
    }

    const unstakeAmountFloat = parseFloat(amount);
    if (isNaN(unstakeAmountFloat) || unstakeAmountFloat <= 0) {
      toast.error("Please enter a valid amount to unstake.");
      return;
    }

    try {
      setIsProcessing(true);
      const transaction = new Transaction();
      const staker = publicKey;
      const mint = new PublicKey(mintAddress);

      // Get the full staked balance before unstaking
      const [boostAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("boost"), mint.toBuffer()],
        new PublicKey("boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc")
      );
      
      const [stakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), publicKey.toBuffer(), boostAddress.toBuffer()],
        new PublicKey("boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc")
      );

      const stakeAccountInfo = await connection.getAccountInfo(stakePda);
      if (!stakeAccountInfo) {
        throw new Error("Stake account not found");
      }

      // Calculate the actual unstake amount
      let unstakeAmount = BigInt(Math.round(unstakeAmountFloat * 10 ** decimals));
      
      // If trying to unstake full amount, show warning and adjust
      const currentBalance = BigInt(Math.round(unstakeAmountFloat * 10 ** decimals));
      if (unstakeAmount >= currentBalance) {
        toast.info("A small amount will be left in the account for rent-exempt minimum");
        unstakeAmount = unstakeAmount - BigInt(2000000); // Adjust rent-exempt minimum as needed
      }

      const instruction = await createUnstakeBoostInstruction(
        staker,
        miner,
        mint,
        unstakeAmount
      );
      transaction.add(instruction);

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      toast.success("Unstake transaction sent successfully!");
    } catch (error) {
      console.error("Error unstaking boost:", error);
      if (error.message?.includes("rent-exempt")) {
        toast.error("Please leave a small amount for account rent");
      } else {
        toast.error("Error confirming unstaking boost. Please review totals for confirmation.");
      }
    } finally {
      setIsProcessing(false);
    }
}, [
    publicKey,
    sendTransaction,
    amount,
    mintAddress,
    decimals,
    miner,
    connection,
]);

const createUnstakeBoostInstruction = async (staker, miner, mint, amount) => {
  try {
    const programId = new PublicKey(
      "J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we"
    );
    const boostProgramId = new PublicKey(
      "boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc"
    );

    const TOKEN_PROGRAM_ID = getTokenProgramId();
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    );

    // Get the current stake account info
    const [boostPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("boost"), mint.toBuffer()],
      boostProgramId
    );

    const managed_proof_address = PublicKey.findProgramAddressSync(
      [Buffer.from("managed-proof-account"), miner.toBuffer()],
      programId
    )[0];

    const delegated_boost_address = PublicKey.findProgramAddressSync(
      [
        Buffer.from("v2-delegated-boost"),
        staker.toBuffer(),
        mint.toBuffer(),
        managed_proof_address.toBuffer(),
      ],
      programId
    )[0];

    const boost_pda = PublicKey.findProgramAddressSync(
      [Buffer.from("boost"), mint.toBuffer()],
      boostProgramId
    )[0];

    const stake_pda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("stake"),
        managed_proof_address.toBuffer(),
        boost_pda.toBuffer(),
      ],
      boostProgramId
    )[0];

    const managed_proof_token_account = getAssociatedTokenAddressSync(
      mint,
      managed_proof_address,
      true
    );
    const staker_token_account = getAssociatedTokenAddressSync(mint, staker);
    const boost_tokens_address = getAssociatedTokenAddressSync(
      mint,
      boost_pda,
      true
    );

    // Check if amount needs adjustment for rent-exempt minimum
    const stakeAccountInfo = await connection.getAccountInfo(stake_pda);
    if (!stakeAccountInfo) {
      throw new Error("Stake account not found");
    }

    // Create amount buffer with potentially adjusted amount
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
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: programId,
      data: Buffer.concat([Buffer.from([10]), amountBuffer]),
    });

    return instruction;
  } catch (error) {
    throw error;
  }
};

  const formatBalanceApp = (balance) => {
    const num = Number(balance);
    return !isNaN(num) ? num.toFixed(2) : "0.00";
  };

  return (
    <>
      <div id="tsparticles"></div>

<Script
  src="https://www.googletagmanager.com/gtag/js?id=G-Y6S4ZYT334"
  strategy="afterInteractive"
/>
<Script id="google-analytics" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-Y6S4ZYT334');
  `}
</Script>

<Script
  src="https://cdn.jsdelivr.net/npm/tsparticles@2.11.1/tsparticles.bundle.min.js"
  strategy="afterInteractive"
  onLoad={initParticles}
/>

<div className="container">
  <header className="header">
    <div className="logo-title-container">
      <div className="logo-container">
        <Image
          src="/eclipse-icon.png"
          alt="Ec1ipse Stake Logo"
          width={150}
          height={50}
          className="logo"
        />
      </div>
      <h1 className="site-title">
        <span>Ec1ipse</span><span>Staking</span>
      </h1>
    </div>
    <WalletMultiButton className="wallet-button" />
  </header>

  <nav className="nav-links">
    <a
      href="https://stats.ec1ipse.me/"
      className="nav-link"
      target="_blank"
      rel="noopener noreferrer"
    >
      Ec1ipse Stats
    </a>
    </nav>

<div className="warning-banner">
  <h1 className="warning-text">Ec1ipse Staking Website will no longer function after 4/20/2025. Please claim all staked balances now.</h1>
</div>

<div className="balances-section">
    <WalletStatus
      connection={connection}
      onBalanceClick={handleBalanceClick}
      onStakeClaim={handleStakeClaim}
      isProcessing={isProcessing}
    />

    <hr className="separator" />
  </div>
  <div className="card">
    <p className="stake-message">
      Stake Boost is no longer available. To continue earning staking rewards, please utilize the buttons below!
    </p>
    <div className="input-group">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Enter amount"
        className="amount-input"
        min="0"
        step="any"
        disabled={isProcessing}
      />
    </div>

    <div className="input-group">
      <select
        value={mintAddress || ""}
        onChange={(e) => setMintAddress(e.target.value || null)}
        className="select-token"
      >
        {TOKEN_LIST.filter((token) => token.mintAddress).map((token) => (
          <option key={token.name} value={token.mintAddress}>
            {token.name}
          </option>
        ))}
      </select>
    </div>
    {publicKey ? (
      <div className="button-container">
        <div className="button-group eclipse-buttons">
          <button
            onClick={handleUnstakeBoost}
            className="button unstake-button"
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Unstake (Ec1ipse)"}
          </button>
          {/* <button
            onClick={handleMigration}
            className="button migrate-button"
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Migrate"}
          </button> */}
        </div>
       
    <div className="button-group ore-buttons">
      <a 
        href="https://beta.ore.supply/stake" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="button ore-supply-button"
      >
        Beta.Ore.Supply
      </a>
    </div>
    
    <p className="stake-message-buttons">
      Unstake (Ec1ipse) unstakes your selected tokens from Ec1ipse.<br />
      Visit Beta.Ore.Supply for all your Global Staking needs using the button above.
    </p>
  </div>
    ) : (
      <p className="connect-wallet-message">
        Please connect your wallet to unstake.
      </p>
    )}
  </div>
</div>
<ToastContainer
  position="bottom-left"
  autoClose={6000}
  hideProgressBar={false}
  newestOnTop={false}
  rtl={false}
  pauseOnFocusLoss
  draggable={false}
  pauseOnHover
  theme="color"
/>
</>
);
}

export default AppContent;