import React from "react";
import { GroupWithAddress, RetroBoard } from "../types";

interface Props {
  group: GroupWithAddress;
  board: RetroBoard;
  onUnassignNote?: (noteId: bigint) => void;
  compact?: boolean;
}

export const GroupCard: React.FC<Props> = ({
  group,
  board,
  onUnassignNote,
  compact = false,
}) => {
  if (compact) {
    return (
      <div>
        <h4 className="font-medium">{group.data.title}</h4>
        <div className="text-sm text-gray-400 mt-1">
          {group.notes.length} notes
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-medium text-lg">{group.data.title}</h4>
        <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm">
          {group.data.voteTally.toString()} votes
        </span>
      </div>

      {group.notes.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No notes in this group</p>
      ) : (
        <div className="space-y-2">
          {group.notes.map((note) => (
            <div
              key={note.address.toString()}
              className="bg-gray-700/50 rounded px-3 py-2 text-sm flex justify-between items-start group"
            >
              <div>
                <span className="text-gray-400 mr-2">
                  [{board.categories[note.data.categoryId]}]
                </span>
                <span className="text-gray-200">{note.data.content}</span>
              </div>
              {onUnassignNote && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnassignNote(note.data.noteId);
                  }}
                  className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  title="Remove from group"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        Created by{" "}
        <span className="font-mono">
          {group.data.createdBy.toString().slice(0, 8)}...
        </span>
      </div>
    </div>
  );
};
