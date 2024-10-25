"use client";

import React from "react";

const ManageStake = ({
  amount,
  setAmount,
  mintAddress,
  setMintAddress,
  TOKEN_LIST,
  handleStakeBoost,
  handleUnstakeBoost,
  isProcessing,
  isStakeActive,
  publicKey,
}) => (
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
);

export default ManageStake;
