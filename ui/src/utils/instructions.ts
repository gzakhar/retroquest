import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import * as borsh from "borsh";
import {
  findFacilitatorRegistryPda,
  findBoardPda,
  findNotePda,
  findGroupPda,
  findBoardMembershipPda,
  findVoteRecordPda,
  findActionItemPda,
  findVerificationVotePda,
  findSessionTokenPda,
} from "./pda";

// Instruction discriminators (must match instructions.rs)
const INIT_FACILITATOR_REGISTRY = 0;
const CREATE_BOARD = 1;
const ADVANCE_STAGE = 2;
const CLOSE_BOARD = 3;
const CREATE_NOTE = 4;
const CREATE_GROUP = 5;
const SET_GROUP_TITLE = 6;
const ASSIGN_NOTE_TO_GROUP = 7;
const UNASSIGN_NOTE = 8;
const CAST_VOTE = 9;
const CREATE_ACTION_ITEM = 10;
const CAST_VERIFICATION_VOTE = 11;
const CREATE_SESSION = 12;
const REVOKE_SESSION = 13;

// Borsh schema definitions
const createBoardSchema = {
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

const createActionItemSchema = {
  struct: {
    description: "string",
    owner: { array: { type: "u8", len: 32 } },
    verifiers: { array: { type: { array: { type: "u8", len: 32 } } } },
    threshold: "u8",
  },
};

const castVerificationVoteSchema = {
  struct: {
    action_item_id: "u64",
    approved: "bool",
  },
};

const createSessionSchema = {
  struct: {
    valid_until: "i64",
    top_up_lamports: { option: "u64" },
  },
};

function serializeInstruction(discriminator: number, payload?: Buffer): Buffer {
  if (payload) {
    return Buffer.concat([Buffer.from([discriminator]), payload]);
  }
  return Buffer.from([discriminator]);
}

export function createInitFacilitatorRegistryInstruction(
  facilitator: PublicKey,
  programId: PublicKey
): TransactionInstruction {
  const [facilitatorRegistry] = findFacilitatorRegistryPda(facilitator, programId);

  return new TransactionInstruction({
    keys: [
      { pubkey: facilitatorRegistry, isSigner: false, isWritable: true },
      { pubkey: facilitator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: serializeInstruction(INIT_FACILITATOR_REGISTRY),
  });
}

export function createCreateBoardInstruction(
  facilitatorRegistry: PublicKey,
  board: PublicKey,
  signer: PublicKey,
  categories: string[],
  allowlist: PublicKey[],
  votingCreditsPerParticipant: number | null,
  membershipAccounts: PublicKey[],
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const payload = {
    categories,
    allowlist: allowlist.map((pk) => Array.from(pk.toBytes())),
    voting_credits_per_participant: votingCreditsPerParticipant,
  };

  const serialized = borsh.serialize(createBoardSchema as any, payload);

  const keys = [
    { pubkey: facilitatorRegistry, isSigner: false, isWritable: true },
    { pubkey: board, isSigner: false, isWritable: true },
    { pubkey: signer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  // Session token comes after system_program but before membership accounts
  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  // BoardMembership accounts for each allowlist member (enables board discovery)
  for (const ma of membershipAccounts) {
    keys.push({ pubkey: ma, isSigner: false, isWritable: true });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(CREATE_BOARD, Buffer.from(serialized)),
  });
}

export function createAdvanceStageInstruction(
  board: PublicKey,
  signer: PublicKey,
  newStage: number,
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const payload = { new_stage: newStage };
  const serialized = borsh.serialize(advanceStageSchema as any, payload);

  const keys = [
    { pubkey: board, isSigner: false, isWritable: true },
    { pubkey: signer, isSigner: true, isWritable: false },
  ];

  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(ADVANCE_STAGE, Buffer.from(serialized)),
  });
}

export function createCloseBoardInstruction(
  board: PublicKey,
  signer: PublicKey,
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const keys = [
    { pubkey: board, isSigner: false, isWritable: true },
    { pubkey: signer, isSigner: true, isWritable: false },
  ];

  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(CLOSE_BOARD),
  });
}

export function createCreateNoteInstruction(
  board: PublicKey,
  note: PublicKey,
  signer: PublicKey,
  categoryId: number,
  content: string,
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const payload = { category_id: categoryId, content };
  const serialized = borsh.serialize(createNoteSchema as any, payload);

  const keys = [
    { pubkey: board, isSigner: false, isWritable: true },
    { pubkey: note, isSigner: false, isWritable: true },
    { pubkey: signer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(CREATE_NOTE, Buffer.from(serialized)),
  });
}

export function createCreateGroupInstruction(
  board: PublicKey,
  group: PublicKey,
  signer: PublicKey,
  title: string,
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const payload = { title };
  const serialized = borsh.serialize(createGroupSchema as any, payload);

  const keys = [
    { pubkey: board, isSigner: false, isWritable: true },
    { pubkey: group, isSigner: false, isWritable: true },
    { pubkey: signer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(CREATE_GROUP, Buffer.from(serialized)),
  });
}

export function createSetGroupTitleInstruction(
  board: PublicKey,
  group: PublicKey,
  signer: PublicKey,
  groupId: bigint,
  title: string,
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const payload = { group_id: groupId, title };
  const serialized = borsh.serialize(setGroupTitleSchema as any, payload);

  const keys = [
    { pubkey: board, isSigner: false, isWritable: false },
    { pubkey: group, isSigner: false, isWritable: true },
    { pubkey: signer, isSigner: true, isWritable: false },
  ];

  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(SET_GROUP_TITLE, Buffer.from(serialized)),
  });
}

export function createAssignNoteToGroupInstruction(
  board: PublicKey,
  note: PublicKey,
  group: PublicKey,
  signer: PublicKey,
  noteId: bigint,
  groupId: bigint,
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const payload = { note_id: noteId, group_id: groupId };
  const serialized = borsh.serialize(assignNoteSchema as any, payload);

  const keys = [
    { pubkey: board, isSigner: false, isWritable: false },
    { pubkey: note, isSigner: false, isWritable: true },
    { pubkey: group, isSigner: false, isWritable: false },
    { pubkey: signer, isSigner: true, isWritable: false },
  ];

  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(ASSIGN_NOTE_TO_GROUP, Buffer.from(serialized)),
  });
}

export function createUnassignNoteInstruction(
  board: PublicKey,
  note: PublicKey,
  signer: PublicKey,
  noteId: bigint,
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const payload = { note_id: noteId };
  const serialized = borsh.serialize(unassignNoteSchema as any, payload);

  const keys = [
    { pubkey: board, isSigner: false, isWritable: false },
    { pubkey: note, isSigner: false, isWritable: true },
    { pubkey: signer, isSigner: true, isWritable: false },
  ];

  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(UNASSIGN_NOTE, Buffer.from(serialized)),
  });
}

export function createCastVoteInstruction(
  board: PublicKey,
  boardMembership: PublicKey,
  group: PublicKey,
  voteRecord: PublicKey,
  signer: PublicKey,
  groupId: bigint,
  creditsDelta: number,
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const payload = { group_id: groupId, credits_delta: creditsDelta };
  const serialized = borsh.serialize(castVoteSchema as any, payload);

  const keys = [
    { pubkey: board, isSigner: false, isWritable: false },
    { pubkey: boardMembership, isSigner: false, isWritable: true },
    { pubkey: group, isSigner: false, isWritable: true },
    { pubkey: voteRecord, isSigner: false, isWritable: true },
    { pubkey: signer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(CAST_VOTE, Buffer.from(serialized)),
  });
}

export function createCreateActionItemInstruction(
  board: PublicKey,
  actionItem: PublicKey,
  signer: PublicKey,
  description: string,
  owner: PublicKey,
  verifiers: PublicKey[],
  threshold: number,
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const payload = {
    description,
    owner: Array.from(owner.toBytes()),
    verifiers: verifiers.map((pk) => Array.from(pk.toBytes())),
    threshold,
  };
  const serialized = borsh.serialize(createActionItemSchema as any, payload);

  const keys = [
    { pubkey: board, isSigner: false, isWritable: true },
    { pubkey: actionItem, isSigner: false, isWritable: true },
    { pubkey: signer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(CREATE_ACTION_ITEM, Buffer.from(serialized)),
  });
}

export function createCastVerificationVoteInstruction(
  board: PublicKey,
  actionItem: PublicKey,
  verificationVote: PublicKey,
  ownerMembership: PublicKey,
  signer: PublicKey,
  actionItemId: bigint,
  approved: boolean,
  programId: PublicKey,
  sessionToken?: PublicKey
): TransactionInstruction {
  const payload = { action_item_id: actionItemId, approved };
  const serialized = borsh.serialize(castVerificationVoteSchema as any, payload);

  const keys = [
    { pubkey: board, isSigner: false, isWritable: false },
    { pubkey: actionItem, isSigner: false, isWritable: true },
    { pubkey: verificationVote, isSigner: false, isWritable: true },
    { pubkey: ownerMembership, isSigner: false, isWritable: true },
    { pubkey: signer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  if (sessionToken) {
    keys.push({ pubkey: sessionToken, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId,
    data: serializeInstruction(CAST_VERIFICATION_VOTE, Buffer.from(serialized)),
  });
}

// Session key instructions

export function createCreateSessionInstruction(
  sessionToken: PublicKey,
  sessionSigner: PublicKey,
  authority: PublicKey,
  validUntil: bigint,
  topUpLamports: bigint | null,
  programId: PublicKey
): TransactionInstruction {
  const payload = {
    valid_until: validUntil,
    top_up_lamports: topUpLamports,
  };
  const serialized = borsh.serialize(createSessionSchema as any, payload);

  return new TransactionInstruction({
    keys: [
      { pubkey: sessionToken, isSigner: false, isWritable: true },
      { pubkey: sessionSigner, isSigner: true, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: serializeInstruction(CREATE_SESSION, Buffer.from(serialized)),
  });
}

export function createRevokeSessionInstruction(
  sessionToken: PublicKey,
  authority: PublicKey,
  programId: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: sessionToken, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
    ],
    programId,
    data: serializeInstruction(REVOKE_SESSION),
  });
}

// Re-export PDA helpers for convenience
export {
  findFacilitatorRegistryPda,
  findBoardPda,
  findNotePda,
  findGroupPda,
  findBoardMembershipPda,
  findVoteRecordPda,
  findActionItemPda,
  findVerificationVotePda,
  findSessionTokenPda,
};
