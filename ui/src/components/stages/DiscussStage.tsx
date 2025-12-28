import React from "react";
import { PublicKey } from "@solana/web3.js";
import {
  RetroSession,
  NoteWithAddress,
  GroupWithAddress,
  ParticipantEntry,
} from "../../types";
// GroupCard not used in this component - inline rendering instead

interface Props {
  session: RetroSession;
  notes: NoteWithAddress[];
  groups: GroupWithAddress[];
  participantEntry: ParticipantEntry | null;
  sessionAddress: PublicKey;
  refresh: () => Promise<void>;
  isOnAllowlist: boolean;
}

export const DiscussStage: React.FC<Props> = ({
  session,
  notes,
  groups,
}) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">
          {session.closed ? "Session Results" : "Discussion"}
        </h2>
        <p className="text-gray-400">
          {session.closed
            ? "This session has been closed. Here are the final results."
            : "Review the voting results and discuss the most important topics."}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {notes.length}
          </div>
          <div className="text-sm text-gray-400">Total Notes</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {groups.length}
          </div>
          <div className="text-sm text-gray-400">Groups</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">
            {totalVotes}
          </div>
          <div className="text-sm text-gray-400">Total Votes</div>
        </div>
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
                            [{session.categories[note.data.categoryId]}]
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
                  [{session.categories[note.data.categoryId]}]
                </span>
                {note.data.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session info */}
      <div className="border-t border-gray-700 pt-6 text-sm text-gray-500">
        <p>Session #{session.sessionIndex.toString()}</p>
        <p>{session.allowlist.length} participants</p>
        <p>{session.votingCreditsPerParticipant} credits per participant</p>
      </div>
    </div>
  );
};
