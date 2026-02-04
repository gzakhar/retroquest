import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
} from "@solana/web3.js";
import { useCallback } from "react";
import { PROGRAM_ID } from "../types";

export function useProgram() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const sendInstructions = useCallback(
    async (instructions: TransactionInstruction[]) => {
      if (!publicKey || !connected) {
        throw new Error("Wallet not connected");
      }

      if (!sendTransaction) {
        throw new Error("Wallet does not support sending transactions");
      }

      const transaction = new Transaction().add(...instructions);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Simulate first to get detailed error logs
      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error("Simulation failed:", simulation.value.err);
          console.error("Simulation logs:", simulation.value.logs);
          throw new Error(
            `Transaction simulation failed: ${JSON.stringify(
              simulation.value.err
            )}\nLogs: ${simulation.value.logs?.join("\n")}`
          );
        }
        console.log("Simulation successful, logs:", simulation.value.logs);
      } catch (simError: any) {
        if (simError.message?.includes("simulation failed")) {
          throw simError;
        }
        console.warn("Simulation check failed:", simError);
        // Continue anyway - let Phantom handle it
      }

      const signature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      return signature;
    },
    [connection, publicKey, sendTransaction, connected]
  );

  const getAccountInfo = useCallback(
    async (address: PublicKey) => {
      const accountInfo = await connection.getAccountInfo(address);
      return accountInfo;
    },
    [connection]
  );

  const getMultipleAccountsInfo = useCallback(
    async (addresses: PublicKey[]) => {
      const accountInfos = await connection.getMultipleAccountsInfo(addresses);
      return accountInfos;
    },
    [connection]
  );

  /**
   * Send instructions using a session signer (ephemeral keypair).
   * This bypasses wallet popup - the ephemeral keypair signs directly.
   *
   * @param instructions - The instructions to execute
   * @param sessionSigner - The ephemeral keypair that will sign
   * @param options - Optional settings
   * @param options.fallbackToWallet - If true, falls back to wallet signing when session balance is low
   * @param options.feePayer - Optional fee payer (defaults to session signer)
   */
  const sendInstructionsWithSession = useCallback(
    async (
      instructions: TransactionInstruction[],
      sessionSigner: Keypair,
      options?: {
        fallbackToWallet?: boolean;
        feePayer?: PublicKey;
      }
    ) => {
      // Check if session signer has sufficient balance for fees
      const balance = await connection.getBalance(sessionSigner.publicKey);
      const estimatedFee = 5000 * instructions.length; // ~5000 lamports per signature

      if (balance < estimatedFee) {
        if (options?.fallbackToWallet && publicKey && connected) {
          console.log(
            `Session balance (${balance} lamports) too low for estimated fee (${estimatedFee} lamports), falling back to wallet signing`
          );
          return sendInstructions(instructions);
        } else {
          throw new Error(
            `Session balance too low (${balance / 1e9} SOL). Need at least ${
              estimatedFee / 1e9
            } SOL for transaction fees.`
          );
        }
      }

      const transaction = new Transaction().add(...instructions);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = options?.feePayer || sessionSigner.publicKey;

      // Sign with the session signer (no wallet popup)
      transaction.sign(sessionSigner);

      // Send raw transaction (already signed)
      const signature = await connection.sendRawTransaction(
        transaction.serialize()
      );

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      return signature;
    },
    [connection, publicKey, connected, sendInstructions]
  );

  return {
    connection,
    publicKey,
    connected,
    programId: PROGRAM_ID,
    sendInstructions,
    sendInstructionsWithSession,
    getAccountInfo,
    getMultipleAccountsInfo,
  };
}
