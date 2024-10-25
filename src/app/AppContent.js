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
import { getMint, getAssociatedTokenAddressSync } from "@solana/spl-token";
import WalletStatus from "../components/WalletStatus";
import StakingTimer from "../components/StakingTimer";
import dynamic from "next/dynamic";

import { Buffer } from "buffer";
import { NightlyWalletAdapter } from "@solana/wallet-adapter-wallets";
import Script from "next/script";
import Image from "next/image";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

const TOKEN_LIST = [
  { name: "SOL", mintAddress: null },
  { name: "ORE", mintAddress: "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp" },
  {
    name: "ORE-SOL LP",
    mintAddress: "DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN",
  },
  {
    name: "ORE-ISC LP",
    mintAddress: "meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb",
  },
];

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

  const getDelegatedBoostAddress = useCallback(async (staker, mint) => {
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
  }, [miner]);
  
  const handleStakeBoost = useCallback(async () => {
    if (!publicKey) {
      alert("Please connect your wallet");
      return;
    }
  
    const stakeAmountFloat = parseFloat(amount);
    if (isNaN(stakeAmountFloat) || stakeAmountFloat <= 0) {
      alert("Please enter a valid amount to stake.");
      return;
    }
  
    try {
      setIsProcessing(true);
      const transaction = new Transaction();
      const staker = publicKey;
      const mint = new PublicKey(mintAddress);
      const stakeAmount = BigInt(Math.round(stakeAmountFloat * 10 ** decimals));
  
      const delegated_boost_address = await getDelegatedBoostAddress(
        staker,
        mint
      );
  
      const accountInfo = await connection.getAccountInfo(
        delegated_boost_address
      );
      if (!accountInfo) {
        const initInstruction = await createInitDelegateBoostInstruction(
          staker,
          miner,
          staker,
          mint
        );
        transaction.add(initInstruction);
      }
  
      const stakeInstruction = await createStakeBoostInstruction(
        staker,
        miner,
        mint,
        stakeAmount
      );
      transaction.add(stakeInstruction);
  
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");
  
      if (!accountInfo) {
        alert("Boost account initialized and stake transaction sent successfully!");
      } else {
        alert("Stake transaction sent successfully!");
      }
    } catch (error) {
      console.error("Error staking boost:", error);
      alert(`Error staking boost: ${error.message || error}`);
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
    getDelegatedBoostAddress // Now the wrapped function dependency
  ]);
  

  const handleUnstakeBoost = useCallback(async () => {
    if (!publicKey) {
      alert("Please connect your wallet");
      return;
    }

    const unstakeAmountFloat = parseFloat(amount);
    if (isNaN(unstakeAmountFloat) || unstakeAmountFloat <= 0) {
      alert("Please enter a valid amount to unstake.");
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

      alert("Unstake transaction sent successfully!");
    } catch (error) {
      console.error("Error unstaking boost:", error);
      alert("Error unstaking boost. See console for details.");
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

  const handleBoostTransaction = useCallback(async () => {
    if (!publicKey) {
      alert("Please connect your wallet");
      return;
    }

    try {
      setIsProcessing(true);
      const staker = publicKey;
      const mint = new PublicKey(mintAddress);

      const apiUrl = `https://ec1ipse.me/miner/boost/stake?pubkey=${publicKey.toBase58()}&mint=${mintAddress}`;
      const response = await fetch(apiUrl);

      let boostAmountFloat = 0;

      if (response.ok) {
        const amountText = await response.text();
        const parsedAmount = parseFloat(amountText);
        if (!isNaN(parsedAmount) && parsedAmount > 0) {
          boostAmountFloat = parsedAmount;
        } else {
          console.warn(
            "Invalid staked amount fetched from the server. Defaulting to zero."
          );
        }
      } else {
        console.warn(
          `Failed to fetch staked amount: ${response.statusText}. Defaulting to zero.`
        );
      }

      console.log(`Boost Amount Float: ${boostAmountFloat}`);

      const amountBigInt = BigInt(
        Math.round(boostAmountFloat * 10 ** decimals)
      );
      console.log(`Amount BigInt: ${amountBigInt}`);

      const transaction = new Transaction();

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

      const accountInfo = await connection.getAccountInfo(
        delegated_boost_address
      );
      if (!accountInfo) {
        const initInstruction = await createInitDelegateBoostInstruction(
          staker,
          miner,
          staker,
          mint
        );
        transaction.add(initInstruction);
      }

      if (boostAmountFloat > 0) {
        const migrateInstruction = await createMigrateInstruction(
          staker,
          miner,
          mint
        );
        transaction.add(migrateInstruction);
      } else {
        console.warn(
          "Boost amount is zero. Skipping unstake and stake instructions."
        );
      }

      if (transaction.instructions.length > 0) {
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");
        console.log("Transaction Sent and Confirmed");

        if (boostAmountFloat > 0) {
          alert("Boost transaction completed successfully!");
        } else {
          alert("No boost transaction performed as the staked amount is zero.");
        }
      } else {
        alert("No valid boost transaction to perform.");
      }
    } catch (error) {
      console.error("Error performing boost transaction:", error);
      alert(`Error performing boost transaction: ${error.message || error}`);
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, sendTransaction, mintAddress, decimals, miner, connection]);

  const createStakeBoostInstruction = async (staker, miner, mint, amount) => {
    try {
      const programId = new PublicKey(
        "J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we"
      );
      const boostProgramId = new PublicKey(
        "boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc"
      );

      const TOKEN_PROGRAM_ID = getTokenProgramId();

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
          {
            pubkey: managed_proof_token_account,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: delegated_boost_address,
            isSigner: false,
            isWritable: true,
          },
          { pubkey: boost_pda, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: staker_token_account, isSigner: false, isWritable: true },
          { pubkey: boost_tokens_address, isSigner: false, isWritable: true },
          { pubkey: stake_pda, isSigner: false, isWritable: true },
          { pubkey: boostProgramId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: programId,
        data: Buffer.concat([Buffer.from([9]), amountBuffer]),
      });

      return instruction;
    } catch (error) {
      throw error;
    }
  };

  const createMigrateInstruction = async (staker, miner, mint) => {
    try {
      const programId = new PublicKey(
        "J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we"
      );
      const boostProgramId = new PublicKey(
        "boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc"
      );

      const managed_proof_address = PublicKey.findProgramAddressSync(
        [Buffer.from("managed-proof-account"), miner.toBuffer()],
        programId
      )[0];

      const delegated_boost_address_v2 = PublicKey.findProgramAddressSync(
        [
          Buffer.from("v2-delegated-boost"),
          staker.toBuffer(),
          mint.toBuffer(),
          managed_proof_address.toBuffer(),
        ],
        programId
      )[0];

      const delegated_boost_address = PublicKey.findProgramAddressSync(
        [
          Buffer.from("delegated-boost"),
          staker.toBuffer(),
          mint.toBuffer(),
          managed_proof_address.toBuffer(),
        ],
        programId
      )[0];

      const instruction_v1 = new TransactionInstruction({
        keys: [
          { pubkey: staker, isSigner: true, isWritable: true },
          { pubkey: miner, isSigner: false, isWritable: false },
          { pubkey: managed_proof_address, isSigner: false, isWritable: true },
          {
            pubkey: delegated_boost_address,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: delegated_boost_address_v2,
            isSigner: false,
            isWritable: true,
          },
          { pubkey: mint, isSigner: false, isWritable: false },
        ],
        programId: programId,
        data: Buffer.from([12]),
      });

      return instruction_v1;
    } catch (error) {
      console.error("Error creating unstake boost instruction v1:", error);
      throw error;
    }
  };

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
          {
            pubkey: managed_proof_token_account,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: delegated_boost_address,
            isSigner: false,
            isWritable: true,
          },
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
      console.error("Error creating unstake boost instruction:", error);
      throw error;
    }
  };

  const createInitDelegateBoostInstruction = async (
    staker,
    miner,
    payer,
    mint
  ) => {
    try {
      const programId = new PublicKey(
        "J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we"
      );
      const boostProgramId = new PublicKey(
        "boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc"
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

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: staker, isSigner: false, isWritable: true },
          { pubkey: miner, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: managed_proof_address, isSigner: false, isWritable: true },
          {
            pubkey: delegated_boost_address,
            isSigner: false,
            isWritable: true,
          },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: programId,
        data: Buffer.from([11]),
      });

      return instruction;
    } catch (error) {
      console.error("Error creating init delegate boost instruction:", error);
      throw error;
    }
  };

  const formatBalance = (balance) => {
    if (balance === null || balance === undefined) return "0.0000";
    return balance.toFixed(4);
  };

  const particlesConfig = {
    background: {
      color: {
        value: "#121212",
      },
    },
    fpsLimit: 60,
    interactivity: {
      events: {
        onHover: {
          enable: false,
          mode: "repulse",
        },
        onClick: {
          enable: true,
          mode: "push",
        },
        resize: true,
      },
      modes: {
        repulse: {
          distance: 100,
          duration: 0.4,
        },
        push: {
          quantity: 4,
        },
      },
    },
    particles: {
      color: {
        value: "#e0e0e0",
      },
      links: {
        enable: false,
      },
      collisions: {
        enable: false,
      },
      move: {
        direction: "none",
        enable: true,
        outModes: {
          default: "bounce",
        },
        random: true,
        speed: 0.7,
        straight: false,
      },
      number: {
        density: {
          enable: true,
          area: 800,
        },
        value: 100,
      },
      opacity: {
        value: 0.5,
        random: true,
      },
      shape: {
        type: "circle",
      },
      size: {
        value: { min: 1, max: 6 },
      },
    },
    detectRetina: true,
  };

  const initParticles = () => {
    if (window.tsParticles) {
      window.tsParticles.load("tsparticles", particlesConfig);
    } else {
      console.error("tsParticles not loaded");
    }
  };

  return (
    <>
      <div id="tsparticles"></div>

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
  <span>Ec1ipse</span> <span>Staking</span>
</h1>
          </div>
          <WalletMultiButton className="wallet-button" />
        </header>

        <div className="balances-section">
          <WalletStatus connection={connection} />

          <hr className="separator" />
        </div>

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
              disabled={isProcessing && !isStakeActive}
            />
          </div>

          <div className="input-group">
            <select
              value={mintAddress}
              onChange={(e) => setMintAddress(e.target.value)}
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
                onClick={handleStakeBoost}
                className={`button stake-button ${
                  isStakeActive ? "active" : "inactive"
                }`}
                disabled={!isStakeActive || isProcessing}
              >
                {isProcessing ? "Processing..." : "Stake Boost"}
              </button>
              <button
                onClick={handleUnstakeBoost}
                className="button unstake-button"
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Unstake Boost"}
              </button>
            </div>
          ) : (
            <p className="connect-wallet-message">
              Please connect your wallet to stake or unstake.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default AppContent;