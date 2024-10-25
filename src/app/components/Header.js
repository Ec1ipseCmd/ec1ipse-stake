"use client";

import React from "react";
import Image from "next/image";
import dynamic from "next/dynamic";

// Dynamically import WalletMultiButton to prevent SSR issues
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

const Header = () => (
  <header className="header">
    <div className="logo-title-container">
      <div className="logo-container">
        <Image
          src="/eclipse-icon.png"
          priority
          alt="Ec1ipse Stake Logo"
          width={150}
          height={50}
          className="logo"
        />
      </div>
      <h1 className="site-title">
        <span>Ec1ipse</span>
        <span>Staking</span>
      </h1>
    </div>
    <WalletMultiButton className="wallet-button" />
  </header>
);

export default Header;
