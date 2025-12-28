import React from "react";
import { useParams, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useSession } from "../hooks/useSession";
import { useProgram } from "../hooks/useProgram";
import {
  createAdvanceStageInstruction,
  createCloseSessionInstruction,
} from "../utils/instructions";
import { SessionStage, STAGE_NAMES, PROGRAM_ID } from "../types";
import { SetupStage } from "./stages/SetupStage";
import { WriteNotesStage } from "./stages/WriteNotesStage";
import { GroupStage } from "./stages/GroupStage";
import { VoteStage } from "./stages/VoteStage";
import { DiscussStage } from "./stages/DiscussStage";

export const SessionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { publicKey } = useWallet();
  const { sendInstructions } = useProgram();

  const sessionAddress = id ? new PublicKey(id) : null;
  const { session, notes, groups, participantEntry, loading, error, refresh } =
    useSession(sessionAddress);

  const [advancing, setAdvancing] = React.useState(false);

  const isFacilitator =
    session && publicKey && session.facilitator.equals(publicKey);
  const isOnAllowlist =
    session &&
    publicKey &&
    session.allowlist.some((pk) => pk.equals(publicKey));

  const handleAdvanceStage = async () => {
    if (!session || !publicKey || !sessionAddress) return;

    try {
      setAdvancing(true);
      const nextStage = session.stage + 1;

      console.log("Advancing stage:", {
        sessionAddress: sessionAddress.toString(),
        publicKey: publicKey.toString(),
        facilitator: session.facilitator.toString(),
        currentStage: session.stage,
        nextStage,
        isFacilitator: session.facilitator.equals(publicKey),
      });

      const instruction = createAdvanceStageInstruction(
        sessionAddress,
        publicKey,
        nextStage,
        PROGRAM_ID
      );
      await sendInstructions([instruction]);
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

  const handleCloseSession = async () => {
    if (!session || !publicKey || !sessionAddress) return;

    try {
      setAdvancing(true);
      const instruction = createCloseSessionInstruction(
        sessionAddress,
        publicKey,
        PROGRAM_ID
      );
      await sendInstructions([instruction]);
      await refresh();
    } catch (err) {
      console.error("Error closing session:", err);
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="text-gray-400 mt-4">Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 mb-4">
          {error || "Session not found"}
        </p>
        <Link
          to="/"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
        >
          Back to Sessions
        </Link>
      </div>
    );
  }

  const renderStage = () => {
    const props = {
      session,
      notes,
      groups,
      participantEntry,
      sessionAddress: sessionAddress!,
      refresh,
      isOnAllowlist: isOnAllowlist || false,
    };

    switch (session.stage) {
      case SessionStage.Setup:
        return <SetupStage {...props} />;
      case SessionStage.WriteNotes:
        return <WriteNotesStage {...props} />;
      case SessionStage.GroupDuplicates:
        return <GroupStage {...props} />;
      case SessionStage.Vote:
        return <VoteStage {...props} />;
      case SessionStage.Discuss:
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
                session.closed
                  ? "bg-gray-600 text-gray-300"
                  : "bg-purple-600 text-white"
              }`}
            >
              {session.closed ? "Closed" : STAGE_NAMES[session.stage]}
            </span>
          </div>
          <h1 className="text-2xl font-bold">
            Session #{session.sessionIndex.toString()}
          </h1>
        </div>

        {/* Facilitator Controls */}
        {isFacilitator && !session.closed && (
          <div className="flex gap-2">
            {session.stage < SessionStage.Discuss && (
              <button
                onClick={handleAdvanceStage}
                disabled={advancing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium"
              >
                {advancing ? "..." : `Advance to ${STAGE_NAMES[(session.stage + 1) as SessionStage]}`}
              </button>
            )}
            {session.stage === SessionStage.Discuss && (
              <button
                onClick={handleCloseSession}
                disabled={advancing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg font-medium"
              >
                {advancing ? "..." : "Close Session"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stage Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-2xl">
          {Object.values(STAGE_NAMES).map((name, index) => (
            <React.Fragment key={name}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index < session.stage
                      ? "bg-green-500 text-white"
                      : index === session.stage
                      ? "bg-purple-500 text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {index < session.stage ? "✓" : index + 1}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    index === session.stage
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
                    index < session.stage ? "bg-green-500" : "bg-gray-700"
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
          You are not on the participant list for this session. You can view but
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
