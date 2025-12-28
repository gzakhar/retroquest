import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
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
            `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}\nLogs: ${simulation.value.logs?.join("\n")}`
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

  return {
    connection,
    publicKey,
    connected,
    programId: PROGRAM_ID,
    sendInstructions,
    getAccountInfo,
    getMultipleAccountsInfo,
  };
}
