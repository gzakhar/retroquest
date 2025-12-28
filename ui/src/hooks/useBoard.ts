import { useCallback, useEffect, useState, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "./useProgram";
import {
  deserializeBoard,
  deserializeNote,
  deserializeGroup,
  deserializeBoardMembership,
} from "../utils/deserialize";
import { findNotePda, findGroupPda, findBoardMembershipPda } from "../utils/pda";
import {
  RetroBoard,
  NoteWithAddress,
  GroupWithAddress,
  BoardMembership,
  PROGRAM_ID,
} from "../types";

interface BoardData {
  board: RetroBoard | null;
  notes: NoteWithAddress[];
  groups: GroupWithAddress[];
  membership: BoardMembership | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBoard(boardAddress: PublicKey | null): BoardData {
  const { connection, publicKey, getAccountInfo } = useProgram();
  const [board, setBoard] = useState<RetroBoard | null>(null);
  const [notes, setNotes] = useState<NoteWithAddress[]>([]);
  const [groups, setGroups] = useState<GroupWithAddress[]>([]);
  const [membership, setMembership] =
    useState<BoardMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const isFetching = useRef(false);
  const retryCount = useRef(0);

  const fetchBoard = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return;

    if (!boardAddress) {
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

      // Fetch board account
      const boardAccountInfo = await getAccountInfo(boardAddress);
      if (!boardAccountInfo) {
        setError("Board not found");
        setLoading(false);
        return;
      }

      const boardData = deserializeBoard(
        Buffer.from(boardAccountInfo.data)
      );
      setBoard(boardData);

      // Fetch all notes
      const noteAddresses: PublicKey[] = [];
      for (let i = 0n; i < boardData.noteCount; i++) {
        const [notePda] = findNotePda(boardAddress, i, PROGRAM_ID);
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
      for (let i = 0n; i < boardData.groupCount; i++) {
        const [groupPda] = findGroupPda(boardAddress, i, PROGRAM_ID);
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

      // Fetch board membership if wallet connected
      if (publicKey) {
        const [membershipPda] = findBoardMembershipPda(
          boardAddress,
          publicKey,
          PROGRAM_ID
        );
        const membershipAccount = await getAccountInfo(membershipPda);
        if (membershipAccount) {
          setMembership(
            deserializeBoardMembership(Buffer.from(membershipAccount.data))
          );
        } else {
          setMembership(null);
        }
      }

      setIsInitialized(true);
      retryCount.current = 0;
      setLoading(false);
    } catch (err) {
      console.error("Error fetching board:", err);
      // Only show error if we haven't loaded successfully before
      if (!isInitialized) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
      // Silent fail on background refreshes - keep showing stale data
    } finally {
      isFetching.current = false;
    }
  }, [boardAddress, connection, publicKey, getAccountInfo, isInitialized]);

  // Initial fetch with retry logic
  useEffect(() => {
    if (isInitialized) return; // Don't retry once initialized

    let timeoutId: NodeJS.Timeout;
    let cancelled = false;

    const fetchWithRetry = async () => {
      await fetchBoard();

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
  }, [fetchBoard, isInitialized]);

  // Set up polling for updates (only after successful initial load)
  useEffect(() => {
    if (!boardAddress || !isInitialized) return;

    const interval = setInterval(fetchBoard, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [boardAddress, fetchBoard, isInitialized]);

  return {
    board,
    notes,
    groups,
    membership,
    loading,
    error,
    refresh: fetchBoard,
  };
}
