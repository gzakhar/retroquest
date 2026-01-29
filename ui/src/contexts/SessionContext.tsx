import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  SessionTokenWithAddress,
  PROGRAM_ID,
  DEFAULT_SESSION_VALIDITY_SECONDS,
  DEFAULT_TOP_UP_LAMPORTS,
} from "../types";
import {
  findSessionTokenPda,
  createCreateSessionInstruction,
  createRevokeSessionInstruction,
} from "../utils/instructions";
import { deserializeSessionToken } from "../utils/deserialize";

// localStorage key for session persistence
const STORAGE_KEY = "retroquest_sessions";

// Stored session data structure
interface StoredSession {
  ephemeralSecretKey: number[]; // Uint8Array serialized as number[]
  sessionTokenAddress: string; // Base58 public key
  validUntil: number; // Unix timestamp
}

// Map of wallet address -> stored session
type StoredSessionMap = Record<string, StoredSession>;

// Helper: Load all sessions from localStorage
function loadStoredSessions(): StoredSessionMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as StoredSessionMap;
  } catch (error) {
    console.warn("Failed to load stored sessions:", error);
    return {};
  }
}

// Helper: Save sessions to localStorage
function saveStoredSessions(sessions: StoredSessionMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.warn("Failed to save sessions to localStorage:", error);
  }
}

// Helper: Save a session for a specific wallet
function saveSession(
  walletAddress: string,
  ephemeralKeypair: Keypair,
  sessionTokenAddress: PublicKey,
  validUntil: number
): void {
  const sessions = loadStoredSessions();
  sessions[walletAddress] = {
    ephemeralSecretKey: Array.from(ephemeralKeypair.secretKey),
    sessionTokenAddress: sessionTokenAddress.toBase58(),
    validUntil,
  };
  saveStoredSessions(sessions);
}

// Helper: Remove a session for a specific wallet
function removeStoredSession(walletAddress: string): void {
  const sessions = loadStoredSessions();
  delete sessions[walletAddress];
  saveStoredSessions(sessions);
}

// Helper: Get stored session for a wallet (returns null if expired or not found)
function getStoredSession(walletAddress: string): StoredSession | null {
  const sessions = loadStoredSessions();
  const session = sessions[walletAddress];
  if (!session) return null;

  // Check if expired
  const now = Math.floor(Date.now() / 1000);
  if (session.validUntil <= now) {
    // Clean up expired session
    removeStoredSession(walletAddress);
    return null;
  }

  return session;
}

// Helper: Clean up all expired sessions
function cleanupExpiredSessions(): void {
  const sessions = loadStoredSessions();
  const now = Math.floor(Date.now() / 1000);
  let changed = false;

  for (const [wallet, session] of Object.entries(sessions)) {
    if (session.validUntil <= now) {
      delete sessions[wallet];
      changed = true;
    }
  }

  if (changed) {
    saveStoredSessions(sessions);
  }
}

interface SessionState {
  // The ephemeral keypair (stored in memory only)
  ephemeralKeypair: Keypair | null;
  // The session token account data
  sessionToken: SessionTokenWithAddress | null;
  // Whether a session is active and valid
  isActive: boolean;
  // Time remaining in seconds
  timeRemaining: number;
  // SOL balance of session signer (null if unknown)
  balance: number | null;
  // Loading state
  isLoading: boolean;
  // Error state
  error: string | null;
}

interface SessionContextType extends SessionState {
  // Create a new session
  createSession: (
    validForSeconds?: number,
    topUpLamports?: bigint
  ) => Promise<void>;
  // Revoke the current session
  revokeSession: () => Promise<void>;
  // Check if session is valid for signing
  canSign: () => boolean;
  // Get the signer (ephemeral keypair) for signing transactions
  getSessionSigner: () => Keypair | null;
  // Get the session token address if session is active
  getSessionTokenAddress: () => PublicKey | null;
  // Top up the session signer with more SOL
  topUp: (amountSol?: number) => Promise<void>;
  // Refresh the balance manually
  refreshBalance: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [state, setState] = useState<SessionState>({
    ephemeralKeypair: null,
    sessionToken: null,
    isActive: false,
    timeRemaining: 0,
    balance: null,
    isLoading: false,
    error: null,
  });

  // Ref to track current ephemeral keypair for stable fetchBalance callback
  const ephemeralKeypairRef = useRef<Keypair | null>(null);

  // Update time remaining every second
  useEffect(() => {
    if (!state.sessionToken) return;

    const updateTimeRemaining = () => {
      const now = Math.floor(Date.now() / 1000);
      const validUntil = Number(state.sessionToken!.data.validUntil);
      const remaining = Math.max(0, validUntil - now);

      setState((prev) => ({
        ...prev,
        timeRemaining: remaining,
        isActive: remaining > 0,
      }));
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [state.sessionToken]);

  // Clear session state when wallet disconnects (but keep localStorage for reconnect)
  useEffect(() => {
    if (!connected) {
      setState({
        ephemeralKeypair: null,
        sessionToken: null,
        isActive: false,
        timeRemaining: 0,
        balance: null,
        isLoading: false,
        error: null,
      });
    }
  }, [connected]);

  // Keep ref in sync with state - allows fetchBalance to have stable identity
  useEffect(() => {
    ephemeralKeypairRef.current = state.ephemeralKeypair;
  }, [state.ephemeralKeypair]);

  // Fetch balance of session signer
  // Uses ref instead of state to maintain stable callback identity
  const fetchBalance = useCallback(async () => {
    const keypair = ephemeralKeypairRef.current;
    if (!keypair) return;
    try {
      const lamports = await connection.getBalance(keypair.publicKey);
      setState((prev) => ({
        ...prev,
        balance: lamports / LAMPORTS_PER_SOL,
      }));
    } catch (error) {
      console.warn("Failed to fetch session balance:", error);
    }
  }, [connection]);

  // Poll balance every 10 seconds when session is active
  useEffect(() => {
    if (!state.isActive) return;

    fetchBalance(); // Initial fetch
    const interval = setInterval(fetchBalance, 10000);

    return () => clearInterval(interval);
  }, [state.isActive, fetchBalance]);

  // Track if we've already attempted to restore session for this wallet
  const restorationAttemptedRef = useRef<string | null>(null);

  // Restore session from localStorage when wallet connects
  useEffect(() => {
    if (!publicKey || !connected) return;

    const walletAddress = publicKey.toBase58();

    // Don't attempt restoration if we already tried for this wallet
    if (restorationAttemptedRef.current === walletAddress) return;
    restorationAttemptedRef.current = walletAddress;

    // Clean up any expired sessions first
    cleanupExpiredSessions();

    const storedSession = getStoredSession(walletAddress);
    if (!storedSession) return;

    // Restore the session
    const restoreSession = async () => {
      try {
        // Reconstruct the ephemeral keypair from stored secret key
        const ephemeralKeypair = Keypair.fromSecretKey(
          Uint8Array.from(storedSession.ephemeralSecretKey)
        );
        const sessionTokenAddress = new PublicKey(
          storedSession.sessionTokenAddress
        );

        // Verify the session token still exists on-chain
        const accountInfo =
          await connection.getAccountInfo(sessionTokenAddress);
        if (!accountInfo) {
          console.log(
            "Stored session token no longer exists on-chain, clearing..."
          );
          removeStoredSession(walletAddress);
          return;
        }

        // Deserialize and verify it's still valid
        const sessionTokenData = deserializeSessionToken(
          Buffer.from(accountInfo.data)
        );

        const now = Math.floor(Date.now() / 1000);
        const validUntil = Number(sessionTokenData.validUntil);
        if (validUntil <= now) {
          console.log("Stored session has expired, clearing...");
          removeStoredSession(walletAddress);
          return;
        }

        // Session is valid, restore it
        const timeRemaining = validUntil - now;

        setState({
          ephemeralKeypair,
          sessionToken: {
            address: sessionTokenAddress,
            data: sessionTokenData,
          },
          isActive: true,
          timeRemaining,
          balance: null, // Will be fetched by useEffect
          isLoading: false,
          error: null,
        });

        console.log("Session restored from localStorage:", {
          sessionToken: sessionTokenAddress.toBase58(),
          sessionSigner: ephemeralKeypair.publicKey.toBase58(),
          validUntil: new Date(validUntil * 1000).toISOString(),
          timeRemaining,
        });
      } catch (error) {
        console.warn("Failed to restore session from localStorage:", error);
        removeStoredSession(walletAddress);
      }
    };

    restoreSession();
  }, [publicKey, connected, connection]);

  const createSession = useCallback(
    async (
      validForSeconds: number = DEFAULT_SESSION_VALIDITY_SECONDS,
      topUpLamports: bigint = DEFAULT_TOP_UP_LAMPORTS
    ) => {
      if (!publicKey || !connected || !sendTransaction) {
        throw new Error("Wallet not connected");
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Generate new ephemeral keypair
        const ephemeralKeypair = Keypair.generate();

        // Calculate valid_until timestamp
        const validUntil = BigInt(
          Math.floor(Date.now() / 1000) + validForSeconds
        );

        // Derive session token PDA
        const [sessionTokenPda] = findSessionTokenPda(
          PROGRAM_ID,
          ephemeralKeypair.publicKey,
          publicKey,
          PROGRAM_ID
        );

        // Create the instruction
        const instruction = createCreateSessionInstruction(
          sessionTokenPda,
          ephemeralKeypair.publicKey,
          publicKey,
          validUntil,
          topUpLamports,
          PROGRAM_ID
        );

        // Build and send transaction
        const transaction = new Transaction().add(instruction);
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Partial sign with ephemeral keypair first
        transaction.partialSign(ephemeralKeypair);

        // Send to wallet for authority signature
        const signature = await sendTransaction(transaction, connection);

        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        // Fetch the created session token account
        const accountInfo = await connection.getAccountInfo(sessionTokenPda);
        if (!accountInfo) {
          throw new Error("Session token account not found after creation");
        }

        const sessionTokenData = deserializeSessionToken(
          Buffer.from(accountInfo.data)
        );

        setState({
          ephemeralKeypair,
          sessionToken: {
            address: sessionTokenPda,
            data: sessionTokenData,
          },
          isActive: true,
          timeRemaining: validForSeconds,
          balance: null, // Will be fetched by useEffect
          isLoading: false,
          error: null,
        });

        // Save to localStorage for persistence across page refreshes
        saveSession(
          publicKey.toBase58(),
          ephemeralKeypair,
          sessionTokenPda,
          Number(validUntil)
        );

        console.log("Session created successfully:", {
          sessionToken: sessionTokenPda.toBase58(),
          sessionSigner: ephemeralKeypair.publicKey.toBase58(),
          validUntil: new Date(Number(validUntil) * 1000).toISOString(),
        });
      } catch (error: any) {
        console.error("Failed to create session:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "Failed to create session",
        }));
        throw error;
      }
    },
    [publicKey, connected, sendTransaction, connection]
  );

  const revokeSession = useCallback(async () => {
    if (!publicKey || !connected || !sendTransaction) {
      throw new Error("Wallet not connected");
    }

    if (!state.sessionToken) {
      throw new Error("No active session to revoke");
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const instruction = createRevokeSessionInstruction(
        state.sessionToken.address,
        publicKey,
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

      setState({
        ephemeralKeypair: null,
        sessionToken: null,
        isActive: false,
        timeRemaining: 0,
        balance: null,
        isLoading: false,
        error: null,
      });

      // Clear from localStorage
      if (publicKey) {
        removeStoredSession(publicKey.toBase58());
      }

      console.log("Session revoked successfully");
    } catch (error: any) {
      console.error("Failed to revoke session:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Failed to revoke session",
      }));
      throw error;
    }
  }, [publicKey, connected, sendTransaction, connection, state.sessionToken]);

  // Top up the session signer with more SOL
  const topUp = useCallback(
    async (amountSol: number = 0.01) => {
      if (!publicKey || !state.ephemeralKeypair || !sendTransaction) {
        throw new Error("Wallet not connected or no active session");
      }

      const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

      const instruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: state.ephemeralKeypair.publicKey,
        lamports,
      });

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

      // Refresh balance after top-up
      await fetchBalance();

      console.log(
        `Session topped up with ${amountSol} SOL, signature: ${signature}`
      );
    },
    [
      publicKey,
      state.ephemeralKeypair,
      sendTransaction,
      connection,
      fetchBalance,
    ]
  );

  const canSign = useCallback(() => {
    return (
      state.isActive &&
      state.ephemeralKeypair !== null &&
      state.sessionToken !== null &&
      state.timeRemaining > 0
    );
  }, [state]);

  const getSessionSigner = useCallback(() => {
    if (!canSign()) return null;
    return state.ephemeralKeypair;
  }, [canSign, state.ephemeralKeypair]);

  const getSessionTokenAddress = useCallback(() => {
    if (!canSign()) return null;
    return state.sessionToken?.address || null;
  }, [canSign, state.sessionToken]);

  const contextValue: SessionContextType = {
    ...state,
    createSession,
    revokeSession,
    canSign,
    getSessionSigner,
    getSessionTokenAddress,
    topUp,
    refreshBalance: fetchBalance,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
