import { describe, it, expect } from "vitest";
import { start } from "solana-bankrun";
import {
  PublicKey,
  Transaction,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { findParticipantIdentityPda } from "./helpers/pda";
import {
  createCreateIdentityInstruction,
  createUpdateIdentityInstruction,
} from "./helpers/instructions";

// Program ID (must match lib.rs)
const PROGRAM_ID = new PublicKey(
  "52vL4fE1dqriKmGj7MddAvSkg2a7QvWcsFt7159EmbbC"
);

// Helper to read string from buffer (4-byte length prefix + utf8 data)
function readString(buffer: Buffer, offset: number): [string, number] {
  const length = buffer.readUInt32LE(offset);
  const str = buffer.slice(offset + 4, offset + 4 + length).toString("utf8");
  return [str, 4 + length];
}

// Helper to deserialize ParticipantIdentity
function deserializeParticipantIdentity(data: Buffer): {
  isInitialized: boolean;
  authority: PublicKey;
  username: string;
  bump: number;
} {
  let offset = 0;

  const isInitialized = data.readUInt8(offset) === 1;
  offset += 1;

  const authority = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const [username, usernameLen] = readString(data, offset);
  offset += usernameLen;

  const bump = data.readUInt8(offset);

  return { isInitialized, authority, username, bump };
}

describe("Participant Identity", () => {
  describe("CreateIdentity", () => {
    it("creates a new identity with valid username", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );

      const tx = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "test_user",
          PROGRAM_ID
        )
      );
      tx.recentBlockhash = context.lastBlockhash;
      tx.feePayer = payer.publicKey;
      tx.sign(payer);

      await client.processTransaction(tx);

      // Verify identity was created
      const identityAccount = await client.getAccount(identityPda);
      expect(identityAccount).not.toBeNull();

      const identity = deserializeParticipantIdentity(
        Buffer.from(identityAccount!.data)
      );
      expect(identity.isInitialized).toBe(true);
      expect(identity.authority.equals(payer.publicKey)).toBe(true);
      expect(identity.username).toBe("test_user");
    });

    it("fails with username too short", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );

      const tx = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "ab", // Too short (< 3 chars)
          PROGRAM_ID
        )
      );
      tx.recentBlockhash = context.lastBlockhash;
      tx.feePayer = payer.publicKey;
      tx.sign(payer);

      await expect(client.processTransaction(tx)).rejects.toThrow();
    });

    it("fails with username too long", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );

      const tx = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "a".repeat(33), // Too long (> 32 chars)
          PROGRAM_ID
        )
      );
      tx.recentBlockhash = context.lastBlockhash;
      tx.feePayer = payer.publicKey;
      tx.sign(payer);

      await expect(client.processTransaction(tx)).rejects.toThrow();
    });

    it("fails with invalid characters in username", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );

      const tx = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "test@user!", // Invalid chars
          PROGRAM_ID
        )
      );
      tx.recentBlockhash = context.lastBlockhash;
      tx.feePayer = payer.publicKey;
      tx.sign(payer);

      await expect(client.processTransaction(tx)).rejects.toThrow();
    });

    it("fails when identity already exists", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );

      // Create first identity
      const tx1 = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "test_user",
          PROGRAM_ID
        )
      );
      tx1.recentBlockhash = context.lastBlockhash;
      tx1.feePayer = payer.publicKey;
      tx1.sign(payer);
      await client.processTransaction(tx1);

      // Try to create again
      const tx2 = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "another_name",
          PROGRAM_ID
        )
      );
      tx2.recentBlockhash = context.lastBlockhash;
      tx2.feePayer = payer.publicKey;
      tx2.sign(payer);

      await expect(client.processTransaction(tx2)).rejects.toThrow();
    });
  });

  describe("UpdateIdentity", () => {
    it("updates an existing identity", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );

      // Create identity first
      const createTx = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "old_name",
          PROGRAM_ID
        )
      );
      createTx.recentBlockhash = context.lastBlockhash;
      createTx.feePayer = payer.publicKey;
      createTx.sign(payer);
      await client.processTransaction(createTx);

      // Update identity
      const updateTx = new Transaction().add(
        createUpdateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "new_name",
          PROGRAM_ID
        )
      );
      updateTx.recentBlockhash = context.lastBlockhash;
      updateTx.feePayer = payer.publicKey;
      updateTx.sign(payer);
      await client.processTransaction(updateTx);

      // Verify update
      const identityAccount = await client.getAccount(identityPda);
      const identity = deserializeParticipantIdentity(
        Buffer.from(identityAccount!.data)
      );
      expect(identity.username).toBe("new_name");
    });

    it("fails when non-owner tries to update", async () => {
      // Create attacker keypair first so we can include it in genesis
      const attacker = Keypair.generate();

      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        [
          // Fund attacker in genesis
          {
            address: attacker.publicKey,
            info: {
              lamports: LAMPORTS_PER_SOL,
              data: Buffer.alloc(0),
              owner: PublicKey.default,
              executable: false,
            },
          },
        ]
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );

      // Create identity for payer
      const createTx = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "original",
          PROGRAM_ID
        )
      );
      createTx.recentBlockhash = context.lastBlockhash;
      createTx.feePayer = payer.publicKey;
      createTx.sign(payer);
      await client.processTransaction(createTx);

      // Attacker tries to update payer's identity
      const attackTx = new Transaction().add(
        createUpdateIdentityInstruction(
          identityPda,
          attacker.publicKey, // Wrong authority
          "hacked",
          PROGRAM_ID
        )
      );
      attackTx.recentBlockhash = context.lastBlockhash;
      attackTx.feePayer = attacker.publicKey;
      attackTx.sign(attacker);

      await expect(client.processTransaction(attackTx)).rejects.toThrow();
    });

    it("fails when identity does not exist", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );

      // Try to update non-existent identity
      const tx = new Transaction().add(
        createUpdateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "new_name",
          PROGRAM_ID
        )
      );
      tx.recentBlockhash = context.lastBlockhash;
      tx.feePayer = payer.publicKey;
      tx.sign(payer);

      await expect(client.processTransaction(tx)).rejects.toThrow();
    });
  });

  describe("Username validation edge cases", () => {
    it("accepts minimum length username (3 chars)", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );

      const tx = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "abc", // Exactly 3 chars
          PROGRAM_ID
        )
      );
      tx.recentBlockhash = context.lastBlockhash;
      tx.feePayer = payer.publicKey;
      tx.sign(payer);

      await client.processTransaction(tx);

      const identityAccount = await client.getAccount(identityPda);
      const identity = deserializeParticipantIdentity(
        Buffer.from(identityAccount!.data)
      );
      expect(identity.username).toBe("abc");
    });

    it("accepts maximum length username (32 chars)", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );
      const maxUsername = "a".repeat(32);

      const tx = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          maxUsername,
          PROGRAM_ID
        )
      );
      tx.recentBlockhash = context.lastBlockhash;
      tx.feePayer = payer.publicKey;
      tx.sign(payer);

      await client.processTransaction(tx);

      const identityAccount = await client.getAccount(identityPda);
      const identity = deserializeParticipantIdentity(
        Buffer.from(identityAccount!.data)
      );
      expect(identity.username).toBe(maxUsername);
    });

    it("accepts underscores in username", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const [identityPda] = findParticipantIdentityPda(
        payer.publicKey,
        PROGRAM_ID
      );

      const tx = new Transaction().add(
        createCreateIdentityInstruction(
          identityPda,
          payer.publicKey,
          "user_name_123",
          PROGRAM_ID
        )
      );
      tx.recentBlockhash = context.lastBlockhash;
      tx.feePayer = payer.publicKey;
      tx.sign(payer);

      await client.processTransaction(tx);

      const identityAccount = await client.getAccount(identityPda);
      const identity = deserializeParticipantIdentity(
        Buffer.from(identityAccount!.data)
      );
      expect(identity.username).toBe("user_name_123");
    });
  });
});
