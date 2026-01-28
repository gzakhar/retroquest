import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useProgram } from "../hooks/useProgram";
import { useSession } from "../contexts/SessionContext";
import {
  createInitFacilitatorRegistryInstruction,
  createCreateBoardInstruction,
  findFacilitatorRegistryPda,
  findBoardPda,
  findBoardMembershipPda,
} from "../utils/instructions";
import { deserializeFacilitatorRegistry } from "../utils/deserialize";

export const CreateBoard: React.FC = () => {
  const navigate = useNavigate();
  const { connected, publicKey } = useWallet();
  const { sendInstructions, sendInstructionsWithSession, getAccountInfo, programId } = useProgram();
  const { canSign, getSessionSigner, getSessionTokenAddress } = useSession();

  const [categories, setCategories] = useState<string[]>([
    "What went well",
    "What didn't go well",
    "Action items",
  ]);
  const [newCategory, setNewCategory] = useState("");
  const [allowlistInput, setAllowlistInput] = useState("");
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [votingCredits, setVotingCredits] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCategory = () => {
    if (newCategory.trim() && categories.length < 5) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory("");
    }
  };

  const removeCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const addParticipant = () => {
    try {
      const pubkey = new PublicKey(allowlistInput.trim());
      if (!allowlist.includes(pubkey.toString())) {
        setAllowlist([...allowlist, pubkey.toString()]);
      }
      setAllowlistInput("");
    } catch {
      setError("Invalid public key");
    }
  };

  const removeParticipant = (address: string) => {
    setAllowlist(allowlist.filter((a) => a !== address));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !connected || categories.length === 0) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const instructions = [];

      // Check if facilitator registry exists
      const [facilitatorRegistryPda] = findFacilitatorRegistryPda(publicKey, programId);
      const facilitatorRegistryAccount = await getAccountInfo(facilitatorRegistryPda);

      let boardIndex = 0n;
      let needsRegistryInit = false;

      if (!facilitatorRegistryAccount) {
        // Create facilitator registry first
        needsRegistryInit = true;
        instructions.push(
          createInitFacilitatorRegistryInstruction(publicKey, programId)
        );
      } else {
        const facilitatorRegistry = deserializeFacilitatorRegistry(
          Buffer.from(facilitatorRegistryAccount.data)
        );
        boardIndex = facilitatorRegistry.boardCount;
      }

      // Create board - use session signing if available and registry already exists
      const [boardPda] = findBoardPda(publicKey, boardIndex, programId);
      const allowlistPubkeys = allowlist.map((a) => new PublicKey(a));

      // Compute BoardMembership PDAs for each participant (enables board discovery)
      const membershipPdas = allowlistPubkeys.map((participant) => {
        const [pda] = findBoardMembershipPda(boardPda, participant, programId);
        return pda;
      });

      // Use session signing only if registry exists (to avoid mixing session and wallet signing)
      if (canSign() && !needsRegistryInit) {
        const sessionSigner = getSessionSigner()!;
        const sessionToken = getSessionTokenAddress()!;

        instructions.push(
          createCreateBoardInstruction(
            facilitatorRegistryPda,
            boardPda,
            sessionSigner.publicKey,
            categories,
            allowlistPubkeys,
            votingCredits,
            membershipPdas,
            programId,
            sessionToken
          )
        );

        await sendInstructionsWithSession(instructions, sessionSigner, {
          fallbackToWallet: true,
        });
      } else {
        instructions.push(
          createCreateBoardInstruction(
            facilitatorRegistryPda,
            boardPda,
            publicKey,
            categories,
            allowlistPubkeys,
            votingCredits,
            membershipPdas,
            programId
          )
        );

        await sendInstructions(instructions);
      }

      // Navigate to the new board
      navigate(`/board/${boardPda.toString()}`);
    } catch (err) {
      console.error("Error creating board:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      if (errorMessage.includes("not connected")) {
        setError("Wallet disconnected. Please click the wallet button to reconnect.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">
          Connect your wallet to create a board
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Create New Board</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Categories */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-medium mb-4">Categories</h2>
          <p className="text-gray-400 text-sm mb-4">
            Define the categories for your retrospective (max 5)
          </p>

          <div className="space-y-2 mb-4">
            {categories.map((category, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-700 rounded-lg px-4 py-2"
              >
                <span>{category}</span>
                <button
                  type="button"
                  onClick={() => removeCategory(index)}
                  className="text-gray-400 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {categories.length < 5 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                placeholder="Add category..."
                maxLength={32}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={addCategory}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Allowlist */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-medium mb-4">Participants (Allowlist)</h2>
          <p className="text-gray-400 text-sm mb-4">
            Add wallet addresses of participants (max 8)
          </p>

          <div className="space-y-2 mb-4">
            {allowlist.map((address) => (
              <div
                key={address}
                className="flex items-center justify-between bg-gray-700 rounded-lg px-4 py-2"
              >
                <span className="font-mono text-sm truncate">
                  {address.slice(0, 8)}...{address.slice(-8)}
                </span>
                <button
                  type="button"
                  onClick={() => removeParticipant(address)}
                  className="text-gray-400 hover:text-red-400 ml-2"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {allowlist.length < 8 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={allowlistInput}
                onChange={(e) => setAllowlistInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addParticipant())}
                placeholder="Wallet address..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={addParticipant}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Voting Credits */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-medium mb-4">Voting Credits</h2>
          <p className="text-gray-400 text-sm mb-4">
            Number of voting credits per participant
          </p>

          <input
            type="range"
            min="1"
            max="20"
            value={votingCredits}
            onChange={(e) => setVotingCredits(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-400 mt-2">
            <span>1</span>
            <span className="text-purple-400 font-medium">
              {votingCredits} credits
            </span>
            <span>20</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || categories.length === 0}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
              Creating...
            </span>
          ) : (
            "Create Board"
          )}
        </button>
      </form>
    </div>
  );
};
