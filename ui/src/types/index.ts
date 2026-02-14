import { PublicKey } from "@solana/web3.js";

// Board stages matching Rust enum
export enum BoardStage {
  Setup = 0,
  WriteNotes = 1,
  GroupDuplicates = 2,
  Vote = 3,
  Discuss = 4,
}

// Action item status matching Rust enum
export enum ActionItemStatus {
  Pending = 0,
  Completed = 1,
}

export const STAGE_NAMES: Record<BoardStage, string> = {
  [BoardStage.Setup]: "Setup",
  [BoardStage.WriteNotes]: "Write Notes",
  [BoardStage.GroupDuplicates]: "Group Duplicates",
  [BoardStage.Vote]: "Vote",
  [BoardStage.Discuss]: "Discuss",
};

// Account types matching Rust structs
export interface FacilitatorRegistry {
  isInitialized: boolean;
  facilitator: PublicKey;
  boardCount: bigint;
  bump: number;
}

export interface RetroBoard {
  isInitialized: boolean;
  facilitator: PublicKey;
  boardIndex: bigint;
  stage: BoardStage;
  closed: boolean;
  categories: string[];
  allowlist: PublicKey[];
  votingCreditsPerParticipant: number;
  noteCount: bigint;
  groupCount: bigint;
  actionItemCount: bigint;
  createdAtSlot: bigint;
  stageChangedAtSlot: bigint;
  bump: number;
}

export interface Note {
  isInitialized: boolean;
  board: PublicKey;
  noteId: bigint;
  author: PublicKey;
  categoryId: number;
  content: string;
  createdAtSlot: bigint;
  groupId: bigint | null;
  bump: number;
}

export interface Group {
  isInitialized: boolean;
  board: PublicKey;
  groupId: bigint;
  title: string;
  createdBy: PublicKey;
  voteTally: bigint;
  bump: number;
}

export interface BoardMembership {
  isInitialized: boolean;
  board: PublicKey;
  participant: PublicKey;
  creditsSpent: number;
  totalScore: bigint;
  bump: number;
}

export interface VoteRecord {
  isInitialized: boolean;
  board: PublicKey;
  participant: PublicKey;
  groupId: bigint;
  creditsSpent: number;
  bump: number;
}

export interface ActionItem {
  isInitialized: boolean;
  board: PublicKey;
  actionItemId: bigint;
  description: string;
  owner: PublicKey;
  verifiers: PublicKey[];
  threshold: number;
  approvals: number;
  status: ActionItemStatus;
  createdAtSlot: bigint;
  verifiedAtSlot: bigint | null;
  bump: number;
}

export interface VerificationVote {
  isInitialized: boolean;
  actionItem: PublicKey;
  verifier: PublicKey;
  approved: boolean;
  votedAtSlot: bigint;
  bump: number;
}

// Session token for ephemeral signing (matches session-keys crate)
export interface SessionToken {
  authority: PublicKey;
  targetProgram: PublicKey;
  sessionSigner: PublicKey;
  validUntil: bigint;
}

// Participant identity for display names
export interface ParticipantIdentity {
  isInitialized: boolean;
  authority: PublicKey;
  username: string;
  bump: number;
}

export interface ParticipantIdentityWithAddress {
  address: PublicKey;
  data: ParticipantIdentity;
}

// Username validation constants
export const MIN_USERNAME_CHARS = 3;
export const MAX_USERNAME_CHARS = 32;

// UI-specific types
export interface BoardWithAddress {
  address: PublicKey;
  data: RetroBoard;
}

export interface NoteWithAddress {
  address: PublicKey;
  data: Note;
}

export interface GroupWithAddress {
  address: PublicKey;
  data: Group;
  notes: NoteWithAddress[];
}

export interface ActionItemWithAddress {
  address: PublicKey;
  data: ActionItem;
}

export interface VerificationVoteWithAddress {
  address: PublicKey;
  data: VerificationVote;
}

export interface SessionTokenWithAddress {
  address: PublicKey;
  data: SessionToken;
}

// Session key constants
export const DEFAULT_SESSION_VALIDITY_SECONDS = 3600; // 1 hour
export const MAX_SESSION_VALIDITY_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const DEFAULT_TOP_UP_LAMPORTS = 50_000_000n; // 0.05 SOL

// Account type discriminators (must match Rust program's state.rs)
// These are at offset 0 of each account to identify account type
export const DISCRIMINATOR_FACILITATOR_REGISTRY = 1;
export const DISCRIMINATOR_RETRO_BOARD = 2;
export const DISCRIMINATOR_BOARD_MEMBERSHIP = 3;
export const DISCRIMINATOR_NOTE = 4;
export const DISCRIMINATOR_GROUP = 5;
export const DISCRIMINATOR_VOTE_RECORD = 6;
export const DISCRIMINATOR_ACTION_ITEM = 7;
export const DISCRIMINATOR_VERIFICATION_VOTE = 8;
export const DISCRIMINATOR_PARTICIPANT_IDENTITY = 9;
export const DISCRIMINATOR_SESSION_TOKEN = 10;

// Account sizes (updated with discriminator byte at offset 0)
export const FACILITATOR_REGISTRY_SIZE = 43; // was 42
export const BOARD_MEMBERSHIP_SIZE = 76; // was 75
export const VOTE_RECORD_SIZE = 76; // was 75
export const VERIFICATION_VOTE_SIZE = 76; // was 75
export const SESSION_TOKEN_SIZE = 105; // was 104

// Program ID (deployed on devnet)
export const PROGRAM_ID = new PublicKey(
  "3xNYVWsZD2vUX6EcrzA4ErM53ydtoGHR4WR7Aua2W7cY"
);
