import React, { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "../../hooks/useProgram";
import { useSession } from "../../contexts/SessionContext";
import {
  createCreateNoteInstruction,
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

interface Props {
  board: RetroBoard;
  notes: NoteWithAddress[];
  groups: GroupWithAddress[];
  membership: BoardMembership | null;
  boardAddress: PublicKey;
  refresh: () => Promise<void>;
  isOnAllowlist: boolean;
  identities?: Map<string, string>;
}

export const WriteNotesStage: React.FC<Props> = ({
  board,
  notes,
  boardAddress,
  refresh,
  isOnAllowlist,
  identities = new Map(),
}) => {
  const { publicKey } = useWallet();
  const { sendInstructions, sendInstructionsWithSession } = useProgram();
  const { canSign, getSessionSigner, getSessionTokenAddress } = useSession();
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [noteContent, setNoteContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitNote = async () => {
    if (!publicKey || !noteContent.trim() || !isOnAllowlist) return;

    try {
      setSubmitting(true);
      const [notePda] = findNotePda(boardAddress, board.noteCount, PROGRAM_ID);

      // Check if we can use session signing
      if (canSign()) {
        const sessionSigner = getSessionSigner()!;
        const sessionToken = getSessionTokenAddress()!;

        const instruction = createCreateNoteInstruction(
          boardAddress,
          notePda,
          sessionSigner.publicKey,
          selectedCategory,
          noteContent.trim(),
          PROGRAM_ID,
          sessionToken
        );
        await sendInstructionsWithSession([instruction], sessionSigner, {
          fallbackToWallet: true,
        });
      } else {
        // Fallback to wallet signing
        const instruction = createCreateNoteInstruction(
          boardAddress,
          notePda,
          publicKey,
          selectedCategory,
          noteContent.trim(),
          PROGRAM_ID
        );
        await sendInstructions([instruction]);
      }

      setNoteContent("");
      await refresh();
    } catch (err) {
      console.error("Error creating note:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Group notes by category
  const notesByCategory = board.categories.map((category, index) => ({
    category,
    categoryId: index,
    notes: notes.filter((n) => n.data.categoryId === index),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Write Notes</h2>
        <p className="text-gray-400">
          Add notes to the categories below. Notes are visible to all
          participants.
        </p>
      </div>

      {/* Add Note Form */}
      {isOnAllowlist && (
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {board.categories.map((category, index) => (
              <button
                key={index}
                onClick={() => setSelectedCategory(index)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === index
                    ? "bg-purple-600 text-white"
                    : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your note..."
              maxLength={280}
              rows={2}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 resize-none"
            />
            <button
              onClick={handleSubmitNote}
              disabled={submitting || !noteContent.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium self-end"
            >
              {submitting ? "..." : "Add"}
            </button>
          </div>
          <div className="text-right text-sm text-gray-500 mt-1">
            {noteContent.length}/280
          </div>
        </div>
      )}

      {/* Notes by Category */}
      <div className="grid md:grid-cols-3 gap-6">
        {notesByCategory.map(({ category, categoryId, notes: categoryNotes }) => (
          <div key={categoryId}>
            <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  categoryId === 0
                    ? "bg-green-500"
                    : categoryId === 1
                    ? "bg-red-500"
                    : "bg-blue-500"
                }`}
              />
              {category}
              <span className="text-gray-500 text-sm">
                ({categoryNotes.length})
              </span>
            </h3>

            <div className="space-y-3">
              {categoryNotes.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No notes yet</p>
              ) : (
                categoryNotes.map((note) => (
                    <NoteCard key={note.address.toString()} note={note} identities={identities} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
