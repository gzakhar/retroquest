import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import * as borsh from "borsh";
import {
  findTeamRegistryPda,
  findSessionPda,
  findNotePda,
  findGroupPda,
  findParticipantEntryPda,
  findVoteRecordPda,
} from "./pda";

// Instruction discriminators (must match instructions.rs)
const INIT_TEAM_REGISTRY = 0;
const CREATE_SESSION = 1;
const ADVANCE_STAGE = 2;
const CLOSE_SESSION = 3;
const CREATE_NOTE = 4;
const CREATE_GROUP = 5;
const SET_GROUP_TITLE = 6;
const ASSIGN_NOTE_TO_GROUP = 7;
const UNASSIGN_NOTE = 8;
const CAST_VOTE = 9;

// Borsh schema definitions
const createSessionSchema = {
  struct: {
    categories: { array: { type: "string" } },
    allowlist: { array: { type: { array: { type: "u8", len: 32 } } } },
    voting_credits_per_participant: { option: "u8" },
  },
};

const advanceStageSchema = {
  struct: {
    new_stage: "u8",
  },
};

const createNoteSchema = {
  struct: {
    category_id: "u8",
    content: "string",
  },
};

const createGroupSchema = {
  struct: {
    title: "string",
  },
};

const setGroupTitleSchema = {
  struct: {
    group_id: "u64",
    title: "string",
  },
};

const assignNoteSchema = {
  struct: {
    note_id: "u64",
    group_id: "u64",
  },
};

const unassignNoteSchema = {
  struct: {
    note_id: "u64",
  },
};

const castVoteSchema = {
  struct: {
    group_id: "u64",
    credits_delta: "u8",
  },
};

function serializeInstruction(discriminator: number, payload?: Buffer): Buffer {
  if (payload) {
    return Buffer.concat([Buffer.from([discriminator]), payload]);
  }
  return Buffer.from([discriminator]);
}

export function createInitTeamRegistryInstruction(
  teamAuthority: PublicKey,
  programId: PublicKey
): TransactionInstruction {
  const [teamRegistry] = findTeamRegistryPda(teamAuthority, programId);

  return new TransactionInstruction({
    keys: [
      { pubkey: teamRegistry, isSigner: false, isWritable: true },
      { pubkey: teamAuthority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: serializeInstruction(INIT_TEAM_REGISTRY),
  });
}

export function createCreateSessionInstruction(
  teamRegistry: PublicKey,
  session: PublicKey,
  teamAuthority: PublicKey,
  categories: string[],
  allowlist: PublicKey[],
  votingCreditsPerParticipant: number | null,
  programId: PublicKey
): TransactionInstruction {
  const payload = {
    categories,
    allowlist: allowlist.map((pk) => Array.from(pk.toBytes())),
    voting_credits_per_participant: votingCreditsPerParticipant,
  };

  const serialized = borsh.serialize(createSessionSchema as any, payload);

  return new TransactionInstruction({
    keys: [
      { pubkey: teamRegistry, isSigner: false, isWritable: true },
      { pubkey: session, isSigner: false, isWritable: true },
      { pubkey: teamAuthority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: serializeInstruction(CREATE_SESSION, Buffer.from(serialized)),
  });
}

export function createAdvanceStageInstruction(
  session: PublicKey,
  facilitator: PublicKey,
  newStage: number,
  programId: PublicKey
): TransactionInstruction {
  const payload = { new_stage: newStage };
  const serialized = borsh.serialize(advanceStageSchema as any, payload);

  return new TransactionInstruction({
    keys: [
      { pubkey: session, isSigner: false, isWritable: true },
      { pubkey: facilitator, isSigner: true, isWritable: false },
    ],
    programId,
    data: serializeInstruction(ADVANCE_STAGE, Buffer.from(serialized)),
  });
}

export function createCloseSessionInstruction(
  session: PublicKey,
  facilitator: PublicKey,
  programId: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: session, isSigner: false, isWritable: true },
      { pubkey: facilitator, isSigner: true, isWritable: false },
    ],
    programId,
    data: serializeInstruction(CLOSE_SESSION),
  });
}

export function createCreateNoteInstruction(
  session: PublicKey,
  note: PublicKey,
  author: PublicKey,
  categoryId: number,
  content: string,
  programId: PublicKey
): TransactionInstruction {
  const payload = { category_id: categoryId, content };
  const serialized = borsh.serialize(createNoteSchema as any, payload);

  return new TransactionInstruction({
    keys: [
      { pubkey: session, isSigner: false, isWritable: true },
      { pubkey: note, isSigner: false, isWritable: true },
      { pubkey: author, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: serializeInstruction(CREATE_NOTE, Buffer.from(serialized)),
  });
}

export function createCreateGroupInstruction(
  session: PublicKey,
  group: PublicKey,
  creator: PublicKey,
  title: string,
  programId: PublicKey
): TransactionInstruction {
  const payload = { title };
  const serialized = borsh.serialize(createGroupSchema as any, payload);

  return new TransactionInstruction({
    keys: [
      { pubkey: session, isSigner: false, isWritable: true },
      { pubkey: group, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: serializeInstruction(CREATE_GROUP, Buffer.from(serialized)),
  });
}

export function createSetGroupTitleInstruction(
  session: PublicKey,
  group: PublicKey,
  participant: PublicKey,
  groupId: bigint,
  title: string,
  programId: PublicKey
): TransactionInstruction {
  const payload = { group_id: groupId, title };
  const serialized = borsh.serialize(setGroupTitleSchema as any, payload);

  return new TransactionInstruction({
    keys: [
      { pubkey: session, isSigner: false, isWritable: false },
      { pubkey: group, isSigner: false, isWritable: true },
      { pubkey: participant, isSigner: true, isWritable: false },
    ],
    programId,
    data: serializeInstruction(SET_GROUP_TITLE, Buffer.from(serialized)),
  });
}

export function createAssignNoteToGroupInstruction(
  session: PublicKey,
  note: PublicKey,
  group: PublicKey,
  participant: PublicKey,
  noteId: bigint,
  groupId: bigint,
  programId: PublicKey
): TransactionInstruction {
  const payload = { note_id: noteId, group_id: groupId };
  const serialized = borsh.serialize(assignNoteSchema as any, payload);

  return new TransactionInstruction({
    keys: [
      { pubkey: session, isSigner: false, isWritable: false },
      { pubkey: note, isSigner: false, isWritable: true },
      { pubkey: group, isSigner: false, isWritable: false },
      { pubkey: participant, isSigner: true, isWritable: false },
    ],
    programId,
    data: serializeInstruction(ASSIGN_NOTE_TO_GROUP, Buffer.from(serialized)),
  });
}

export function createUnassignNoteInstruction(
  session: PublicKey,
  note: PublicKey,
  participant: PublicKey,
  noteId: bigint,
  programId: PublicKey
): TransactionInstruction {
  const payload = { note_id: noteId };
  const serialized = borsh.serialize(unassignNoteSchema as any, payload);

  return new TransactionInstruction({
    keys: [
      { pubkey: session, isSigner: false, isWritable: false },
      { pubkey: note, isSigner: false, isWritable: true },
      { pubkey: participant, isSigner: true, isWritable: false },
    ],
    programId,
    data: serializeInstruction(UNASSIGN_NOTE, Buffer.from(serialized)),
  });
}

export function createCastVoteInstruction(
  session: PublicKey,
  participantEntry: PublicKey,
  group: PublicKey,
  voteRecord: PublicKey,
  voter: PublicKey,
  groupId: bigint,
  creditsDelta: number,
  programId: PublicKey
): TransactionInstruction {
  const payload = { group_id: groupId, credits_delta: creditsDelta };
  const serialized = borsh.serialize(castVoteSchema as any, payload);

  return new TransactionInstruction({
    keys: [
      { pubkey: session, isSigner: false, isWritable: false },
      { pubkey: participantEntry, isSigner: false, isWritable: true },
      { pubkey: group, isSigner: false, isWritable: true },
      { pubkey: voteRecord, isSigner: false, isWritable: true },
      { pubkey: voter, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: serializeInstruction(CAST_VOTE, Buffer.from(serialized)),
  });
}

// Re-export PDA helpers for convenience
export {
  findTeamRegistryPda,
  findSessionPda,
  findNotePda,
  findGroupPda,
  findParticipantEntryPda,
  findVoteRecordPda,
};
