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
  return !isNaN(num) && num !== 0 ? num.toFixed(11) : "0.00000000000";
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
            if (!accountInfo) return { name: token.name, balance: "0.00000000000" };

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
  }, [publicKey, connection]);

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
                className={`wallet-balance-item ${!token.mintAddress ? "disabled" : ""}`}
                title={token.mintAddress ? "Click to use this balance" : "Cannot stake SOL"}
              >
                <span className="token-name">{token.name}</span>
                <span className="token-balance">
                  {balances[token.name] !== undefined && balances[token.name] !== null
                    ? formatBalance(balances[token.name])
                    : "0.00000000000"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
  );
});

WalletBalances.displayName = "WalletBalances";







// You can add this function in your component or in a separate utility file
async function getBoostStakeInfo(connection, publicKey) {
  const PROGRAM_ID = new PublicKey('BoosTyJFPPtrqJTdi49nnztoEWDJXfDRhyb2fha6PPy');
  const BOOST_MINTS = [
      '8H8rPiWW4iTFCfEkSnf7jpqeNpFfvdH9gLouAL3Fe2Zx',
      'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN',
      '7G3dfZkSk1HpDGnyL37LMBbPEgT4Ca6vZmZPUyi2syWt',
      'meUwDp23AaxhiNKaQCyJ2EAF2T4oe1gSkEkGXSRVdZb',
      'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp',
  ];

  const findBoostPDA = (mint) => {
      return PublicKey.findProgramAddressSync(
          [Buffer.from('boost'), mint.toBuffer()],
          PROGRAM_ID
      );
  };

  const findStakePDA = (authority, boost) => {
      return PublicKey.findProgramAddressSync(
          [Buffer.from('stake'), authority.toBuffer(), boost.toBuffer()],
          PROGRAM_ID
      );
  };


  const TOKEN_DECIMALS = 11;  // From the ORE token decimals
  const BOOST_DENOMINATOR = 1000;
  
  const KAMINO_MINTS = [
    '7G3dfZkSk1HpDGnyL37LMBbPEgT4Ca6vZmZPUyi2syWt', // Kamino ORE-HNT
    '8H8rPiWW4iTFCfEkSnf7jpqeNpFfvdH9gLouAL3Fe2Zx'  // Kamino ORE-SOL
];

// Helper function to convert raw amounts based on mint
const convertAmount = (rawAmount, mintAddress) => {
    // Kamino LP tokens use 6 decimals
    if (KAMINO_MINTS.includes(mintAddress)) {
        return Number(rawAmount) / Math.pow(10, 6);
    }
    // Everything else uses 11 decimals
    return Number(rawAmount) / Math.pow(10, 11);
};
  
  const decodeBoost = (data) => {
      // Skip 8 byte discriminator
      const accountData = data.slice(8);
      const dataView = new DataView(accountData.buffer, accountData.byteOffset, accountData.byteLength);
      
      return {
          bump: Number(dataView.getBigUint64(0, true)),
          expiresAt: Number(dataView.getBigInt64(8, true)),
          locked: Number(dataView.getBigUint64(16, true)),
          mint: new PublicKey(accountData.slice(24, 56)),
          multiplier: Number(dataView.getBigUint64(56, true)) / BOOST_DENOMINATOR,
          totalDeposits: convertAmount(dataView.getBigUint64(64, true)),
          totalStakers: Number(dataView.getBigUint64(72, true))
      };
  };
  
  const decodeStake = (data, mintAddress) => {
    const accountData = data.slice(8);
    const dataView = new DataView(accountData.buffer, accountData.byteOffset, accountData.byteLength);
    
    return {
        authority: new PublicKey(accountData.slice(0, 32)),
        balance: convertAmount(dataView.getBigUint64(32, true), mintAddress),
        balancePending: convertAmount(dataView.getBigUint64(40, true), mintAddress),
        boost: new PublicKey(accountData.slice(48, 80)),
        id: Number(dataView.getBigUint64(80, true)),
        lastDepositAt: Number(dataView.getBigInt64(88, true)),
        rewards: convertAmount(dataView.getBigUint64(96, true), 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp')  // rewards always in ORE (11 decimals)
    };
};

const results = [];

for (const mintAddress of BOOST_MINTS) {
    const mint = new PublicKey(mintAddress);
    const [boostAddress] = findBoostPDA(mint);
    const [stakeAddress] = findStakePDA(publicKey, boostAddress);

    try {
        const [boostAccount, stakeAccount] = await Promise.all([
            connection.getAccountInfo(boostAddress),
            connection.getAccountInfo(stakeAddress)
        ]);

        if (boostAccount && stakeAccount) {
            const boost = decodeBoost(boostAccount.data);
            const stake = decodeStake(stakeAccount.data, mintAddress);

            results.push({
                mint: mintAddress,
                boost: {
                    multiplier: Number(boost.multiplier) / 1000,
                    totalDeposits: convertAmount(boost.totalDeposits, mintAddress),
                    totalStakers: Number(boost.totalStakers),
                    expiresAt: Number(boost.expiresAt),
                    locked: Boolean(boost.locked)
                },
                stake: {
                    balance: stake.balance,
                    balancePending: stake.balancePending,
                    rewards: stake.rewards,
                    lastDepositAt: Number(stake.lastDepositAt)
                }
            });
        }
    } catch (error) {
        console.error(`Error fetching data for mint ${mintAddress}:`, error);
    }
}

return results;
}







const StakedBalances = memo(({ publicKey, connection, onBalanceClick, refreshCount }) => {
  const [stakedBalances, setStakedBalances] = useState([]);
  const [boostStakeInfo, setBoostStakeInfo] = useState([]);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

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

  useEffect(() => {
    if (publicKey && connection) {
        getBoostStakeInfo(connection, publicKey)
            .then(results => {
                setBoostStakeInfo(results);
            })
            .catch(error => {
                console.error('Error fetching boost/stake info:', error);
            });
    }
  }, [publicKey, connection, refreshCount]);

  const fetchStakedBalances = useCallback(async () => {
    if (!publicKey || !connection) return;

    try {
      const url = `https://ec1ipse.me/v2/miner/boost/stake-accounts?pubkey=${publicKey.toBase58()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch staked balances");

      const data = await response.json();

      // Create a map of existing balances
      const balanceMap = data.reduce((acc, item) => {
        const tokenName = Object.keys(mintAddresses).find(
          (name) => mintAddresses[name] === item.mint_pubkey
        ) || "Unknown Token";
        acc[tokenName] = {
          stakedEclipse: formatFullPrecision(parseFloat(item.staked_balance) / 1e11),
          rewardsBalance: formatFullPrecision(parseFloat(item.rewards_balance) / 1e11)
        };
        return acc;
      }, {});

      // Create balance entries for all tokens in TOKEN_LIST
      const newStakedBalances = TOKEN_LIST
      .filter(token => token.mintAddress)
      .map(token => {
        // Find corresponding boost/stake info
        const boostInfo = boostStakeInfo.find(info => info.mint === token.mintAddress);
        
        return {
          tokenName: token.name,
          stakedEclipse: balanceMap[token.name]?.stakedEclipse || "0.00000000000",
          rewardsBalance: balanceMap[token.name]?.rewardsBalance || "0.00000000000",
          onChainStake: boostInfo?.stake?.balance || 0,        // For column 4
          onChainPending: boostInfo?.stake?.balancePending || 0,  // For column 5
          onChainRewards: boostInfo?.stake?.rewards || 0       // For column 6
        };
      });

      setStakedBalances(newStakedBalances);
      setIsFirstLoad(false);

    } catch (error) {
      console.error("Error fetching staked balances:", error);
    }
  }, [publicKey, mintAddresses, connection, boostStakeInfo]);

  useEffect(() => {
    fetchStakedBalances();
  }, [fetchStakedBalances]);

  const handleClick = (tokenName, stakedEclipse) => {
    if (onBalanceClick) {
      onBalanceClick(tokenName, stakedEclipse);
    }
  };

  const formatNumberConsistently = (number) => {
    // Convert to number and handle potential NaN/null/undefined
    const num = Number(number);
    // Always show 11 decimal places, pad with zeros if needed
    return !isNaN(num) ? num.toFixed(11) : "0.00000000000";
  };

  return (
    <div className="staked-balances">
      <h3 className="large-heading">Staked Balance:</h3>
      <p style={{ fontSize: "0.85em", color: "#888" }}>(Yield earning disabled):</p>
      
      {isFirstLoad && stakedBalances.length === 0 ? (
        <p className="loading-text">Loading staked balances...</p>
      ) : (
        <>
          <div className="balance-table">
            <div className="balance-header">
              <div>
                <span>Token</span>
              </div>
              <div>
                <span>Rewards</span>
                <p style={{ fontSize: "0.85em", color: "#888", margin: "2px 0 0 0" }}>
                  (Ec1ipse)
                </p>
              </div>
              <div>
                <span>Staked</span>
                <p style={{ fontSize: "0.85em", color: "#888", margin: "2px 0 0 0" }}>
                  (Ec1ipse)
                </p>
              </div>
              <div>
                <span>Staked</span>
                <p style={{ fontSize: "0.85em", color: "#888", margin: "2px 0 0 0" }}>
                  (Global)
                </p>
              </div>
              <div>
                <span>Pending</span>
                <p style={{ fontSize: "0.85em", color: "#888", margin: "2px 0 0 0" }}>
                  (Global)
                </p>
              </div>
              <div>
                <span>Rewards</span>
                <p style={{ fontSize: "0.85em", color: "#888", margin: "2px 0 0 0" }}>
                  (Global)
                </p>
              </div>
            </div>
            <ul className="balance-list">
              {stakedBalances.map(({ 
                tokenName, 
                stakedEclipse, 
                rewardsBalance, 
                onChainStake,
                onChainPending,
                onChainRewards 
              }) => (
                <li
                  key={tokenName}
                  onClick={() => handleClick(tokenName, stakedEclipse)}
                  className="balance-item"
                  title="Click to use this staked balance"
                >
                  <span>{tokenName}</span>
                  <span>{formatNumberConsistently(rewardsBalance)}</span>
                  <span>{formatNumberConsistently(stakedEclipse)}</span>
                  <span>{formatNumberConsistently(onChainStake)}</span>
                  <span>{formatNumberConsistently(onChainPending)}</span>
                  <span>{formatNumberConsistently(onChainRewards)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
});

StakedBalances.displayName = "StakedBalances";

const StakingReward = memo(({ publicKey, refreshCount }) => {
  const [stakeReward, setStakeReward] = useState("0.00000000000");

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
      setStakeReward("0.00000000000");
    }
  }, [publicKey, refreshCount]);

  useEffect(() => {
    fetchStakeReward();

  }, [fetchStakeReward]);

  return (
    <div className="staking-reward">
      <h3 className="large-heading-important">Ec1ipse Staking Reward</h3>
      <p className="stake-reward-balance">{stakeReward}</p>
      <p className="notice-text" style={{ fontSize: "0.75em", opacity: 0.5 }}>
        A minimum of 0.00000005 ORE is required to claim each specific stake reward account.
      </p>
    </div>
  );
});

StakingReward.displayName = "StakingReward";

const WalletStatus = memo(({ connection, onBalanceClick, onStakeClaim, isProcessing }) => {
  const { publicKey } = useWallet();
  const [boostStakeInfo, setBoostStakeInfo] = useState([]);
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

  useEffect(() => {
    if (publicKey && connection) {
        getBoostStakeInfo(connection, publicKey)
            .then(results => {
                setBoostStakeInfo(results);
            })
            .catch(error => {
                console.error('Error fetching boost/stake info:', error);
            });
    }
  }, [publicKey, connection, refreshCount]);

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
              {isProcessing ? "Processing..." : "Claim Remaining Rewards"}
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
            boostStakeInfo={boostStakeInfo}
          />
        </>
      ) : (
        <p className="no-wallet">No Pubkey Connected</p>
      )}
    </div>
  );
});

WalletStatus.displayName = "WalletStatus";

export default memo(WalletStatus);
export { getBoostStakeInfo };
