// Debug script to examine session account data
// Run with: npx ts-node src/debug-session.ts <session-address>

import { Connection, PublicKey } from "@solana/web3.js";

const SESSION_ADDRESS = process.argv[2] || "8uUV6SAupBTvFR4bk59hsWdhnR3X6c2cq19AQKboh9hw";

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const sessionPubkey = new PublicKey(SESSION_ADDRESS);

  console.log("Fetching session:", SESSION_ADDRESS);
  const accountInfo = await connection.getAccountInfo(sessionPubkey);

  if (!accountInfo) {
    console.log("Account not found!");
    return;
  }

  console.log("\n=== Account Info ===");
  console.log("Owner:", accountInfo.owner.toString());
  console.log("Data length:", accountInfo.data.length);
  console.log("Lamports:", accountInfo.lamports);

  const data = Buffer.from(accountInfo.data);

  console.log("\n=== Raw Data (first 200 bytes hex) ===");
  console.log(data.slice(0, 200).toString("hex"));

  console.log("\n=== Manual Deserialization ===");
  let offset = 0;

  // is_initialized (1 byte)
  const isInitialized = data.readUInt8(offset);
  console.log(`[${offset}] is_initialized:`, isInitialized);
  offset += 1;

  // team_authority (32 bytes)
  const teamAuthority = new PublicKey(data.slice(offset, offset + 32));
  console.log(`[${offset}] team_authority:`, teamAuthority.toString());
  offset += 32;

  // facilitator (32 bytes)
  const facilitator = new PublicKey(data.slice(offset, offset + 32));
  console.log(`[${offset}] facilitator:`, facilitator.toString());
  offset += 32;

  // session_index (8 bytes, u64 LE)
  const sessionIndex = data.readBigUInt64LE(offset);
  console.log(`[${offset}] session_index:`, sessionIndex.toString());
  offset += 8;

  // stage (1 byte)
  const stage = data.readUInt8(offset);
  console.log(`[${offset}] stage:`, stage);
  offset += 1;

  // closed (1 byte)
  const closed = data.readUInt8(offset);
  console.log(`[${offset}] closed:`, closed);
  offset += 1;

  // categories Vec<String>: 4-byte length prefix
  const categoriesLen = data.readUInt32LE(offset);
  console.log(`[${offset}] categories count:`, categoriesLen);
  offset += 4;

  // Read each category string
  const categories: string[] = [];
  for (let i = 0; i < categoriesLen; i++) {
    const strLen = data.readUInt32LE(offset);
    offset += 4;
    const str = data.slice(offset, offset + strLen).toString("utf8");
    categories.push(str);
    offset += strLen;
    console.log(`  category[${i}]:`, str);
  }

  // allowlist Vec<Pubkey>: 4-byte length prefix
  const allowlistLen = data.readUInt32LE(offset);
  console.log(`[${offset}] allowlist count:`, allowlistLen);
  offset += 4;

  // Read each pubkey
  for (let i = 0; i < allowlistLen; i++) {
    const pk = new PublicKey(data.slice(offset, offset + 32));
    console.log(`  allowlist[${i}]:`, pk.toString());
    offset += 32;
  }

  // voting_credits_per_participant (1 byte)
  const votingCredits = data.readUInt8(offset);
  console.log(`[${offset}] voting_credits_per_participant:`, votingCredits);
  offset += 1;

  // note_count (8 bytes)
  const noteCount = data.readBigUInt64LE(offset);
  console.log(`[${offset}] note_count:`, noteCount.toString());
  offset += 8;

  // group_count (8 bytes)
  const groupCount = data.readBigUInt64LE(offset);
  console.log(`[${offset}] group_count:`, groupCount.toString());
  offset += 8;

  // created_at_slot (8 bytes)
  const createdAtSlot = data.readBigUInt64LE(offset);
  console.log(`[${offset}] created_at_slot:`, createdAtSlot.toString());
  offset += 8;

  // stage_changed_at_slot (8 bytes)
  const stageChangedAtSlot = data.readBigUInt64LE(offset);
  console.log(`[${offset}] stage_changed_at_slot:`, stageChangedAtSlot.toString());
  offset += 8;

  // bump (1 byte)
  const bump = data.readUInt8(offset);
  console.log(`[${offset}] bump:`, bump);
  offset += 1;

  console.log("\n=== Summary ===");
  console.log("Total bytes read:", offset);
  console.log("Account data length:", data.length);
  console.log("Remaining bytes:", data.length - offset);
}

main().catch(console.error);
