import React from "react";
import { useParams, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useBoard } from "../hooks/useBoard";
import { useProgram } from "../hooks/useProgram";
import { useSession } from "../contexts/SessionContext";
import {
  createAdvanceStageInstruction,
  createCloseBoardInstruction,
} from "../utils/instructions";
import { BoardStage, STAGE_NAMES, PROGRAM_ID } from "../types";
import { SetupStage } from "./stages/SetupStage";
import { WriteNotesStage } from "./stages/WriteNotesStage";
import { GroupStage } from "./stages/GroupStage";
import { VoteStage } from "./stages/VoteStage";
import { DiscussStage } from "./stages/DiscussStage";

export const BoardView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { publicKey } = useWallet();
  const { sendInstructions, sendInstructionsWithSession } = useProgram();
  const { canSign, getSessionSigner, getSessionTokenAddress } = useSession();

  const boardAddress = id ? new PublicKey(id) : null;
  const { board, notes, groups, actionItems, membership, identities, loading, error, refresh } =
    useBoard(boardAddress);

  const [advancing, setAdvancing] = React.useState(false);

  const isFacilitator =
    board && publicKey && board.facilitator.equals(publicKey);
  const isOnAllowlist =
    board &&
    publicKey &&
    board.allowlist.some((pk) => pk.equals(publicKey));

  const handleAdvanceStage = async () => {
    if (!board || !publicKey || !boardAddress) return;

    try {
      setAdvancing(true);
      const nextStage = board.stage + 1;

      console.log("Advancing stage:", {
        boardAddress: boardAddress.toString(),
        publicKey: publicKey.toString(),
        facilitator: board.facilitator.toString(),
        currentStage: board.stage,
        nextStage,
        isFacilitator: board.facilitator.equals(publicKey),
      });

      if (canSign()) {
        const sessionSigner = getSessionSigner()!;
        const sessionToken = getSessionTokenAddress()!;

        const instruction = createAdvanceStageInstruction(
          boardAddress,
          sessionSigner.publicKey,
          nextStage,
          PROGRAM_ID,
          sessionToken
        );
        await sendInstructionsWithSession([instruction], sessionSigner, {
          fallbackToWallet: true,
        });
      } else {
        const instruction = createAdvanceStageInstruction(
          boardAddress,
          publicKey,
          nextStage,
          PROGRAM_ID
        );
        await sendInstructions([instruction]);
      }
      await refresh();
    } catch (err: any) {
      console.error("Error advancing stage:", err);
      // Try to extract more detailed error info
      if (err?.logs) {
        console.error("Transaction logs:", err.logs);
      }
      if (err?.message) {
        console.error("Error message:", err.message);
      }
    } finally {
      setAdvancing(false);
    }
  };

  const handleCloseBoard = async () => {
    if (!board || !publicKey || !boardAddress) return;

    try {
      setAdvancing(true);

      if (canSign()) {
        const sessionSigner = getSessionSigner()!;
        const sessionToken = getSessionTokenAddress()!;

        const instruction = createCloseBoardInstruction(
          boardAddress,
          sessionSigner.publicKey,
          PROGRAM_ID,
          sessionToken
        );
        await sendInstructionsWithSession([instruction], sessionSigner, {
          fallbackToWallet: true,
        });
      } else {
        const instruction = createCloseBoardInstruction(
          boardAddress,
          publicKey,
          PROGRAM_ID
        );
        await sendInstructions([instruction]);
      }
      await refresh();
    } catch (err) {
      console.error("Error closing board:", err);
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="text-gray-400 mt-4">Loading board...</p>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 mb-4">
          {error || "Board not found"}
        </p>
        <Link
          to="/"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
        >
          Back to Boards
        </Link>
      </div>
    );
  }

  const renderStage = () => {
    const props = {
      board,
      notes,
      groups,
      actionItems,
      membership,
      boardAddress: boardAddress!,
      refresh,
      isOnAllowlist: isOnAllowlist || false,
      identities,
    };

    switch (board.stage) {
      case BoardStage.Setup:
        return <SetupStage {...props} />;
      case BoardStage.WriteNotes:
        return <WriteNotesStage {...props} />;
      case BoardStage.GroupDuplicates:
        return <GroupStage {...props} />;
      case BoardStage.Vote:
        return <VoteStage {...props} />;
      case BoardStage.Discuss:
        return <DiscussStage {...props} />;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/" className="text-gray-400 hover:text-white">
              ← Back
            </Link>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                board.closed
                  ? "bg-gray-600 text-gray-300"
                  : "bg-purple-600 text-white"
              }`}
            >
              {board.closed ? "Closed" : STAGE_NAMES[board.stage]}
            </span>
          </div>
          <h1 className="text-2xl font-bold">
            Board #{board.boardIndex.toString()}
          </h1>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Facilitator Controls */}
          {isFacilitator && !board.closed && (
            <div className="flex gap-2">
              {board.stage < BoardStage.Discuss && (
                <button
                  onClick={handleAdvanceStage}
                  disabled={advancing}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium"
                >
                  {advancing ? "..." : `Advance to ${STAGE_NAMES[(board.stage + 1) as BoardStage]}`}
                </button>
              )}
              {board.stage === BoardStage.Discuss && (
                <button
                  onClick={handleCloseBoard}
                  disabled={advancing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg font-medium"
                >
                  {advancing ? "..." : "Close Board"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stage Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-2xl">
          {Object.values(STAGE_NAMES).map((name, index) => (
            <React.Fragment key={name}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index < board.stage
                      ? "bg-green-500 text-white"
                      : index === board.stage
                      ? "bg-purple-500 text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {index < board.stage ? "✓" : index + 1}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    index === board.stage
                      ? "text-purple-400"
                      : "text-gray-500"
                  }`}
                >
                  {name}
                </span>
              </div>
              {index < 4 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    index < board.stage ? "bg-green-500" : "bg-gray-700"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Participant Status */}
      {!isOnAllowlist && !isFacilitator && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-8 text-yellow-300">
          You are not on the participant list for this board. You can view but
          not participate.
        </div>
      )}

      {/* Stage Content */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        {renderStage()}
      </div>
    </div>
  );
};
