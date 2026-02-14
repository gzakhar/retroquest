// Debug script to examine ParticipantEntry accounts for a session
// Run with: npx ts-node src/debug-participant-entry.ts <session-address> [participant-wallet]

import { Connection, PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey(
  "CZ1xaAyDaXa5GyWPHCytfcJjnmJhuFnVeHJLrYiijVLx"
);
const PARTICIPANT_SEED = Buffer.from("participant");

const SESSION_ADDRESS = process.argv[2];
const PARTICIPANT_WALLET = process.argv[3]; // Optional: specific wallet to check

if (!SESSION_ADDRESS) {
  console.log(
    "Usage: npx ts-node src/debug-participant-entry.ts <session-address> [participant-wallet]"
  );
  process.exit(1);
}

function findParticipantEntryPda(
  session: PublicKey,
  participant: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PARTICIPANT_SEED, session.toBuffer(), participant.toBuffer()],
    PROGRAM_ID
  );
}

function readPublicKey(buffer: Buffer, offset: number): PublicKey {
  return new PublicKey(buffer.slice(offset, offset + 32));
}

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

function readStringVec(buffer: Buffer, offset: number): [string[], number] {
  const count = buffer.readUInt32LE(offset);
  let currentOffset = offset + 4;
  const strings: string[] = [];
  for (let i = 0; i < count; i++) {
    const strLen = buffer.readUInt32LE(currentOffset);
    currentOffset += 4;
    const str = buffer
      .slice(currentOffset, currentOffset + strLen)
      .toString("utf8");
    strings.push(str);
    currentOffset += strLen;
  }
  return [strings, currentOffset - offset];
}

async function main() {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const sessionPubkey = new PublicKey(SESSION_ADDRESS);

  console.log("=== Session Analysis ===");
  console.log("Session address:", SESSION_ADDRESS);
  console.log("Program ID:", PROGRAM_ID.toString());
  console.log("");

  // Fetch session account
  const sessionAccountInfo = await connection.getAccountInfo(sessionPubkey);
  if (!sessionAccountInfo) {
    console.log("ERROR: Session account not found!");
    return;
  }

  const data = Buffer.from(sessionAccountInfo.data);
  console.log("Session account owner:", sessionAccountInfo.owner.toString());
  console.log("Session data length:", data.length);

  // Parse session to get allowlist
  let offset = 0;
  const isInitialized = data.readUInt8(offset) === 1;
  offset += 1;
  const teamAuthority = readPublicKey(data, offset);
  offset += 32;
  const facilitator = readPublicKey(data, offset);
  offset += 32;
  const sessionIndex = data.readBigUInt64LE(offset);
  offset += 8;
  const stage = data.readUInt8(offset);
  offset += 1;
  const closed = data.readUInt8(offset) === 1;
  offset += 1;

  const [categories, categoriesLen] = readStringVec(data, offset);
  offset += categoriesLen;

  const [allowlist, allowlistLen] = readPubkeyVec(data, offset);
  offset += allowlistLen;

  console.log("\n=== Session Data ===");
  console.log("Initialized:", isInitialized);
  console.log("Team Authority:", teamAuthority.toString());
  console.log("Facilitator:", facilitator.toString());
  console.log("Session Index:", sessionIndex.toString());
  console.log("Stage:", stage);
  console.log("Closed:", closed);
  console.log("Categories:", categories);
  console.log("\n=== Allowlist ===");
  console.log("Allowlist count:", allowlist.length);
  allowlist.forEach((pk, i) => {
    console.log(`  [${i}] ${pk.toString()}`);
  });

  // Check ParticipantEntry for each allowlist member
  console.log("\n=== ParticipantEntry Accounts ===");
  for (const participant of allowlist) {
    const [pda, bump] = findParticipantEntryPda(sessionPubkey, participant);
    console.log(`\nParticipant: ${participant.toString()}`);
    console.log(`  PDA: ${pda.toString()}`);
    console.log(`  Expected bump: ${bump}`);

    const entryAccount = await connection.getAccountInfo(pda);
    if (!entryAccount) {
      console.log(`  STATUS: NOT FOUND (ParticipantEntry does not exist)`);
    } else {
      const entryData = Buffer.from(entryAccount.data);
      console.log(`  STATUS: EXISTS`);
      console.log(`  Data length: ${entryData.length}`);
      console.log(`  is_initialized: ${entryData.readUInt8(0)}`);
      console.log(`  session: ${readPublicKey(entryData, 1).toString()}`);
      console.log(`  participant: ${readPublicKey(entryData, 33).toString()}`);
      console.log(`  credits_spent: ${entryData.readUInt8(65)}`);
      console.log(`  bump: ${entryData.readUInt8(66)}`);
    }
  }

  // If a specific participant wallet was provided, check it too
  if (PARTICIPANT_WALLET) {
    const participantPubkey = new PublicKey(PARTICIPANT_WALLET);
    console.log("\n=== Checking Specific Wallet ===");
    console.log("Wallet:", PARTICIPANT_WALLET);

    const isInAllowlist = allowlist.some((pk) => pk.equals(participantPubkey));
    console.log("In allowlist:", isInAllowlist);

    const [pda, bump] = findParticipantEntryPda(
      sessionPubkey,
      participantPubkey
    );
    console.log("PDA:", pda.toString());

    const entryAccount = await connection.getAccountInfo(pda);
    if (entryAccount) {
      console.log("ParticipantEntry exists!");
      const entryData = Buffer.from(entryAccount.data);
      console.log(
        "  participant stored:",
        readPublicKey(entryData, 33).toString()
      );
    } else {
      console.log("ParticipantEntry does NOT exist");
    }
  }

  // Also scan for all ParticipantEntry accounts with this session
  console.log("\n=== Scanning All ParticipantEntry Accounts ===");
  const allEntries = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: 67 },
      { memcmp: { offset: 1, bytes: sessionPubkey.toBase58() } }, // session field at offset 1
    ],
  });
  console.log(
    `Found ${allEntries.length} ParticipantEntry accounts for this session:`
  );
  for (const entry of allEntries) {
    const entryData = Buffer.from(entry.account.data);
    const participant = readPublicKey(entryData, 33);
    console.log(`  - ${entry.pubkey.toString()}`);
    console.log(`    participant: ${participant.toString()}`);
  }
}

main().catch(console.error);
