import React, { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "../../hooks/useProgram";
import { useSession } from "../../contexts/SessionContext";
import {
  createCastVoteInstruction,
  findGroupPda,
  findBoardMembershipPda,
  findVoteRecordPda,
} from "../../utils/instructions";
import {
  RetroBoard,
  NoteWithAddress,
  GroupWithAddress,
  BoardMembership,
  PROGRAM_ID,
} from "../../types";
import { GroupCard } from "../GroupCard";

interface Props {
  board: RetroBoard;
  notes: NoteWithAddress[];
  groups: GroupWithAddress[];
  membership: BoardMembership | null;
  boardAddress: PublicKey;
  refresh: () => Promise<void>;
  isOnAllowlist: boolean;
}

export const VoteStage: React.FC<Props> = ({
  board,
  notes,
  groups,
  membership,
  boardAddress,
  refresh,
  isOnAllowlist,
}) => {
  const { publicKey } = useWallet();
  const { sendInstructions, sendInstructionsWithSession } = useProgram();
  const { canSign, getSessionSigner, getSessionTokenAddress } = useSession();
  const [voting, setVoting] = useState<bigint | null>(null);

  const creditsSpent = membership?.creditsSpent || 0;
  const creditsRemaining = board.votingCreditsPerParticipant - creditsSpent;

  const handleVote = async (groupId: bigint, credits: number) => {
    if (!publicKey || !isOnAllowlist || credits > creditsRemaining) return;

    try {
      setVoting(groupId);
      // PDAs are always derived from the authority (real wallet), not session signer
      const [boardMembershipPda] = findBoardMembershipPda(
        boardAddress,
        publicKey,
        PROGRAM_ID
      );
      const [groupPda] = findGroupPda(boardAddress, groupId, PROGRAM_ID);
      const [voteRecordPda] = findVoteRecordPda(
        boardAddress,
        publicKey,
        groupId,
        PROGRAM_ID
      );

      if (canSign()) {
        const sessionSigner = getSessionSigner()!;
        const sessionToken = getSessionTokenAddress()!;

        const instruction = createCastVoteInstruction(
          boardAddress,
          boardMembershipPda,
          groupPda,
          voteRecordPda,
          sessionSigner.publicKey,
          groupId,
          credits,
          PROGRAM_ID,
          sessionToken
        );
        await sendInstructionsWithSession([instruction], sessionSigner, {
          fallbackToWallet: true,
        });
      } else {
        const instruction = createCastVoteInstruction(
          boardAddress,
          boardMembershipPda,
          groupPda,
          voteRecordPda,
          publicKey,
          groupId,
          credits,
          PROGRAM_ID
        );
        await sendInstructions([instruction]);
      }

      await refresh();
    } catch (err) {
      console.error("Error voting:", err);
    } finally {
      setVoting(null);
    }
  };

  // Create groups with their notes
  const groupsWithNotes: GroupWithAddress[] = groups.map((group) => ({
    ...group,
    notes: notes.filter(
      (n) => n.data.groupId !== null && n.data.groupId === group.data.groupId
    ),
  }));

  // Sort by vote count
  const sortedGroups = [...groupsWithNotes].sort(
    (a, b) => Number(b.data.voteTally - a.data.voteTally)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold mb-2">Vote</h2>
          <p className="text-gray-400">
            Allocate your voting credits to the groups you think are most
            important.
          </p>
        </div>

        {/* Credits display */}
        {isOnAllowlist && (
          <div className="bg-gray-700 rounded-lg px-4 py-3 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {creditsRemaining}
            </div>
            <div className="text-sm text-gray-400">credits remaining</div>
          </div>
        )}
      </div>

      {/* Vote buttons legend */}
      {isOnAllowlist && creditsRemaining > 0 && (
        <div className="bg-gray-700/50 rounded-lg p-4 text-sm text-gray-400">
          Click the vote buttons on each group to allocate your credits.
          Each click adds 1 credit.
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>No groups were created in the grouping stage.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map((group, index) => (
            <div
              key={group.address.toString()}
              className="bg-gray-700/50 rounded-lg p-4"
            >
              <div className="flex items-start gap-4">
                {/* Rank */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0
                      ? "bg-yellow-500 text-yellow-900"
                      : index === 1
                      ? "bg-gray-300 text-gray-700"
                      : index === 2
                      ? "bg-orange-600 text-orange-100"
                      : "bg-gray-600 text-gray-300"
                  }`}
                >
                  {index + 1}
                </div>

                {/* Group content */}
                <div className="flex-1">
                  <GroupCard group={group} board={board} compact />
                </div>

                {/* Vote controls */}
                <div className="flex flex-col items-center gap-2">
                  <div className="text-2xl font-bold text-purple-400">
                    {group.data.voteTally.toString()}
                  </div>
                  <div className="text-xs text-gray-500">votes</div>

                  {isOnAllowlist && creditsRemaining > 0 && (
                    <button
                      onClick={() => handleVote(group.data.groupId, 1)}
                      disabled={voting === group.data.groupId}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg text-sm font-medium mt-2"
                    >
                      {voting === group.data.groupId ? "..." : "+1 Vote"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
