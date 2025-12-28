import { PublicKey } from "@solana/web3.js";

// Session stages matching Rust enum
export enum SessionStage {
  Setup = 0,
  WriteNotes = 1,
  GroupDuplicates = 2,
  Vote = 3,
  Discuss = 4,
}

export const STAGE_NAMES: Record<SessionStage, string> = {
  [SessionStage.Setup]: "Setup",
  [SessionStage.WriteNotes]: "Write Notes",
  [SessionStage.GroupDuplicates]: "Group Duplicates",
  [SessionStage.Vote]: "Vote",
  [SessionStage.Discuss]: "Discuss",
};

// Account types matching Rust structs
export interface TeamRegistry {
  isInitialized: boolean;
  teamAuthority: PublicKey;
  sessionCount: bigint;
  bump: number;
}

export interface RetroSession {
  isInitialized: boolean;
  teamAuthority: PublicKey;
  facilitator: PublicKey;
  sessionIndex: bigint;
  stage: SessionStage;
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
  session: PublicKey;
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
  session: PublicKey;
  groupId: bigint;
  title: string;
  createdBy: PublicKey;
  voteTally: bigint;
  bump: number;
}

export interface ParticipantEntry {
  isInitialized: boolean;
  session: PublicKey;
  participant: PublicKey;
  creditsSpent: number;
  bump: number;
}

export interface VoteRecord {
  isInitialized: boolean;
  session: PublicKey;
  participant: PublicKey;
  groupId: bigint;
  creditsSpent: number;
  bump: number;
}

// UI-specific types
export interface SessionWithAddress {
  address: PublicKey;
  data: RetroSession;
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
  "AHiDdpGftbt2mVBSeXKafgWVqTFaGtmnC2fMvXR3Uuph"
);
