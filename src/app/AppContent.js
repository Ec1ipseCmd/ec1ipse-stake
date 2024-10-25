"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  Connection,
  Transaction,
} from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import WalletStatus from "./components/WalletStatus";       // Correct import path and default import
import StakingTimer from "./components/StakingTimer";
import Header from "./components/Header";
import ManageStake from "./components/ManageStake";
import ParticlesBackground from "./components/ParticlesBackground";
import {
  getDelegatedBoostAddress,
  createStakeBoostInstruction,
  createUnstakeBoostInstruction,
  createInitDelegateBoostInstruction,
} from "./utils/stakingUtils";

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

  // Initialize Solana connection
  const connection = useMemo(
    () => new Connection(process.env.NEXT_PUBLIC_RPC_URL),
    []
  );

  // Define the miner's public key
  const miner = useMemo(
    () => new PublicKey("mineXqpDeBeMR8bPQCyy9UneJZbjFywraS3koWZ8SSH"),
    []
  );

  // Fetch token decimals whenever mintAddress changes
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

  /**
   * Handles staking tokens.
   */
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

      const programId = new PublicKey("J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we");
      const boostProgramId = new PublicKey("boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc");

      const delegated_boost_address = await getDelegatedBoostAddress(
        staker,
        mint,
        miner,
        programId
      );

      const accountInfo = await connection.getAccountInfo(
        delegated_boost_address
      );
      if (!accountInfo) {
        const initInstruction = await createInitDelegateBoostInstruction(
          staker,
          miner,
          staker,
          mint,
          programId,
          boostProgramId
        );
        transaction.add(initInstruction);
      }

      const stakeInstruction = await createStakeBoostInstruction(
        staker,
        miner,
        mint,
        stakeAmount,
        programId,
        boostProgramId
      );
      transaction.add(stakeInstruction);

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      if (!accountInfo) {
        alert(
          "Boost account initialized and stake transaction sent successfully!"
        );
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
  ]);

  /**
   * Handles unstaking tokens.
   */
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

      const programId = new PublicKey("J6XAzG8S5KmoBM8GcCFfF8NmtzD7U3QPnbhNiYwsu9we");
      const boostProgramId = new PublicKey("boostmPwypNUQu8qZ8RoWt5DXyYSVYxnBXqbbrGjecc");

      const instruction = await createUnstakeBoostInstruction(
        staker,
        miner,
        mint,
        unstakeAmount,
        programId,
        boostProgramId
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

  /**
   * Formats the balance to four decimal places.
   */
  const formatBalance = (balance) => {
    if (balance === null || balance === undefined) return "0.0000";
    return balance.toFixed(4);
  };

  return (
    <>
      {/* Particle Background */}
      <ParticlesBackground />

      <div className="container">
        {/* Header Section */}
        <Header />

        {/* Wallet Status Section */}
        <div className="balances-section">
          <WalletStatus connection={connection} />
          <hr className="separator" />
        </div>

        {/* Staking Timer */}
        <StakingTimer
          isStakeActive={isStakeActive}
          setIsStakeActive={setIsStakeActive}
          countdown={countdown}
          setCountdown={setCountdown}
        />

        {/* Manage Stake */}
        <ManageStake
          amount={amount}
          setAmount={setAmount}
          mintAddress={mintAddress}
          setMintAddress={setMintAddress}
          TOKEN_LIST={TOKEN_LIST}
          handleStakeBoost={handleStakeBoost}
          handleUnstakeBoost={handleUnstakeBoost}
          isProcessing={isProcessing}
          isStakeActive={isStakeActive}
          publicKey={publicKey}
        />
      </div>
    </>
  );
}

export default AppContent;
