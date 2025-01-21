"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
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

  const MIN_BALANCE = 5_000_000_000;

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
      console.log("datas", datas);
  
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
        miner,  // Add miner parameter here
        mint,
        migrateAmount
      );
      
      // Add all instructions to the transaction
      instructions.forEach(instruction => transaction.add(instruction));
      
      console.log("sending transaction");
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("SENT transaction");

      toast.success("Migration transaction sent successfully!");
    } catch (error) {
      console.error("Error during migration:", error);
      toast.error("Error during migration. Please review totals for confirmation.");
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
    miner,  // Add miner to dependencies
  ]);

  const createMigrationInstruction = async (staker, miner, mint, amount) => {
    try {
      const DELEGATION_PROGRAM_ID = new PublicKey("J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we");
      const OLD_BOOST_PROGRAM_ID = new PublicKey("boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc");
      const NEW_BOOST_PROGRAM_ID = new PublicKey("BoosTyJFPPtrqJTdi49nnztoEWDJXfDRhyb2fha6PPy");
      const TOKEN_PROGRAM_ID = getTokenProgramId();
  
      // PDAs for managed proof and delegated boost (using delegation program)
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
  
      // PDAs for old boost program (for withdrawal)
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
  
      // PDAs for new boost program (for open/deposit)
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
  
      // Create withdraw instruction using delegation program (discriminator: 10)
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
  
      // Create open instruction using new boost program

      let instructions = [withdrawInstruction];
      try {
        await connection.getAccountInfo(new_stake_pda);
      } catch (error) {
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
  
      // Create deposit instruction using new boost program

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







  const handleFinalStake = useCallback(async () => {
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
  
      const instructions = await createStakeInstruction(
        staker,
        mint,
        stakeAmount
      );
      
      instructions.forEach(instruction => transaction.add(instruction));
      
      console.log("sending transaction");
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");
      console.log("SENT transaction");

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

  const createStakeInstruction = async (staker, mint, amount) => {
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
      try {
        await connection.getAccountInfo(new_stake_pda);
      } catch (error) {
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
      const unstakeAmount = BigInt(
        Math.round(unstakeAmountFloat * 10 ** decimals)
      );

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
      toast.error("Error confirming unstaking boost. Please review totals for confirmation.");
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
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(amount);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: staker, isSigner: true, isWritable: true },
          { pubkey: miner, isSigner: false, isWritable: false },
          { pubkey: managed_proof_address, isSigner: false, isWritable: true },
          { pubkey: managed_proof_token_account,isSigner: false,isWritable: true },
          { pubkey: delegated_boost_address,isSigner: false,isWritable: true },
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
      <div className="button-group">
        <button
          onClick={handleUnstakeBoost}
          className="button unstake-button"
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Unstake (Ec1ipse)"}
        </button>
        <button
          onClick={handleMigration}
          className="button migrate-button"
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Migrate (Ec1ipse → ORE)"}
        </button>
        <button
          onClick={handleFinalStake}
          className="button migrate-button"
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Stake (ORE)"}
        </button>
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