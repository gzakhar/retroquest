import React from "react";
import { NoteWithAddress } from "../types";
import { UsernameDisplay } from "./UsernameDisplay";

interface Props {
  note: NoteWithAddress;
  categoryName?: string;
  showCategory?: boolean;
  identities?: Map<string, string>;
}

export const NoteCard: React.FC<Props> = ({
  note,
  categoryName,
  showCategory = false,
  identities = new Map(),
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors">
      {showCategory && categoryName && (
        <div className="text-xs text-purple-400 mb-1">{categoryName}</div>
      )}
      <p className="text-gray-200 text-sm">{note.data.content}</p>
      <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
        <UsernameDisplay address={note.data.author} identities={identities} />
        {note.data.groupId !== null && (
          <span className="text-purple-400">Grouped</span>
        )}
      </div>
    </div>
  );
};
