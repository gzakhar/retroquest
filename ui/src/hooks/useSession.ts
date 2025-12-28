import { useCallback, useEffect, useState, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "./useProgram";
import {
  deserializeSession,
  deserializeNote,
  deserializeGroup,
  deserializeParticipantEntry,
} from "../utils/deserialize";
import { findNotePda, findGroupPda, findParticipantEntryPda } from "../utils/pda";
import {
  RetroSession,
  NoteWithAddress,
  GroupWithAddress,
  ParticipantEntry,
  PROGRAM_ID,
} from "../types";

interface SessionData {
  session: RetroSession | null;
  notes: NoteWithAddress[];
  groups: GroupWithAddress[];
  participantEntry: ParticipantEntry | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSession(sessionAddress: PublicKey | null): SessionData {
  const { connection, publicKey, getAccountInfo } = useProgram();
  const [session, setSession] = useState<RetroSession | null>(null);
  const [notes, setNotes] = useState<NoteWithAddress[]>([]);
  const [groups, setGroups] = useState<GroupWithAddress[]>([]);
  const [participantEntry, setParticipantEntry] =
    useState<ParticipantEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const isFetching = useRef(false);
  const retryCount = useRef(0);

  const fetchSession = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return;

    if (!sessionAddress) {
      setLoading(false);
      return;
    }

    isFetching.current = true;

    try {
      // Only show loading spinner on initial load, not on refreshes
      if (!isInitialized) {
        setLoading(true);
      }
      setError(null);

      // Fetch session account
      const sessionAccountInfo = await getAccountInfo(sessionAddress);
      if (!sessionAccountInfo) {
        setError("Session not found");
        setLoading(false);
        return;
      }

      const sessionData = deserializeSession(
        Buffer.from(sessionAccountInfo.data)
      );
      setSession(sessionData);

      // Fetch all notes
      const noteAddresses: PublicKey[] = [];
      for (let i = 0n; i < sessionData.noteCount; i++) {
        const [notePda] = findNotePda(sessionAddress, i, PROGRAM_ID);
        noteAddresses.push(notePda);
      }

      if (noteAddresses.length > 0) {
        const noteAccounts =
          await connection.getMultipleAccountsInfo(noteAddresses);
        const fetchedNotes: NoteWithAddress[] = [];
        noteAccounts.forEach((account, index) => {
          if (account) {
            fetchedNotes.push({
              address: noteAddresses[index],
              data: deserializeNote(Buffer.from(account.data)),
            });
          }
        });
        setNotes(fetchedNotes);
      } else {
        setNotes([]);
      }

      // Fetch all groups
      const groupAddresses: PublicKey[] = [];
      for (let i = 0n; i < sessionData.groupCount; i++) {
        const [groupPda] = findGroupPda(sessionAddress, i, PROGRAM_ID);
        groupAddresses.push(groupPda);
      }

      if (groupAddresses.length > 0) {
        const groupAccounts =
          await connection.getMultipleAccountsInfo(groupAddresses);
        const fetchedGroups: GroupWithAddress[] = [];
        groupAccounts.forEach((account, index) => {
          if (account) {
            fetchedGroups.push({
              address: groupAddresses[index],
              data: deserializeGroup(Buffer.from(account.data)),
              notes: [], // Will be populated based on note.groupId
            });
          }
        });
        setGroups(fetchedGroups);
      } else {
        setGroups([]);
      }

      // Fetch participant entry if wallet connected
      if (publicKey) {
        const [participantPda] = findParticipantEntryPda(
          sessionAddress,
          publicKey,
          PROGRAM_ID
        );
        const participantAccount = await getAccountInfo(participantPda);
        if (participantAccount) {
          setParticipantEntry(
            deserializeParticipantEntry(Buffer.from(participantAccount.data))
          );
        } else {
          setParticipantEntry(null);
        }
      }

      setIsInitialized(true);
      retryCount.current = 0;
      setLoading(false);
    } catch (err) {
      console.error("Error fetching session:", err);
      // Only show error if we haven't loaded successfully before
      if (!isInitialized) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
      // Silent fail on background refreshes - keep showing stale data
    } finally {
      isFetching.current = false;
    }
  }, [sessionAddress, connection, publicKey, getAccountInfo, isInitialized]);

  // Initial fetch with retry logic
  useEffect(() => {
    if (isInitialized) return; // Don't retry once initialized

    let timeoutId: NodeJS.Timeout;
    let cancelled = false;

    const fetchWithRetry = async () => {
      await fetchSession();

      // If initial load failed, retry with backoff (max 3 retries)
      if (!cancelled && retryCount.current < 3) {
        retryCount.current += 1;
        const delay = Math.min(2000 * Math.pow(2, retryCount.current), 10000);
        console.log(`Retrying in ${delay}ms (attempt ${retryCount.current}/3)...`);
        timeoutId = setTimeout(fetchWithRetry, delay);
      }
    };

    fetchWithRetry();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchSession, isInitialized]);

  // Set up polling for updates (only after successful initial load)
  useEffect(() => {
    if (!sessionAddress || !isInitialized) return;

    const interval = setInterval(fetchSession, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [sessionAddress, fetchSession, isInitialized]);

  return {
    session,
    notes,
    groups,
    participantEntry,
    loading,
    error,
    refresh: fetchSession,
  };
}
