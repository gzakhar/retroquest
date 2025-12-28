import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

// PDA Seeds (must match Rust state.rs)
const FACILITATOR_REGISTRY_SEED = Buffer.from("facilitator_registry");
const BOARD_SEED = Buffer.from("board");
const MEMBERSHIP_SEED = Buffer.from("membership");
const NOTE_SEED = Buffer.from("note");
const GROUP_SEED = Buffer.from("group");
const VOTE_SEED = Buffer.from("vote");

export function findFacilitatorRegistryPda(
  facilitator: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [FACILITATOR_REGISTRY_SEED, facilitator.toBuffer()],
    programId
  );
}

export function findBoardPda(
  facilitator: PublicKey,
  boardIndex: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const boardIndexBuffer = Buffer.alloc(8);
  boardIndexBuffer.writeBigUInt64LE(boardIndex);
  return PublicKey.findProgramAddressSync(
    [BOARD_SEED, facilitator.toBuffer(), boardIndexBuffer],
    programId
  );
}

export function findBoardMembershipPda(
  board: PublicKey,
  participant: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MEMBERSHIP_SEED, board.toBuffer(), participant.toBuffer()],
    programId
  );
}

export function findNotePda(
  board: PublicKey,
  noteId: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const noteIdBuffer = Buffer.alloc(8);
  noteIdBuffer.writeBigUInt64LE(noteId);
  return PublicKey.findProgramAddressSync(
    [NOTE_SEED, board.toBuffer(), noteIdBuffer],
    programId
  );
}

export function findGroupPda(
  board: PublicKey,
  groupId: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const groupIdBuffer = Buffer.alloc(8);
  groupIdBuffer.writeBigUInt64LE(groupId);
  return PublicKey.findProgramAddressSync(
    [GROUP_SEED, board.toBuffer(), groupIdBuffer],
    programId
  );
}

export function findVoteRecordPda(
  board: PublicKey,
  participant: PublicKey,
  groupId: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const groupIdBuffer = Buffer.alloc(8);
  groupIdBuffer.writeBigUInt64LE(groupId);
  return PublicKey.findProgramAddressSync(
    [VOTE_SEED, board.toBuffer(), participant.toBuffer(), groupIdBuffer],
    programId
  );
}
