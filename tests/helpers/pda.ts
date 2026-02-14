import { PublicKey } from "@solana/web3.js";

// PDA Seeds (must match state.rs)
const TEAM_REGISTRY_SEED = Buffer.from("team_registry");
const SESSION_SEED = Buffer.from("session");
const PARTICIPANT_SEED = Buffer.from("participant");
const NOTE_SEED = Buffer.from("note");
const GROUP_SEED = Buffer.from("group");
const VOTE_SEED = Buffer.from("vote");
const ACTION_ITEM_SEED = Buffer.from("action_item");
const VERIFICATION_VOTE_SEED = Buffer.from("verification_vote");

export function findTeamRegistryPda(
  teamAuthority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TEAM_REGISTRY_SEED, teamAuthority.toBuffer()],
    programId
  );
}

export function findSessionPda(
  teamAuthority: PublicKey,
  sessionIndex: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const sessionIndexBuffer = Buffer.alloc(8);
  sessionIndexBuffer.writeBigUInt64LE(sessionIndex);
  return PublicKey.findProgramAddressSync(
    [SESSION_SEED, teamAuthority.toBuffer(), sessionIndexBuffer],
    programId
  );
}

export function findParticipantEntryPda(
  session: PublicKey,
  participant: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PARTICIPANT_SEED, session.toBuffer(), participant.toBuffer()],
    programId
  );
}

export function findNotePda(
  session: PublicKey,
  noteId: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const noteIdBuffer = Buffer.alloc(8);
  noteIdBuffer.writeBigUInt64LE(noteId);
  return PublicKey.findProgramAddressSync(
    [NOTE_SEED, session.toBuffer(), noteIdBuffer],
    programId
  );
}

export function findGroupPda(
  session: PublicKey,
  groupId: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const groupIdBuffer = Buffer.alloc(8);
  groupIdBuffer.writeBigUInt64LE(groupId);
  return PublicKey.findProgramAddressSync(
    [GROUP_SEED, session.toBuffer(), groupIdBuffer],
    programId
  );
}

export function findVoteRecordPda(
  session: PublicKey,
  participant: PublicKey,
  groupId: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const groupIdBuffer = Buffer.alloc(8);
  groupIdBuffer.writeBigUInt64LE(groupId);
  return PublicKey.findProgramAddressSync(
    [VOTE_SEED, session.toBuffer(), participant.toBuffer(), groupIdBuffer],
    programId
  );
}

export function findActionItemPda(
  session: PublicKey,
  actionItemId: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const actionItemIdBuffer = Buffer.alloc(8);
  actionItemIdBuffer.writeBigUInt64LE(actionItemId);
  return PublicKey.findProgramAddressSync(
    [ACTION_ITEM_SEED, session.toBuffer(), actionItemIdBuffer],
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

// Participant identity PDA (seeds: ["participant", authority])
// Note: This reuses PARTICIPANT_SEED but with different PDA structure
const PARTICIPANT_IDENTITY_SEED = Buffer.from("participant");

export function findParticipantIdentityPda(
  authority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PARTICIPANT_IDENTITY_SEED, authority.toBuffer()],
    programId
  );
}
