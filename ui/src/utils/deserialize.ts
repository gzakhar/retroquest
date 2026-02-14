import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  FacilitatorRegistry,
  RetroBoard,
  Note,
  Group,
  BoardMembership,
  VoteRecord,
  ActionItem,
  VerificationVote,
  SessionToken,
  ParticipantIdentity,
  BoardStage,
  ActionItemStatus,
} from "../types";

// Helper to read PublicKey from buffer
function readPublicKey(buffer: Buffer, offset: number): PublicKey {
  return new PublicKey(buffer.slice(offset, offset + 32));
}

// Helper to read u64 as bigint from buffer (little-endian)
function readU64(buffer: Buffer, offset: number): bigint {
  return buffer.readBigUInt64LE(offset);
}

// Helper to read string (4-byte length prefix + utf8 data)
function readString(buffer: Buffer, offset: number): [string, number] {
  const length = buffer.readUInt32LE(offset);
  const str = buffer.slice(offset + 4, offset + 4 + length).toString("utf8");
  return [str, 4 + length];
}

// Helper to read Vec<String>
function readStringVec(buffer: Buffer, offset: number): [string[], number] {
  const count = buffer.readUInt32LE(offset);
  let currentOffset = offset + 4;
  const strings: string[] = [];

  for (let i = 0; i < count; i++) {
    const [str, bytesRead] = readString(buffer, currentOffset);
    strings.push(str);
    currentOffset += bytesRead;
  }

  return [strings, currentOffset - offset];
}

// Helper to read Vec<Pubkey>
function readPubkeyVec(buffer: Buffer, offset: number): [PublicKey[], number] {
  const count = buffer.readUInt32LE(offset);
  let currentOffset = offset + 4;
  const pubkeys: PublicKey[] = [];

  for (let i = 0; i < count; i++) {
    pubkeys.push(readPublicKey(buffer, currentOffset));
    currentOffset += 32;
  }

  return [pubkeys, currentOffset - offset];
}

// Helper to read Option<u64>
function readOptionU64(
  buffer: Buffer,
  offset: number
): [bigint | null, number] {
  const hasValue = buffer.readUInt8(offset);
  if (hasValue === 0) {
    return [null, 1];
  }
  return [readU64(buffer, offset + 1), 9];
}

export function deserializeFacilitatorRegistry(
  data: Buffer
): FacilitatorRegistry {
  return {
    isInitialized: data.readUInt8(0) === 1,
    facilitator: readPublicKey(data, 1),
    boardCount: readU64(data, 33),
    bump: data.readUInt8(41),
  };
}

export function deserializeBoard(data: Buffer): RetroBoard {
  let offset = 0;

  const isInitialized = data.readUInt8(offset) === 1;
  offset += 1;

  const facilitator = readPublicKey(data, offset);
  offset += 32;

  const boardIndex = readU64(data, offset);
  offset += 8;

  const stage = data.readUInt8(offset) as BoardStage;
  offset += 1;

  const closed = data.readUInt8(offset) === 1;
  offset += 1;

  const [categories, categoriesLen] = readStringVec(data, offset);
  offset += categoriesLen;

  const [allowlist, allowlistLen] = readPubkeyVec(data, offset);
  offset += allowlistLen;

  const votingCreditsPerParticipant = data.readUInt8(offset);
  offset += 1;

  const noteCount = readU64(data, offset);
  offset += 8;

  const groupCount = readU64(data, offset);
  offset += 8;

  const actionItemCount = readU64(data, offset);
  offset += 8;

  const createdAtSlot = readU64(data, offset);
  offset += 8;

  const stageChangedAtSlot = readU64(data, offset);
  offset += 8;

  const bump = data.readUInt8(offset);

  return {
    isInitialized,
    facilitator,
    boardIndex,
    stage,
    closed,
    categories,
    allowlist,
    votingCreditsPerParticipant,
    noteCount,
    groupCount,
    actionItemCount,
    createdAtSlot,
    stageChangedAtSlot,
    bump,
  };
}

export function deserializeNote(data: Buffer): Note {
  let offset = 0;

  const isInitialized = data.readUInt8(offset) === 1;
  offset += 1;

  const board = readPublicKey(data, offset);
  offset += 32;

  const noteId = readU64(data, offset);
  offset += 8;

  const author = readPublicKey(data, offset);
  offset += 32;

  const categoryId = data.readUInt8(offset);
  offset += 1;

  const [content, contentLen] = readString(data, offset);
  offset += contentLen;

  const createdAtSlot = readU64(data, offset);
  offset += 8;

  const [groupId, groupIdLen] = readOptionU64(data, offset);
  offset += groupIdLen;

  const bump = data.readUInt8(offset);

  return {
    isInitialized,
    board,
    noteId,
    author,
    categoryId,
    content,
    createdAtSlot,
    groupId,
    bump,
  };
}

export function deserializeGroup(data: Buffer): Group {
  let offset = 0;

  const isInitialized = data.readUInt8(offset) === 1;
  offset += 1;

  const board = readPublicKey(data, offset);
  offset += 32;

  const groupId = readU64(data, offset);
  offset += 8;

  const [title, titleLen] = readString(data, offset);
  offset += titleLen;

  const createdBy = readPublicKey(data, offset);
  offset += 32;

  const voteTally = readU64(data, offset);
  offset += 8;

  const bump = data.readUInt8(offset);

  return {
    isInitialized,
    board,
    groupId,
    title,
    createdBy,
    voteTally,
    bump,
  };
}

export function deserializeBoardMembership(data: Buffer): BoardMembership {
  return {
    isInitialized: data.readUInt8(0) === 1,
    board: readPublicKey(data, 1),
    participant: readPublicKey(data, 33),
    creditsSpent: data.readUInt8(65),
    totalScore: readU64(data, 66),
    bump: data.readUInt8(74),
  };
}

export function deserializeVoteRecord(data: Buffer): VoteRecord {
  return {
    isInitialized: data.readUInt8(0) === 1,
    board: readPublicKey(data, 1),
    participant: readPublicKey(data, 33),
    groupId: readU64(data, 65),
    creditsSpent: data.readUInt8(73),
    bump: data.readUInt8(74),
  };
}

export function deserializeActionItem(data: Buffer): ActionItem {
  let offset = 0;

  const isInitialized = data.readUInt8(offset) === 1;
  offset += 1;

  const board = readPublicKey(data, offset);
  offset += 32;

  const actionItemId = readU64(data, offset);
  offset += 8;

  const [description, descriptionLen] = readString(data, offset);
  offset += descriptionLen;

  const owner = readPublicKey(data, offset);
  offset += 32;

  const [verifiers, verifiersLen] = readPubkeyVec(data, offset);
  offset += verifiersLen;

  const threshold = data.readUInt8(offset);
  offset += 1;

  const approvals = data.readUInt8(offset);
  offset += 1;

  const status = data.readUInt8(offset) as ActionItemStatus;
  offset += 1;

  const createdAtSlot = readU64(data, offset);
  offset += 8;

  const [verifiedAtSlot, verifiedAtSlotLen] = readOptionU64(data, offset);
  offset += verifiedAtSlotLen;

  const bump = data.readUInt8(offset);

  return {
    isInitialized,
    board,
    actionItemId,
    description,
    owner,
    verifiers,
    threshold,
    approvals,
    status,
    createdAtSlot,
    verifiedAtSlot,
    bump,
  };
}

export function deserializeVerificationVote(data: Buffer): VerificationVote {
  return {
    isInitialized: data.readUInt8(0) === 1,
    actionItem: readPublicKey(data, 1),
    verifier: readPublicKey(data, 33),
    approved: data.readUInt8(65) === 1,
    votedAtSlot: readU64(data, 66),
    bump: data.readUInt8(74),
  };
}

// Session token layout (104 bytes):
// authority: 32 bytes
// target_program: 32 bytes
// session_signer: 32 bytes
// valid_until: 8 bytes (i64)
export function deserializeSessionToken(data: Buffer): SessionToken {
  return {
    authority: readPublicKey(data, 0),
    targetProgram: readPublicKey(data, 32),
    sessionSigner: readPublicKey(data, 64),
    validUntil: BigInt(data.readBigInt64LE(96)),
  };
}

// Participant identity layout:
// is_initialized: 1 byte
// authority: 32 bytes
// username: 4 bytes (length) + variable
// bump: 1 byte
export function deserializeParticipantIdentity(
  data: Buffer
): ParticipantIdentity {
  let offset = 0;

  const isInitialized = data.readUInt8(offset) === 1;
  offset += 1;

  const authority = readPublicKey(data, offset);
  offset += 32;

  const [username, usernameLen] = readString(data, offset);
  offset += usernameLen;

  const bump = data.readUInt8(offset);

  return {
    isInitialized,
    authority,
    username,
    bump,
  };
}
