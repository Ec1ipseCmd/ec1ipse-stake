"use client";

import "../styles.css";
import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { TOKEN_LIST } from "./tokens";
import { toast } from "react-toastify";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const formatPubkey = (pubkey) => {
  if (!pubkey || pubkey.length < 8) return pubkey;
  return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
};

const formatBalance = (balance) => {
  const num = Number(balance);
  return !isNaN(num) && num !== 0 ? num.toFixed(11) : "0.00";
};

const WalletBalances = memo(({ publicKey, connection, onBalanceClick, refreshCount }) => {
  const [balances, setBalances] = useState({});
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const fetchBalances = useCallback(async () => {
    if (publicKey && connection) {
      try {
        const balancePromises = TOKEN_LIST.map(async (token) => {
          if (token.name === "SOL") {
            const balanceLamports = await connection.getBalance(publicKey);
            const balanceSOL = balanceLamports / 1e9;
            return { name: token.name, balance: balanceSOL };
          } else {
            const mintPublicKey = new PublicKey(token.mintAddress);
            const tokenAccount = getAssociatedTokenAddressSync(
              mintPublicKey,
              publicKey,
              false,
              TOKEN_PROGRAM_ID
            );

            const accountInfo = await connection.getAccountInfo(tokenAccount);
            if (!accountInfo) return { name: token.name, balance: "0.00" };

            const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
            const balance = Number(tokenBalance.value.uiAmount) || 0;
            return { name: token.name, balance: balance };
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
        console.error("Error fetching balances:", error);
        toast.error("Error fetching balances");
        setBalances({});
      }
    } else {
      setBalances({});
    }
  }, [publicKey, connection, isFirstLoad, refreshCount]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]); 

  const handleClick = (tokenName) => {
    const selectedToken = TOKEN_LIST.find((token) => token.name === tokenName);
    if (selectedToken && selectedToken.mintAddress) {
      const balance = balances[tokenName];
      if (balance !== undefined && balance !== null) {
        onBalanceClick(tokenName, balance);
      }
    }
  };

  return (
    <div className="balances">
      <h3 className="large-heading">Wallet Balance:</h3>
      {isFirstLoad && Object.keys(balances).length === 0 ? (
        <p className="loading-text">Loading balances...</p>
      ) : (
        <ul className="balance-list">
          {TOKEN_LIST.map((token) => (
            <li
              key={token.name}
              onClick={() => handleClick(token.name)}
              className={`balance-item ${!token.mintAddress ? "disabled" : ""}`}
              title={token.mintAddress ? "Click to use this balance" : "Cannot stake SOL"}
            >
              <span className="token-name">{token.name}:</span>
              <span className="token-balance">
                {balances[token.name] !== undefined && balances[token.name] !== null
                  ? formatBalance(balances[token.name])
                  : "0.00"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

WalletBalances.displayName = "WalletBalances";

const StakedBalances = memo(({ publicKey, connection, onBalanceClick, refreshCount }) => {
  const [stakedBalances, setStakedBalances] = useState([]);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [totalStakeRewards, setTotalStakeRewards] = useState("0.00");

  const mintAddresses = useMemo(() => {
    return TOKEN_LIST.filter((token) => token.mintAddress).reduce(
      (acc, token) => {
        acc[token.name] = token.mintAddress;
        return acc;
      },
      {}
    );
  }, []);

  const formatFullPrecision = (number) => {
    const str = number.toString();
    const [integerPart, decimalPart] = str.split(".");
    return decimalPart && decimalPart.length > 11
      ? `${integerPart}.${decimalPart.slice(0, 11)}`
      : str;
  };

  const fetchStakedBalances = useCallback(async () => {
    if (!publicKey || !connection) return;

    try {
      const url = `https://ec1ipse.me/v2/miner/boost/stake-accounts?pubkey=${publicKey.toBase58()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch staked balances");

      const data = await response.json();

      const newStakedBalances = data.map((item) => ({
        tokenName: Object.keys(mintAddresses).find(
          (name) => mintAddresses[name] === item.mint_pubkey
        ) || "Unknown Token",
        stakedBalance: formatFullPrecision(parseFloat(item.staked_balance) / 1e11),
        rewardsBalance: formatFullPrecision(parseFloat(item.rewards_balance) / 1e11)
      }));

      const totalRewards = newStakedBalances.reduce(
        (sum, item) => sum + parseFloat(item.rewardsBalance),
        0
      );

      setStakedBalances(newStakedBalances);
      setTotalStakeRewards(formatFullPrecision(totalRewards));
      setIsFirstLoad(false);

    } catch (error) {
      console.error("Error fetching staked balances:", error);
    }
  }, [publicKey, mintAddresses, connection, refreshCount]);

  useEffect(() => {
    fetchStakedBalances();
  }, [fetchStakedBalances]);

  const handleClick = (tokenName, stakedBalance) => {
    if (onBalanceClick) {
      onBalanceClick(tokenName, stakedBalance);
    }
  };

  return (
    <div className="staked-balances">
      <h3 className="large-heading">Staked Balance (Ec1ipse):</h3>
      <p style={{ fontSize: "0.85em", color: "#888" }}>(Yield earning):</p>
      
      {isFirstLoad && stakedBalances.length === 0 ? (
        <p className="loading-text">Loading staked balances...</p>
      ) : (
        <>
          <div className="balance-header">
            <span className="header-token-name">Token</span>
            <span className="header-rewards">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rewards (ORE)</span>
            <span className="header-staked">Staked</span>
          </div>
          <ul className="balance-list">
            {stakedBalances.map(({ tokenName, stakedBalance, rewardsBalance }) => (
              <li
                key={tokenName}
                onClick={() => handleClick(tokenName, stakedBalance)}
                className="balance-item"
                title="Click to use this staked balance"
              >
                <span className="token-name">{tokenName}</span>
                <span className="token-rewards">{rewardsBalance}</span>
                <span className="token-balance">{stakedBalance}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
});

StakedBalances.displayName = "StakedBalances";

const StakingReward = memo(({ publicKey, refreshCount }) => {
  const [stakeReward, setStakeReward] = useState("0.00");

  const fetchStakeReward = useCallback(async () => {
    if (!publicKey) return;

    try {
      const url = `https://ec1ipse.me/v2/miner/boost/stake-accounts?pubkey=${publicKey.toBase58()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      const totalRewards = data.reduce((acc, item) => {
        return acc + (parseFloat(item.rewards_balance) / 100000000000 || 0);
      }, 0);

      setStakeReward(formatBalance(totalRewards));
    } catch (error) {
      console.error("Error fetching stake reward balance:", error);
      setStakeReward("0.00");
    }
  }, [publicKey, refreshCount]);

  useEffect(() => {
    fetchStakeReward();

    const intervalId = setInterval(fetchStakeReward, 75000);

    return () => clearInterval(intervalId);
  }, [fetchStakeReward]);

  return (
    <div className="staking-reward">
      <h3 className="large-heading-important">Staking Reward</h3>
      <p className="stake-reward-balance">{stakeReward}</p>
      <p className="notice-text" style={{ fontSize: "0.75em", opacity: 0.5 }}>
        A minimum of 0.05 ORE is required to claim each specific stake reward account.
      </p>
    </div>
  );
});

StakingReward.displayName = "StakingReward";

const WalletStatus = memo(({ connection, onBalanceClick, onStakeClaim, isProcessing }) => {
  const { publicKey } = useWallet();
  const [copied, setCopied] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCopy = useCallback(() => {
    if (publicKey) {
      navigator.clipboard
        .writeText(publicKey.toString())
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.error("Failed to copy!", err);
        });
    }
  }, [publicKey]);

  const handleRefresh = () => {
    if (!publicKey) return;
    setIsRefreshing(true);
    setRefreshCount((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

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
            <button
              className="refresh-button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh balances"
              style={{ marginLeft: "10px" }}
            >
              {isRefreshing ? "Refreshing..." : "Refresh 🔄"}
            </button>
          </div>
          <br />
          <StakingReward publicKey={publicKey} refreshCount={refreshCount} />
          <div className="claim-rewards-section">
            <button
              onClick={onStakeClaim}
              className="button claim-reward-button"
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Claim Rewards"}
            </button>
          </div>
          <p className="no-margin">(Click the individual line to pre-populate totals):</p>
          <WalletBalances
            publicKey={publicKey}
            connection={connection}
            onBalanceClick={onBalanceClick}
            refreshCount={refreshCount}
          />
          <hr className="separator" />
          <StakedBalances
            publicKey={publicKey}
            connection={connection}
            onBalanceClick={onBalanceClick}
            refreshCount={refreshCount}
          />
          <div className="lp-links">
            <button
              onClick={() => window.open("https://jup.ag/swap/SOL-ORE", "_blank")}
              className="button lp-button"
            >
              Buy ORE
            </button>
            <button
              onClick={() => window.open("https://app.meteora.ag/pools/GgaDTFbqdgjoZz3FP7zrtofGwnRS4E6MCzmmD5Ni1Mxj", "_blank")}
              className="button lp-button"
            >
              ORE-SOL LP
            </button>
            <button
              onClick={() => window.open("https://app.meteora.ag/pools/2vo5uC7jbmb1zNqYpKZfVyewiQmRmbJktma4QHuGNgS5", "_blank")}
              className="button lp-button"
            >
              ORE-ISC LP
            </button>
          </div>
        </>
      ) : (
        <p className="no-wallet">No Pubkey Connected</p>
      )}
    </div>
  );
});

WalletStatus.displayName = "WalletStatus";

export default memo(WalletStatus);
