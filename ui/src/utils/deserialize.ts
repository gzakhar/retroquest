import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  TeamRegistry,
  RetroSession,
  Note,
  Group,
  ParticipantEntry,
  VoteRecord,
  SessionStage,
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
function readOptionU64(buffer: Buffer, offset: number): [bigint | null, number] {
  const hasValue = buffer.readUInt8(offset);
  if (hasValue === 0) {
    return [null, 1];
  }
  return [readU64(buffer, offset + 1), 9];
}

export function deserializeTeamRegistry(data: Buffer): TeamRegistry {
  return {
    isInitialized: data.readUInt8(0) === 1,
    teamAuthority: readPublicKey(data, 1),
    sessionCount: readU64(data, 33),
    bump: data.readUInt8(41),
  };
}

export function deserializeSession(data: Buffer): RetroSession {
  let offset = 0;

  const isInitialized = data.readUInt8(offset) === 1;
  offset += 1;

  const teamAuthority = readPublicKey(data, offset);
  offset += 32;

  const facilitator = readPublicKey(data, offset);
  offset += 32;

  const sessionIndex = readU64(data, offset);
  offset += 8;

  const stage = data.readUInt8(offset) as SessionStage;
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

  const createdAtSlot = readU64(data, offset);
  offset += 8;

  const stageChangedAtSlot = readU64(data, offset);
  offset += 8;

  const bump = data.readUInt8(offset);

  return {
    isInitialized,
    teamAuthority,
    facilitator,
    sessionIndex,
    stage,
    closed,
    categories,
    allowlist,
    votingCreditsPerParticipant,
    noteCount,
    groupCount,
    createdAtSlot,
    stageChangedAtSlot,
    bump,
  };
}

export function deserializeNote(data: Buffer): Note {
  let offset = 0;

  const isInitialized = data.readUInt8(offset) === 1;
  offset += 1;

  const session = readPublicKey(data, offset);
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
    session,
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

  const session = readPublicKey(data, offset);
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
    session,
    groupId,
    title,
    createdBy,
    voteTally,
    bump,
  };
}

export function deserializeParticipantEntry(data: Buffer): ParticipantEntry {
  return {
    isInitialized: data.readUInt8(0) === 1,
    session: readPublicKey(data, 1),
    participant: readPublicKey(data, 33),
    creditsSpent: data.readUInt8(65),
    bump: data.readUInt8(66),
  };
}

export function deserializeVoteRecord(data: Buffer): VoteRecord {
  return {
    isInitialized: data.readUInt8(0) === 1,
    session: readPublicKey(data, 1),
    participant: readPublicKey(data, 33),
    groupId: readU64(data, 65),
    creditsSpent: data.readUInt8(73),
    bump: data.readUInt8(74),
  };
}
