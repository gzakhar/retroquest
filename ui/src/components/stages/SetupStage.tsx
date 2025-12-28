import React from "react";
import { PublicKey } from "@solana/web3.js";
import {
  RetroSession,
  NoteWithAddress,
  GroupWithAddress,
  ParticipantEntry,
} from "../../types";

interface Props {
  session: RetroSession;
  notes: NoteWithAddress[];
  groups: GroupWithAddress[];
  participantEntry: ParticipantEntry | null;
  sessionAddress: PublicKey;
  refresh: () => Promise<void>;
  isOnAllowlist: boolean;
}

export const SetupStage: React.FC<Props> = ({ session }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Session Setup</h2>
        <p className="text-gray-400 mb-6">
          The session is being configured. The facilitator will advance to the
          Write Notes stage when ready.
        </p>
      </div>

      {/* Categories */}
      <div>
        <h3 className="text-lg font-medium mb-3">Categories</h3>
        <div className="flex flex-wrap gap-2">
          {session.categories.map((category, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-gray-700 rounded-full text-sm"
            >
              {category}
            </span>
          ))}
        </div>
      </div>

      {/* Participants */}
      <div>
        <h3 className="text-lg font-medium mb-3">
          Participants ({session.allowlist.length})
        </h3>
        <div className="space-y-2">
          {session.allowlist.map((participant) => (
            <div
              key={participant.toString()}
              className="flex items-center gap-2 text-gray-300"
            >
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="font-mono text-sm">
                {participant.toString().slice(0, 8)}...
                {participant.toString().slice(-8)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Voting Credits */}
      <div>
        <h3 className="text-lg font-medium mb-3">Voting Configuration</h3>
        <p className="text-gray-400">
          Each participant will have{" "}
          <span className="text-purple-400 font-medium">
            {session.votingCreditsPerParticipant} voting credits
          </span>{" "}
          to allocate during the voting stage.
        </p>
      </div>

      {/* Facilitator Info */}
      <div className="border-t border-gray-700 pt-6">
        <h3 className="text-lg font-medium mb-3">Facilitator</h3>
        <p className="font-mono text-sm text-gray-400">
          {session.facilitator.toString()}
        </p>
      </div>
    </div>
  );
};
