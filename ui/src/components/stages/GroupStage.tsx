import React, { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "../../hooks/useProgram";
import {
  createCreateGroupInstruction,
  createAssignNoteToGroupInstruction,
  createUnassignNoteInstruction,
  findGroupPda,
  findNotePda,
} from "../../utils/instructions";
import {
  RetroBoard,
  NoteWithAddress,
  GroupWithAddress,
  BoardMembership,
  PROGRAM_ID,
} from "../../types";
import { NoteCard } from "../NoteCard";
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

export const GroupStage: React.FC<Props> = ({
  board,
  notes,
  groups,
  boardAddress,
  refresh,
  isOnAllowlist,
}) => {
  const { publicKey } = useWallet();
  const { sendInstructions } = useProgram();
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteWithAddress | null>(null);

  const handleCreateGroup = async () => {
    if (!publicKey || !newGroupTitle.trim() || !isOnAllowlist) return;

    try {
      setCreating(true);
      const [groupPda] = findGroupPda(boardAddress, board.groupCount, PROGRAM_ID);
      const instruction = createCreateGroupInstruction(
        boardAddress,
        groupPda,
        publicKey,
        newGroupTitle.trim(),
        PROGRAM_ID
      );
      await sendInstructions([instruction]);
      setNewGroupTitle("");
      await refresh();
    } catch (err) {
      console.error("Error creating group:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleAssignNote = async (noteId: bigint, groupId: bigint) => {
    if (!publicKey || !isOnAllowlist) return;

    try {
      const [notePda] = findNotePda(boardAddress, noteId, PROGRAM_ID);
      const [groupPda] = findGroupPda(boardAddress, groupId, PROGRAM_ID);
      const instruction = createAssignNoteToGroupInstruction(
        boardAddress,
        notePda,
        groupPda,
        publicKey,
        noteId,
        groupId,
        PROGRAM_ID
      );
      await sendInstructions([instruction]);
      setSelectedNote(null);
      await refresh();
    } catch (err) {
      console.error("Error assigning note:", err);
    }
  };

  const handleUnassignNote = async (noteId: bigint) => {
    if (!publicKey || !isOnAllowlist) return;

    try {
      const [notePda] = findNotePda(boardAddress, noteId, PROGRAM_ID);
      const instruction = createUnassignNoteInstruction(
        boardAddress,
        notePda,
        publicKey,
        noteId,
        PROGRAM_ID
      );
      await sendInstructions([instruction]);
      await refresh();
    } catch (err) {
      console.error("Error unassigning note:", err);
    }
  };

  // Separate ungrouped and grouped notes
  const ungroupedNotes = notes.filter((n) => n.data.groupId === null);

  // Create groups with their notes
  const groupsWithNotes: GroupWithAddress[] = groups.map((group) => ({
    ...group,
    notes: notes.filter(
      (n) => n.data.groupId !== null && n.data.groupId === group.data.groupId
    ),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Group Duplicates</h2>
        <p className="text-gray-400">
          Create groups and drag similar notes together. Click a note, then
          click a group to assign it.
        </p>
      </div>

      {/* Create Group Form */}
      {isOnAllowlist && (
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newGroupTitle}
              onChange={(e) => setNewGroupTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              placeholder="New group title..."
              maxLength={80}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleCreateGroup}
              disabled={creating || !newGroupTitle.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium"
            >
              {creating ? "..." : "Create Group"}
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ungrouped Notes */}
        <div>
          <h3 className="text-lg font-medium mb-3">
            Ungrouped Notes ({ungroupedNotes.length})
          </h3>
          <div className="space-y-2 min-h-[200px] bg-gray-700/30 rounded-lg p-4">
            {ungroupedNotes.length === 0 ? (
              <p className="text-gray-500 text-sm italic text-center py-8">
                All notes have been grouped
              </p>
            ) : (
              ungroupedNotes.map((note) => (
                <div
                  key={note.address.toString()}
                  onClick={() => isOnAllowlist && setSelectedNote(note)}
                  className={`cursor-pointer transition-all ${
                    selectedNote?.address.equals(note.address)
                      ? "ring-2 ring-purple-500"
                      : ""
                  }`}
                >
                  <NoteCard
                    note={note}
                    categoryName={board.categories[note.data.categoryId]}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Groups */}
        <div>
          <h3 className="text-lg font-medium mb-3">
            Groups ({groups.length})
          </h3>
          <div className="space-y-4">
            {groups.length === 0 ? (
              <p className="text-gray-500 text-sm italic text-center py-8 bg-gray-700/30 rounded-lg">
                No groups created yet
              </p>
            ) : (
              groupsWithNotes.map((group) => (
                <div
                  key={group.address.toString()}
                  onClick={() =>
                    selectedNote &&
                    handleAssignNote(selectedNote.data.noteId, group.data.groupId)
                  }
                  className={`cursor-pointer transition-all ${
                    selectedNote ? "hover:ring-2 hover:ring-purple-500" : ""
                  }`}
                >
                  <GroupCard
                    group={group}
                    board={board}
                    onUnassignNote={isOnAllowlist ? handleUnassignNote : undefined}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Selection hint */}
      {selectedNote && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg">
          Click a group to assign the selected note
          <button
            onClick={() => setSelectedNote(null)}
            className="ml-3 text-purple-200 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
