import { PublicKey } from "@solana/web3.js";

// Board stages matching Rust enum
export enum BoardStage {
  Setup = 0,
  WriteNotes = 1,
  GroupDuplicates = 2,
  Vote = 3,
  Discuss = 4,
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

// Program ID (deployed on devnet)
export const PROGRAM_ID = new PublicKey(
  "4TC65BZXHNQibtPRfHwZSYVCqNQ61ehztE9oUbD8NetA"
);
