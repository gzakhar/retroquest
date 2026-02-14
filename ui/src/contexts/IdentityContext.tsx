import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ParticipantIdentity,
  PROGRAM_ID,
  MIN_USERNAME_CHARS,
  MAX_USERNAME_CHARS,
} from "../types";
import { findParticipantIdentityPda } from "../utils/pda";
import {
  createCreateIdentityInstruction,
  createUpdateIdentityInstruction,
} from "../utils/instructions";
import { deserializeParticipantIdentity } from "../utils/deserialize";

interface IdentityState {
  identity: ParticipantIdentity | null;
  identityAddress: PublicKey | null;
  isLoading: boolean;
  error: string | null;
  isModalOpen: boolean;
}

interface IdentityContextType extends IdentityState {
  createIdentity: (username: string) => Promise<void>;
  updateIdentity: (username: string) => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  refresh: () => Promise<void>;
  validateUsername: (username: string) => string | null;
}

const IdentityContext = createContext<IdentityContextType | null>(null);

interface IdentityProviderProps {
  children: ReactNode;
}

export function IdentityProvider({ children }: IdentityProviderProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [state, setState] = useState<IdentityState>({
    identity: null,
    identityAddress: null,
    isLoading: false,
    error: null,
    isModalOpen: false,
  });

  const validateUsername = useCallback((username: string): string | null => {
    if (username.length < MIN_USERNAME_CHARS) {
      return `Username must be at least ${MIN_USERNAME_CHARS} characters`;
    }
    if (username.length > MAX_USERNAME_CHARS) {
      return `Username cannot exceed ${MAX_USERNAME_CHARS} characters`;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return "Username can only contain letters, numbers, and underscores";
    }
    return null;
  }, []);

  const fetchIdentity = useCallback(async () => {
    if (!publicKey || !connected) {
      setState((prev) => ({
        ...prev,
        identity: null,
        identityAddress: null,
        isLoading: false,
      }));
      return;
    }

    try {
      const [identityPda] = findParticipantIdentityPda(publicKey, PROGRAM_ID);
      const accountInfo = await connection.getAccountInfo(identityPda);

      if (accountInfo) {
        const identity = deserializeParticipantIdentity(
          Buffer.from(accountInfo.data)
        );
        setState((prev) => ({
          ...prev,
          identity: identity.isInitialized ? identity : null,
          identityAddress: identityPda,
          isLoading: false,
          error: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          identity: null,
          identityAddress: identityPda,
          isLoading: false,
          error: null,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch identity:", error);
      setState((prev) => ({
        ...prev,
        identity: null,
        identityAddress: null,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to fetch identity",
      }));
    }
  }, [publicKey, connected, connection]);

  // Fetch identity when wallet connects/changes
  useEffect(() => {
    if (connected && publicKey) {
      fetchIdentity();
    } else {
      setState({
        identity: null,
        identityAddress: null,
        isLoading: false,
        error: null,
        isModalOpen: false,
      });
    }
  }, [connected, publicKey, fetchIdentity]);

  const createIdentity = useCallback(
    async (username: string) => {
      if (!publicKey || !connected || !sendTransaction) {
        throw new Error("Wallet not connected");
      }

      const validationError = validateUsername(username);
      if (validationError) {
        throw new Error(validationError);
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const [identityPda] = findParticipantIdentityPda(publicKey, PROGRAM_ID);

        const instruction = createCreateIdentityInstruction(
          identityPda,
          publicKey,
          username,
          PROGRAM_ID
        );

        const transaction = new Transaction().add(instruction);
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        // Refresh identity after creation
        await fetchIdentity();

        setState((prev) => ({ ...prev, isModalOpen: false }));
        console.log("Identity created successfully:", username);
      } catch (error: any) {
        console.error("Failed to create identity:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "Failed to create identity",
        }));
        throw error;
      }
    },
    [publicKey, connected, sendTransaction, connection, validateUsername, fetchIdentity]
  );

  const updateIdentity = useCallback(
    async (username: string) => {
      if (!publicKey || !connected || !sendTransaction) {
        throw new Error("Wallet not connected");
      }

      if (!state.identity) {
        throw new Error("No identity to update. Create one first.");
      }

      const validationError = validateUsername(username);
      if (validationError) {
        throw new Error(validationError);
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const [identityPda] = findParticipantIdentityPda(publicKey, PROGRAM_ID);

        const instruction = createUpdateIdentityInstruction(
          identityPda,
          publicKey,
          username,
          PROGRAM_ID
        );

        const transaction = new Transaction().add(instruction);
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        // Refresh identity after update
        await fetchIdentity();

        setState((prev) => ({ ...prev, isModalOpen: false }));
        console.log("Identity updated successfully:", username);
      } catch (error: any) {
        console.error("Failed to update identity:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "Failed to update identity",
        }));
        throw error;
      }
    },
    [publicKey, connected, sendTransaction, connection, state.identity, validateUsername, fetchIdentity]
  );

  const openModal = useCallback(() => {
    setState((prev) => ({ ...prev, isModalOpen: true, error: null }));
  }, []);

  const closeModal = useCallback(() => {
    setState((prev) => ({ ...prev, isModalOpen: false, error: null }));
  }, []);

  const contextValue: IdentityContextType = {
    ...state,
    createIdentity,
    updateIdentity,
    openModal,
    closeModal,
    refresh: fetchIdentity,
    validateUsername,
  };

  return (
    <IdentityContext.Provider value={contextValue}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityContextType {
  const context = useContext(IdentityContext);
  if (!context) {
    throw new Error("useIdentity must be used within an IdentityProvider");
  }
  return context;
}
