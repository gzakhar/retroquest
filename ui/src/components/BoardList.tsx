import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "../hooks/useProgram";
import {
  findFacilitatorRegistryPda,
  findBoardPda,
} from "../utils/pda";
import {
  deserializeFacilitatorRegistry,
  deserializeBoard,
  deserializeBoardMembership,
} from "../utils/deserialize";
import { BoardWithAddress, STAGE_NAMES, PROGRAM_ID } from "../types";

const BOARD_MEMBERSHIP_SIZE = 67; // 1 + 32 + 32 + 1 + 1

export const BoardList: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const { connection, getAccountInfo } = useProgram();
  const [boards, setBoards] = useState<BoardWithAddress[]>([]);
  const [participatingBoards, setParticipatingBoards] = useState<BoardWithAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBoards = async () => {
      if (!publicKey) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch own boards and participating boards in parallel
        const [ownBoards, participatingData] = await Promise.all([
          fetchOwnBoards(),
          fetchParticipatingBoards(),
        ]);

        setBoards(ownBoards);
        setParticipatingBoards(participatingData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching boards:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    // Fetch boards where user is the facilitator
    const fetchOwnBoards = async (): Promise<BoardWithAddress[]> => {
      if (!publicKey) return [];

      const [facilitatorRegistryPda] = findFacilitatorRegistryPda(publicKey, PROGRAM_ID);
      const facilitatorRegistryAccount = await getAccountInfo(facilitatorRegistryPda);

      if (!facilitatorRegistryAccount) {
        return [];
      }

      const facilitatorRegistry = deserializeFacilitatorRegistry(
        Buffer.from(facilitatorRegistryAccount.data)
      );

      const boardAddresses: PublicKey[] = [];
      for (let i = 0n; i < facilitatorRegistry.boardCount; i++) {
        const [boardPda] = findBoardPda(publicKey, i, PROGRAM_ID);
        boardAddresses.push(boardPda);
      }

      if (boardAddresses.length === 0) return [];

      const boardAccounts =
        await connection.getMultipleAccountsInfo(boardAddresses);

      const fetchedBoards: BoardWithAddress[] = [];
      boardAccounts.forEach((account, index) => {
        if (account) {
          fetchedBoards.push({
            address: boardAddresses[index],
            data: deserializeBoard(Buffer.from(account.data)),
          });
        }
      });

      // Sort by board index (newest first)
      fetchedBoards.sort((a, b) =>
        Number(b.data.boardIndex - a.data.boardIndex)
      );

      return fetchedBoards;
    };

    // Fetch boards where user is a participant (via BoardMembership)
    const fetchParticipatingBoards = async (): Promise<BoardWithAddress[]> => {
      if (!publicKey) return [];

      // Query BoardMembership accounts where participant == connected wallet
      const membershipEntries = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: BOARD_MEMBERSHIP_SIZE },
          { memcmp: { offset: 33, bytes: publicKey.toBase58() } },
        ],
      });

      if (membershipEntries.length === 0) return [];

      // Extract unique board addresses
      const boardAddresses: PublicKey[] = [];
      const seenBoards = new Set<string>();

      for (const entry of membershipEntries) {
        const entryData = deserializeBoardMembership(Buffer.from(entry.account.data));
        const boardKey = entryData.board.toString();
        if (!seenBoards.has(boardKey)) {
          seenBoards.add(boardKey);
          boardAddresses.push(entryData.board);
        }
      }

      // Fetch board accounts
      const boardAccounts =
        await connection.getMultipleAccountsInfo(boardAddresses);

      const fetchedBoards: BoardWithAddress[] = [];
      boardAccounts.forEach((account, index) => {
        if (account) {
          const boardData = deserializeBoard(Buffer.from(account.data));
          // Exclude boards where user is the facilitator (those are in "Your Boards")
          if (!boardData.facilitator.equals(publicKey)) {
            fetchedBoards.push({
              address: boardAddresses[index],
              data: boardData,
            });
          }
        }
      });

      // Sort by created slot (newest first)
      fetchedBoards.sort((a, b) =>
        Number(b.data.createdAtSlot - a.data.createdAtSlot)
      );

      return fetchedBoards;
    };

    fetchBoards();
  }, [publicKey, connection, getAccountInfo]);

  if (!connected) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-200 mb-4">
          Welcome to RetroQuest
        </h2>
        <p className="text-gray-400 mb-8">
          Connect your Phantom wallet to get started
        </p>
        <div className="text-6xl mb-4">🎯</div>
        <p className="text-gray-500 text-sm">
          Run retrospectives on Solana blockchain
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="text-gray-400 mt-4">Loading boards...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 mb-4">Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  const renderBoardCard = (board: BoardWithAddress, isParticipating = false) => (
    <Link
      key={board.address.toString()}
      to={`/board/${board.address.toString()}`}
      className={`block bg-gray-800 rounded-xl border p-6 hover:border-purple-500 transition-colors ${
        isParticipating ? "border-green-700" : "border-gray-700"
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            board.data.closed
              ? "bg-gray-600 text-gray-300"
              : "bg-purple-600 text-white"
          }`}
        >
          {board.data.closed ? "Closed" : STAGE_NAMES[board.data.stage]}
        </span>
        <span className="text-gray-500 text-sm">
          #{board.data.boardIndex.toString()}
        </span>
      </div>

      <h3 className="text-lg font-medium mb-2">
        Board {board.data.boardIndex.toString()}
      </h3>

      <div className="text-gray-400 text-sm space-y-1">
        <p>{board.data.categories.length} categories</p>
        <p>{board.data.allowlist.length} participants</p>
        <p>{board.data.noteCount.toString()} notes</p>
        <p>{board.data.groupCount.toString()} groups</p>
      </div>
    </Link>
  );

  const hasNoBoards = boards.length === 0 && participatingBoards.length === 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Boards</h1>
        <Link
          to="/create"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
        >
          + New Board
        </Link>
      </div>

      {hasNoBoards ? (
        <div className="text-center py-16 bg-gray-800 rounded-xl border border-gray-700">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-xl font-medium text-gray-200 mb-2">
            No boards yet
          </h3>
          <p className="text-gray-400 mb-6">
            Create your first retrospective board to get started
          </p>
          <Link
            to="/create"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
          >
            Create Board
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Your Boards (as facilitator) */}
          {boards.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-300 mb-4">
                Your Boards
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {boards.map((board) => renderBoardCard(board, false))}
              </div>
            </div>
          )}

          {/* Participating In (as participant) */}
          {participatingBoards.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-300 mb-4">
                Participating In
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {participatingBoards.map((board) =>
                  renderBoardCard(board, true)
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
