import { PdaExplorer } from "pda-explorer-react";
import "pda-explorer-react/styles.css";
import type { PdaSchema } from "pda-explorer-react";
import { PROGRAM_ID } from "../types";

/**
 * RetroQuest PDA Schema
 * Defines all account types and their seed derivation patterns
 */
const retroquestSchema: PdaSchema = {
  programName: "RetroQuest",
  programId: PROGRAM_ID.toBase58(),
  description:
    "A gamified retrospective platform with action item tracking and verification",
  accounts: {
    ParticipantIdentity: {
      id: "ParticipantIdentity",
      name: "Participant Identity",
      seeds: [
        { name: "prefix", type: "literal", value: "participant" },
        { name: "authority", type: "pubkey", source: "User's wallet address" },
      ],
      parent: null,
      children: [],
      description:
        "Stores a user's display name. One identity per wallet, reusable across all boards.",
      color: "#8B5CF6",
      deriveFunctionName: "findParticipantIdentityPda",
    },

    SessionToken: {
      id: "SessionToken",
      name: "Session Token",
      seeds: [
        { name: "prefix", type: "literal", value: "session_token" },
        { name: "target_program", type: "pubkey", source: "RetroQuest program ID" },
        { name: "session_signer", type: "pubkey", source: "Ephemeral session keypair" },
        { name: "authority", type: "pubkey", source: "User's wallet address" },
      ],
      parent: null,
      children: [],
      description:
        "Enables gasless transactions via ephemeral signing. Created per session.",
      color: "#6B7280",
      deriveFunctionName: "findSessionTokenPda",
    },

    FacilitatorRegistry: {
      id: "FacilitatorRegistry",
      name: "Facilitator Registry",
      seeds: [
        { name: "prefix", type: "literal", value: "facilitator_registry" },
        { name: "facilitator", type: "pubkey", source: "Facilitator's wallet address" },
      ],
      parent: null,
      children: ["RetroBoard"],
      description:
        "Tracks how many boards a facilitator has created. Used for deterministic board PDA derivation.",
      color: "#3B82F6",
      deriveFunctionName: "findFacilitatorRegistryPda",
    },

    RetroBoard: {
      id: "RetroBoard",
      name: "Retro Board",
      seeds: [
        { name: "prefix", type: "literal", value: "board" },
        { name: "facilitator", type: "pubkey", source: "Facilitator's wallet address" },
        { name: "board_index", type: "u64", source: "FacilitatorRegistry.board_count at creation" },
      ],
      parent: "FacilitatorRegistry",
      children: ["BoardMembership", "Note", "Group", "VoteRecord", "ActionItem"],
      description:
        "Main retrospective board entity. Contains stage, categories, allowlist, and counters.",
      color: "#10B981",
      deriveFunctionName: "findBoardPda",
    },

    BoardMembership: {
      id: "BoardMembership",
      name: "Board Membership",
      seeds: [
        { name: "prefix", type: "literal", value: "membership" },
        { name: "board", type: "pubkey", source: "RetroBoard PDA address" },
        { name: "participant", type: "pubkey", source: "Participant's wallet address" },
      ],
      parent: "RetroBoard",
      children: [],
      description:
        "Links a participant to a board. Tracks voting credits spent and total score.",
      color: "#14B8A6",
      deriveFunctionName: "findBoardMembershipPda",
    },

    Note: {
      id: "Note",
      name: "Note",
      seeds: [
        { name: "prefix", type: "literal", value: "note" },
        { name: "board", type: "pubkey", source: "RetroBoard PDA address" },
        { name: "note_id", type: "u64", source: "RetroBoard.note_count at creation" },
      ],
      parent: "RetroBoard",
      children: [],
      description: "Individual retro note with category and optional group assignment.",
      color: "#F59E0B",
      deriveFunctionName: "findNotePda",
    },

    Group: {
      id: "Group",
      name: "Group",
      seeds: [
        { name: "prefix", type: "literal", value: "group" },
        { name: "board", type: "pubkey", source: "RetroBoard PDA address" },
        { name: "group_id", type: "u64", source: "RetroBoard.group_count at creation" },
      ],
      parent: "RetroBoard",
      children: [],
      description: "Collection of related notes created during GroupDuplicates stage.",
      color: "#F97316",
      deriveFunctionName: "findGroupPda",
    },

    VoteRecord: {
      id: "VoteRecord",
      name: "Vote Record",
      seeds: [
        { name: "prefix", type: "literal", value: "vote" },
        { name: "board", type: "pubkey", source: "RetroBoard PDA address" },
        { name: "participant", type: "pubkey", source: "Voter's wallet address" },
        { name: "group_id", type: "u64", source: "Group.group_id being voted on" },
      ],
      parent: "RetroBoard",
      children: [],
      description: "Records a participant's vote on a specific group.",
      color: "#EC4899",
      deriveFunctionName: "findVoteRecordPda",
    },

    ActionItem: {
      id: "ActionItem",
      name: "Action Item",
      seeds: [
        { name: "prefix", type: "literal", value: "action_item" },
        { name: "board", type: "pubkey", source: "RetroBoard PDA address" },
        { name: "action_item_id", type: "u64", source: "RetroBoard.action_item_count at creation" },
      ],
      parent: "RetroBoard",
      children: ["VerificationVote"],
      description: "Task with owner, verifiers, threshold, and completion status.",
      color: "#EF4444",
      deriveFunctionName: "findActionItemPda",
    },

    VerificationVote: {
      id: "VerificationVote",
      name: "Verification Vote",
      seeds: [
        { name: "prefix", type: "literal", value: "verification_vote" },
        { name: "action_item", type: "pubkey", source: "ActionItem PDA address" },
        { name: "verifier", type: "pubkey", source: "Verifier's wallet address" },
      ],
      parent: "ActionItem",
      children: [],
      description: "Records a verifier's approval or rejection of an action item.",
      color: "#F43F5E",
      deriveFunctionName: "findVerificationVotePda",
    },
  },
};

/**
 * PDA Explorer page component using the pda-explorer-react package
 */
export function PdaExplorerPage() {
  return (
    <PdaExplorer
      schema={retroquestSchema}
      height="calc(100vh - 180px)"
      showLegend={true}
      showPanel={true}
    />
  );
}
