import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

// PDA Seeds (must match Rust state.rs)
const FACILITATOR_REGISTRY_SEED = Buffer.from("facilitator_registry");
const BOARD_SEED = Buffer.from("board");
const MEMBERSHIP_SEED = Buffer.from("membership");
const NOTE_SEED = Buffer.from("note");
const GROUP_SEED = Buffer.from("group");
const VOTE_SEED = Buffer.from("vote");
const ACTION_ITEM_SEED = Buffer.from("action_item");
const VERIFICATION_VOTE_SEED = Buffer.from("verification_vote");
const SESSION_TOKEN_SEED = Buffer.from("session_token");
const PARTICIPANT_IDENTITY_SEED = Buffer.from("participant");

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

export function findActionItemPda(
  board: PublicKey,
  actionItemId: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const actionItemIdBuffer = Buffer.alloc(8);
  actionItemIdBuffer.writeBigUInt64LE(actionItemId);
  return PublicKey.findProgramAddressSync(
    [ACTION_ITEM_SEED, board.toBuffer(), actionItemIdBuffer],
    programId
  );
}

export function findVerificationVotePda(
  actionItem: PublicKey,
  verifier: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VERIFICATION_VOTE_SEED, actionItem.toBuffer(), verifier.toBuffer()],
    programId
  );
}

// Session token PDA
// Seeds: ["session_token", target_program, session_signer, authority]
export function findSessionTokenPda(
  targetProgram: PublicKey,
  sessionSigner: PublicKey,
  authority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      SESSION_TOKEN_SEED,
      targetProgram.toBuffer(),
      sessionSigner.toBuffer(),
      authority.toBuffer(),
    ],
    programId
  );
}

// Participant identity PDA
// Seeds: ["participant", authority]
export function findParticipantIdentityPda(
  authority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PARTICIPANT_IDENTITY_SEED, authority.toBuffer()],
    programId
  );
}
