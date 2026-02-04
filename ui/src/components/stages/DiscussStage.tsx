import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "../../hooks/useProgram";
import { useSession } from "../../contexts/SessionContext";
import {
  createCreateActionItemInstruction,
  createCastVerificationVoteInstruction,
  findActionItemPda,
  findVerificationVotePda,
  findBoardMembershipPda,
} from "../../utils/instructions";
import {
  RetroBoard,
  NoteWithAddress,
  GroupWithAddress,
  ActionItemWithAddress,
  BoardMembership,
  ActionItemStatus,
  PROGRAM_ID,
} from "../../types";
import { UsernameDisplay, getDisplayName } from "../UsernameDisplay";

interface Props {
  board: RetroBoard;
  notes: NoteWithAddress[];
  groups: GroupWithAddress[];
  actionItems: ActionItemWithAddress[];
  membership: BoardMembership | null;
  boardAddress: PublicKey;
  refresh: () => Promise<void>;
  isOnAllowlist: boolean;
  identities?: Map<string, string>;
}

export const DiscussStage: React.FC<Props> = ({
  board,
  notes,
  groups,
  actionItems,
  boardAddress,
  refresh,
  isOnAllowlist,
  identities = new Map(),
}) => {
  const { publicKey } = useWallet();
  const { sendInstructions, sendInstructionsWithSession } = useProgram();
  const { canSign, getSessionSigner, getSessionTokenAddress } = useSession();

  // Action item form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [selectedVerifiers, setSelectedVerifiers] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Verification state
  const [votingOn, setVotingOn] = useState<string | null>(null);

  // Constrain threshold when verifiers change
  useEffect(() => {
    if (selectedVerifiers.length > 0 && threshold > selectedVerifiers.length) {
      setThreshold(selectedVerifiers.length);
    }
    if (selectedVerifiers.length === 0) {
      setThreshold(1);
    }
  }, [selectedVerifiers.length, threshold]);

  const isFacilitator = publicKey && board.facilitator.equals(publicKey);

  // Create groups with their notes
  const groupsWithNotes: GroupWithAddress[] = groups.map((group) => ({
    ...group,
    notes: notes.filter(
      (n) => n.data.groupId !== null && n.data.groupId === group.data.groupId
    ),
  }));

  // Sort by vote count (descending)
  const sortedGroups = [...groupsWithNotes].sort(
    (a, b) => Number(b.data.voteTally - a.data.voteTally)
  );

  // Get ungrouped notes
  const ungroupedNotes = notes.filter((n) => n.data.groupId === null);

  // Calculate total votes
  const totalVotes = groups.reduce(
    (sum, g) => sum + Number(g.data.voteTally),
    0
  );

  // Get available participants for owner/verifier selection (excludes facilitator)
  const participantsForSelection = board.allowlist;

  const handleCreateActionItem = async () => {
    if (!publicKey || !isFacilitator || !description.trim() || !selectedOwner) return;
    if (selectedVerifiers.length === 0) return;
    if (threshold < 1 || threshold > selectedVerifiers.length) return;

    try {
      setSubmitting(true);
      const [actionItemPda] = findActionItemPda(
        boardAddress,
        board.actionItemCount,
        PROGRAM_ID
      );

      if (canSign()) {
        const sessionSigner = getSessionSigner()!;
        const sessionToken = getSessionTokenAddress()!;

        const instruction = createCreateActionItemInstruction(
          boardAddress,
          actionItemPda,
          sessionSigner.publicKey,
          description.trim(),
          new PublicKey(selectedOwner),
          selectedVerifiers.map((v) => new PublicKey(v)),
          threshold,
          PROGRAM_ID,
          sessionToken
        );

        await sendInstructionsWithSession([instruction], sessionSigner, {
          fallbackToWallet: true,
        });
      } else {
        const instruction = createCreateActionItemInstruction(
          boardAddress,
          actionItemPda,
          publicKey,
          description.trim(),
          new PublicKey(selectedOwner),
          selectedVerifiers.map((v) => new PublicKey(v)),
          threshold,
          PROGRAM_ID
        );

        await sendInstructions([instruction]);
      }

      // Reset form
      setDescription("");
      setSelectedOwner("");
      setSelectedVerifiers([]);
      setThreshold(1);
      setShowCreateForm(false);

      await refresh();
    } catch (err) {
      console.error("Error creating action item:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerificationVote = async (
    actionItem: ActionItemWithAddress,
    approved: boolean
  ) => {
    if (!publicKey) return;

    try {
      setVotingOn(actionItem.address.toString());

      // Verification vote PDA uses the real wallet (publicKey), not session signer
      const [verificationVotePda] = findVerificationVotePda(
        actionItem.address,
        publicKey,
        PROGRAM_ID
      );

      const [ownerMembershipPda] = findBoardMembershipPda(
        boardAddress,
        actionItem.data.owner,
        PROGRAM_ID
      );

      if (canSign()) {
        const sessionSigner = getSessionSigner()!;
        const sessionToken = getSessionTokenAddress()!;

        const instruction = createCastVerificationVoteInstruction(
          boardAddress,
          actionItem.address,
          verificationVotePda,
          ownerMembershipPda,
          sessionSigner.publicKey,
          actionItem.data.actionItemId,
          approved,
          PROGRAM_ID,
          sessionToken
        );

        await sendInstructionsWithSession([instruction], sessionSigner, {
          fallbackToWallet: true,
        });
      } else {
        const instruction = createCastVerificationVoteInstruction(
          boardAddress,
          actionItem.address,
          verificationVotePda,
          ownerMembershipPda,
          publicKey,
          actionItem.data.actionItemId,
          approved,
          PROGRAM_ID
        );

        await sendInstructions([instruction]);
      }
      await refresh();
    } catch (err) {
      console.error("Error casting verification vote:", err);
    } finally {
      setVotingOn(null);
    }
  };

  const toggleVerifier = (pubkeyStr: string) => {
    setSelectedVerifiers((prev) =>
      prev.includes(pubkeyStr)
        ? prev.filter((v) => v !== pubkeyStr)
        : [...prev, pubkeyStr]
    );
  };

  const canVerify = (actionItem: ActionItemWithAddress) => {
    if (!publicKey || !board.closed) return false;
    if (actionItem.data.status === ActionItemStatus.Completed) return false;
    return actionItem.data.verifiers.some((v) => v.equals(publicKey));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">
          {board.closed ? "Board Results" : "Discussion"}
        </h2>
        <p className="text-gray-400">
          {board.closed
            ? "This board has been closed. Review results and verify action items."
            : "Review the voting results and create action items."}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{notes.length}</div>
          <div className="text-sm text-gray-400">Total Notes</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{groups.length}</div>
          <div className="text-sm text-gray-400">Groups</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{totalVotes}</div>
          <div className="text-sm text-gray-400">Total Votes</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">
            {actionItems.length}
          </div>
          <div className="text-sm text-gray-400">Action Items</div>
        </div>
      </div>

      {/* Action Items Section */}
      <div className="border border-gray-600 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Action Items</h3>
          {isFacilitator && !board.closed && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
            >
              {showCreateForm ? "Cancel" : "+ Create Action Item"}
            </button>
          )}
        </div>

        {/* Create Action Item Form */}
        {showCreateForm && isFacilitator && !board.closed && (
          <div className="bg-gray-700/50 rounded-lg p-4 mb-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What needs to be done?"
                maxLength={280}
                rows={2}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 resize-none"
              />
              <div className="text-right text-sm text-gray-500">
                {description.length}/280
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Owner</label>
              <select
                value={selectedOwner}
                onChange={(e) => {
                  setSelectedOwner(e.target.value);
                  // Remove owner from verifiers if selected
                  setSelectedVerifiers((prev) =>
                    prev.filter((v) => v !== e.target.value)
                  );
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
              >
                <option value="">Select owner...</option>
                {participantsForSelection.map((p) => (
                  <option key={p.toString()} value={p.toString()}>
                    {getDisplayName(p, identities)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Verifiers (select who can verify completion)
              </label>
              <div className="flex flex-wrap gap-2">
                {participantsForSelection
                  .filter((p) => p.toString() !== selectedOwner)
                  .map((p) => (
                    <button
                      key={p.toString()}
                      onClick={() => toggleVerifier(p.toString())}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedVerifiers.includes(p.toString())
                          ? "bg-purple-600 text-white"
                          : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                      }`}
                    >
                      {getDisplayName(p, identities)}
                    </button>
                  ))}
              </div>
              {selectedOwner && participantsForSelection.length <= 1 && (
                <p className="text-yellow-400 text-sm mt-2">
                  No other participants available as verifiers
                </p>
              )}
            </div>

            {selectedVerifiers.length === 1 && (
              <div className="text-sm text-gray-400">
                Threshold: 1 approval needed (1 verifier selected)
              </div>
            )}

            {selectedVerifiers.length > 1 && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Threshold (approvals needed: {threshold} of{" "}
                  {selectedVerifiers.length})
                </label>
                <input
                  type="range"
                  min={1}
                  max={selectedVerifiers.length}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            <button
              onClick={handleCreateActionItem}
              disabled={
                submitting ||
                !description.trim() ||
                !selectedOwner ||
                selectedVerifiers.length === 0
              }
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium"
            >
              {submitting ? "Creating..." : "Create Action Item"}
            </button>
          </div>
        )}

        {/* Action Items List */}
        {actionItems.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No action items yet</p>
        ) : (
          <div className="space-y-3">
            {actionItems.map((item) => (
              <div
                key={item.address.toString()}
                className={`rounded-lg p-4 ${
                  item.data.status === ActionItemStatus.Completed
                    ? "bg-green-900/20 border border-green-600/30"
                    : "bg-gray-700/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.data.status === ActionItemStatus.Completed
                            ? "bg-green-600 text-white"
                            : "bg-yellow-600 text-white"
                        }`}
                      >
                        {item.data.status === ActionItemStatus.Completed
                          ? "Completed"
                          : "Pending"}
                      </span>
                      <span className="text-gray-400 text-sm">
                        Owner: <UsernameDisplay address={item.data.owner} identities={identities} />
                      </span>
                    </div>
                    <p className="text-white mb-2">{item.data.description}</p>
                    <div className="text-sm text-gray-400">
                      Approvals: {item.data.approvals} / {item.data.threshold}{" "}
                      needed
                      <span className="mx-2">|</span>
                      Verifiers: {item.data.verifiers.length}
                    </div>
                  </div>

                  {/* Verification buttons */}
                  {canVerify(item) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerificationVote(item, true)}
                        disabled={votingOn === item.address.toString()}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm font-medium"
                      >
                        {votingOn === item.address.toString()
                          ? "..."
                          : "Approve"}
                      </button>
                      <button
                        onClick={() => handleVerificationVote(item, false)}
                        disabled={votingOn === item.address.toString()}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-sm font-medium"
                      >
                        {votingOn === item.address.toString()
                          ? "..."
                          : "Reject"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ranked groups */}
      {sortedGroups.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Ranked by Votes</h3>
          <div className="space-y-4">
            {sortedGroups.map((group, index) => (
              <div
                key={group.address.toString()}
                className={`rounded-lg p-4 ${
                  index === 0
                    ? "bg-yellow-500/10 border border-yellow-500/30"
                    : index === 1
                    ? "bg-gray-300/10 border border-gray-400/30"
                    : index === 2
                    ? "bg-orange-500/10 border border-orange-500/30"
                    : "bg-gray-700/50"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Rank badge */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
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
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-medium">{group.data.title}</h4>
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm">
                        {group.data.voteTally.toString()} votes
                      </span>
                    </div>

                    {/* Notes in group */}
                    <div className="space-y-2 mt-3">
                      {group.notes.map((note) => (
                        <div
                          key={note.address.toString()}
                          className="bg-gray-800/50 rounded px-3 py-2 text-sm"
                        >
                          <span className="text-gray-400 mr-2">
                            [{board.categories[note.data.categoryId]}]
                          </span>
                          {note.data.content}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ungrouped notes */}
      {ungroupedNotes.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4 text-gray-400">
            Ungrouped Notes ({ungroupedNotes.length})
          </h3>
          <div className="space-y-2 bg-gray-700/30 rounded-lg p-4">
            {ungroupedNotes.map((note) => (
              <div
                key={note.address.toString()}
                className="bg-gray-800/50 rounded px-3 py-2 text-sm"
              >
                <span className="text-gray-400 mr-2">
                  [{board.categories[note.data.categoryId]}]
                </span>
                {note.data.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Board info */}
      <div className="border-t border-gray-700 pt-6 text-sm text-gray-500">
        <p>Board #{board.boardIndex.toString()}</p>
        <p>{board.allowlist.length} participants</p>
        <p>{board.votingCreditsPerParticipant} credits per participant</p>
      </div>
    </div>
  );
};
