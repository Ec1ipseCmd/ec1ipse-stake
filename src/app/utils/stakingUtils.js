import {
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
  } from "@solana/web3.js";
  import { getAssociatedTokenAddressSync } from "@solana/spl-token";
  import { Buffer } from "buffer";
  
  /**
   * Retrieves the delegated boost address.
   */
  export const getDelegatedBoostAddress = async (staker, mint, miner, programId) => {
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
  };
  
  /**
   * Creates a stake boost instruction.
   */
  export const createStakeBoostInstruction = async (
    staker,
    miner,
    mint,
    amount,
    programId,
    boostProgramId
  ) => {
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
  
    return new TransactionInstruction({
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
  };
  
  /**
   * Creates a migrate instruction.
   */
  export const createMigrateInstruction = async (
    staker,
    miner,
    mint,
    programId,
    boostProgramId
  ) => {
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
  
    return new TransactionInstruction({
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
  };
  
  /**
   * Creates an unstake boost instruction.
   */
  export const createUnstakeBoostInstruction = async (
    staker,
    miner,
    mint,
    amount,
    programId,
    boostProgramId
  ) => {
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
  
    return new TransactionInstruction({
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
  };
  
  /**
   * Creates an initialization instruction for delegated boost.
   */
  export const createInitDelegateBoostInstruction = async (
    staker,
    miner,
    payer,
    mint,
    programId,
    boostProgramId
  ) => {
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
  
    return new TransactionInstruction({
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
  };