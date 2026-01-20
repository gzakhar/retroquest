import { describe, it, expect } from "vitest";
import { start } from "solana-bankrun";
import {
  PublicKey,
  Transaction,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  findTeamRegistryPda,
  findSessionPda,
  findParticipantEntryPda,
  findActionItemPda,
  findVerificationVotePda,
} from "./helpers/pda";
import {
  createInitTeamRegistryInstruction,
  createCreateSessionInstruction,
  createAdvanceStageInstruction,
  createCloseSessionInstruction,
  createCreateActionItemInstruction,
  createCastVerificationVoteInstruction,
  SessionStage,
} from "./helpers/instructions";

// Program ID (must match lib.rs)
const PROGRAM_ID = new PublicKey(
  "AHiDdpGftbt2mVBSeXKafgWVqTFaGtmnC2fMvXR3Uuph"
);

describe("Action Items", () => {
  describe("Happy Path", () => {
    it("creates an action item successfully", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      // Create participants
      const participant1 = Keypair.generate();
      const participant2 = Keypair.generate();
      const participant3 = Keypair.generate();

      // Fund participants
      await client.requestAirdrop(participant1.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(participant2.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(participant3.publicKey, BigInt(LAMPORTS_PER_SOL));

      // Initialize team registry
      const [teamRegistry] = findTeamRegistryPda(payer.publicKey, PROGRAM_ID);
      const initTx = new Transaction().add(
        createInitTeamRegistryInstruction(payer.publicKey, PROGRAM_ID)
      );
      initTx.recentBlockhash = context.lastBlockhash;
      initTx.feePayer = payer.publicKey;
      initTx.sign(payer);
      await client.processTransaction(initTx);

      // Create session with 3 participants
      const [session] = findSessionPda(payer.publicKey, 0n, PROGRAM_ID);
      const categories = ["What went well", "What to improve", "Action items"];
      const allowlist = [participant1.publicKey, participant2.publicKey, participant3.publicKey];

      const createSessionTx = new Transaction().add(
        createCreateSessionInstruction(
          teamRegistry,
          session,
          payer.publicKey,
          categories,
          allowlist,
          5,
          PROGRAM_ID
        )
      );
      createSessionTx.recentBlockhash = context.lastBlockhash;
      createSessionTx.feePayer = payer.publicKey;
      createSessionTx.sign(payer);
      await client.processTransaction(createSessionTx);

      // Advance through stages to Discuss
      for (const stage of [SessionStage.WriteNotes, SessionStage.GroupDuplicates, SessionStage.Vote, SessionStage.Discuss]) {
        const advanceTx = new Transaction().add(
          createAdvanceStageInstruction(session, payer.publicKey, stage, PROGRAM_ID)
        );
        advanceTx.recentBlockhash = context.lastBlockhash;
        advanceTx.feePayer = payer.publicKey;
        advanceTx.sign(payer);
        await client.processTransaction(advanceTx);
      }

      // Create action item
      const [actionItem] = findActionItemPda(session, 0n, PROGRAM_ID);
      const createActionItemTx = new Transaction().add(
        createCreateActionItemInstruction(
          session,
          actionItem,
          payer.publicKey,
          "Reduce meeting frequency",
          participant1.publicKey, // owner
          [participant2.publicKey, participant3.publicKey], // verifiers
          2, // threshold: both must approve
          PROGRAM_ID
        )
      );
      createActionItemTx.recentBlockhash = context.lastBlockhash;
      createActionItemTx.feePayer = payer.publicKey;
      createActionItemTx.sign(payer);
      await client.processTransaction(createActionItemTx);

      // Verify action item was created
      const actionItemAccount = await client.getAccount(actionItem);
      expect(actionItemAccount).not.toBeNull();
    });

    it("completes full verification flow", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      // Setup participants
      const owner = Keypair.generate();
      const verifier1 = Keypair.generate();
      const verifier2 = Keypair.generate();

      await client.requestAirdrop(owner.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(verifier1.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(verifier2.publicKey, BigInt(LAMPORTS_PER_SOL));

      // Initialize registry
      const [teamRegistry] = findTeamRegistryPda(payer.publicKey, PROGRAM_ID);
      const initTx = new Transaction().add(
        createInitTeamRegistryInstruction(payer.publicKey, PROGRAM_ID)
      );
      initTx.recentBlockhash = context.lastBlockhash;
      initTx.feePayer = payer.publicKey;
      initTx.sign(payer);
      await client.processTransaction(initTx);

      // Create session
      const [session] = findSessionPda(payer.publicKey, 0n, PROGRAM_ID);
      const allowlist = [owner.publicKey, verifier1.publicKey, verifier2.publicKey];

      const createSessionTx = new Transaction().add(
        createCreateSessionInstruction(
          teamRegistry,
          session,
          payer.publicKey,
          ["Category 1"],
          allowlist,
          5,
          PROGRAM_ID
        )
      );
      createSessionTx.recentBlockhash = context.lastBlockhash;
      createSessionTx.feePayer = payer.publicKey;
      createSessionTx.sign(payer);
      await client.processTransaction(createSessionTx);

      // Advance to Discuss stage
      for (const stage of [SessionStage.WriteNotes, SessionStage.GroupDuplicates, SessionStage.Vote, SessionStage.Discuss]) {
        const advanceTx = new Transaction().add(
          createAdvanceStageInstruction(session, payer.publicKey, stage, PROGRAM_ID)
        );
        advanceTx.recentBlockhash = context.lastBlockhash;
        advanceTx.feePayer = payer.publicKey;
        advanceTx.sign(payer);
        await client.processTransaction(advanceTx);
      }

      // Create action item with threshold 2
      const [actionItem] = findActionItemPda(session, 0n, PROGRAM_ID);
      const createActionItemTx = new Transaction().add(
        createCreateActionItemInstruction(
          session,
          actionItem,
          payer.publicKey,
          "Implement code reviews",
          owner.publicKey,
          [verifier1.publicKey, verifier2.publicKey],
          2, // both must approve
          PROGRAM_ID
        )
      );
      createActionItemTx.recentBlockhash = context.lastBlockhash;
      createActionItemTx.feePayer = payer.publicKey;
      createActionItemTx.sign(payer);
      await client.processTransaction(createActionItemTx);

      // Close the session (required before verification)
      const closeTx = new Transaction().add(
        createCloseSessionInstruction(session, payer.publicKey, PROGRAM_ID)
      );
      closeTx.recentBlockhash = context.lastBlockhash;
      closeTx.feePayer = payer.publicKey;
      closeTx.sign(payer);
      await client.processTransaction(closeTx);

      // Verifier 1 approves
      const [vote1] = findVerificationVotePda(actionItem, verifier1.publicKey, PROGRAM_ID);
      const [ownerMembership] = findParticipantEntryPda(session, owner.publicKey, PROGRAM_ID);

      const vote1Tx = new Transaction().add(
        createCastVerificationVoteInstruction(
          session,
          actionItem,
          vote1,
          ownerMembership,
          verifier1.publicKey,
          0n,
          true, // approved
          PROGRAM_ID
        )
      );
      vote1Tx.recentBlockhash = context.lastBlockhash;
      vote1Tx.feePayer = verifier1.publicKey;
      vote1Tx.sign(verifier1);
      await client.processTransaction(vote1Tx);

      // Verifier 2 approves (should complete the action item)
      const [vote2] = findVerificationVotePda(actionItem, verifier2.publicKey, PROGRAM_ID);

      const vote2Tx = new Transaction().add(
        createCastVerificationVoteInstruction(
          session,
          actionItem,
          vote2,
          ownerMembership,
          verifier2.publicKey,
          0n,
          true, // approved
          PROGRAM_ID
        )
      );
      vote2Tx.recentBlockhash = context.lastBlockhash;
      vote2Tx.feePayer = verifier2.publicKey;
      vote2Tx.sign(verifier2);
      await client.processTransaction(vote2Tx);

      // Verify votes were recorded
      const vote1Account = await client.getAccount(vote1);
      expect(vote1Account).not.toBeNull();
      const vote2Account = await client.getAccount(vote2);
      expect(vote2Account).not.toBeNull();
    });
  });

  describe("Access Control", () => {
    it("rejects non-facilitator creating action item", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const participant1 = Keypair.generate();
      const participant2 = Keypair.generate();

      await client.requestAirdrop(participant1.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(participant2.publicKey, BigInt(LAMPORTS_PER_SOL));

      // Initialize and create session
      const [teamRegistry] = findTeamRegistryPda(payer.publicKey, PROGRAM_ID);
      const initTx = new Transaction().add(
        createInitTeamRegistryInstruction(payer.publicKey, PROGRAM_ID)
      );
      initTx.recentBlockhash = context.lastBlockhash;
      initTx.feePayer = payer.publicKey;
      initTx.sign(payer);
      await client.processTransaction(initTx);

      const [session] = findSessionPda(payer.publicKey, 0n, PROGRAM_ID);
      const createSessionTx = new Transaction().add(
        createCreateSessionInstruction(
          teamRegistry,
          session,
          payer.publicKey,
          ["Category 1"],
          [participant1.publicKey, participant2.publicKey],
          5,
          PROGRAM_ID
        )
      );
      createSessionTx.recentBlockhash = context.lastBlockhash;
      createSessionTx.feePayer = payer.publicKey;
      createSessionTx.sign(payer);
      await client.processTransaction(createSessionTx);

      // Advance to Discuss
      for (const stage of [SessionStage.WriteNotes, SessionStage.GroupDuplicates, SessionStage.Vote, SessionStage.Discuss]) {
        const advanceTx = new Transaction().add(
          createAdvanceStageInstruction(session, payer.publicKey, stage, PROGRAM_ID)
        );
        advanceTx.recentBlockhash = context.lastBlockhash;
        advanceTx.feePayer = payer.publicKey;
        advanceTx.sign(payer);
        await client.processTransaction(advanceTx);
      }

      // Try to create action item as participant (not facilitator)
      const [actionItem] = findActionItemPda(session, 0n, PROGRAM_ID);
      const createActionItemTx = new Transaction().add(
        createCreateActionItemInstruction(
          session,
          actionItem,
          participant1.publicKey, // participant trying to act as facilitator
          "Some action",
          participant1.publicKey,
          [participant2.publicKey],
          1,
          PROGRAM_ID
        )
      );
      createActionItemTx.recentBlockhash = context.lastBlockhash;
      createActionItemTx.feePayer = participant1.publicKey;
      createActionItemTx.sign(participant1);

      await expect(client.processTransaction(createActionItemTx)).rejects.toThrow();
    });

    it("rejects verification before board is closed", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const owner = Keypair.generate();
      const verifier = Keypair.generate();

      await client.requestAirdrop(owner.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(verifier.publicKey, BigInt(LAMPORTS_PER_SOL));

      // Setup
      const [teamRegistry] = findTeamRegistryPda(payer.publicKey, PROGRAM_ID);
      const initTx = new Transaction().add(
        createInitTeamRegistryInstruction(payer.publicKey, PROGRAM_ID)
      );
      initTx.recentBlockhash = context.lastBlockhash;
      initTx.feePayer = payer.publicKey;
      initTx.sign(payer);
      await client.processTransaction(initTx);

      const [session] = findSessionPda(payer.publicKey, 0n, PROGRAM_ID);
      const createSessionTx = new Transaction().add(
        createCreateSessionInstruction(
          teamRegistry,
          session,
          payer.publicKey,
          ["Category 1"],
          [owner.publicKey, verifier.publicKey],
          5,
          PROGRAM_ID
        )
      );
      createSessionTx.recentBlockhash = context.lastBlockhash;
      createSessionTx.feePayer = payer.publicKey;
      createSessionTx.sign(payer);
      await client.processTransaction(createSessionTx);

      // Advance to Discuss
      for (const stage of [SessionStage.WriteNotes, SessionStage.GroupDuplicates, SessionStage.Vote, SessionStage.Discuss]) {
        const advanceTx = new Transaction().add(
          createAdvanceStageInstruction(session, payer.publicKey, stage, PROGRAM_ID)
        );
        advanceTx.recentBlockhash = context.lastBlockhash;
        advanceTx.feePayer = payer.publicKey;
        advanceTx.sign(payer);
        await client.processTransaction(advanceTx);
      }

      // Create action item
      const [actionItem] = findActionItemPda(session, 0n, PROGRAM_ID);
      const createActionItemTx = new Transaction().add(
        createCreateActionItemInstruction(
          session,
          actionItem,
          payer.publicKey,
          "Test action",
          owner.publicKey,
          [verifier.publicKey],
          1,
          PROGRAM_ID
        )
      );
      createActionItemTx.recentBlockhash = context.lastBlockhash;
      createActionItemTx.feePayer = payer.publicKey;
      createActionItemTx.sign(payer);
      await client.processTransaction(createActionItemTx);

      // Try to verify WITHOUT closing the session first
      const [vote] = findVerificationVotePda(actionItem, verifier.publicKey, PROGRAM_ID);
      const [ownerMembership] = findParticipantEntryPda(session, owner.publicKey, PROGRAM_ID);

      const voteTx = new Transaction().add(
        createCastVerificationVoteInstruction(
          session,
          actionItem,
          vote,
          ownerMembership,
          verifier.publicKey,
          0n,
          true,
          PROGRAM_ID
        )
      );
      voteTx.recentBlockhash = context.lastBlockhash;
      voteTx.feePayer = verifier.publicKey;
      voteTx.sign(verifier);

      await expect(client.processTransaction(voteTx)).rejects.toThrow();
    });

    it("rejects non-verifier casting verification vote", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const owner = Keypair.generate();
      const verifier = Keypair.generate();
      const nonVerifier = Keypair.generate();

      await client.requestAirdrop(owner.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(verifier.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(nonVerifier.publicKey, BigInt(LAMPORTS_PER_SOL));

      // Setup
      const [teamRegistry] = findTeamRegistryPda(payer.publicKey, PROGRAM_ID);
      const initTx = new Transaction().add(
        createInitTeamRegistryInstruction(payer.publicKey, PROGRAM_ID)
      );
      initTx.recentBlockhash = context.lastBlockhash;
      initTx.feePayer = payer.publicKey;
      initTx.sign(payer);
      await client.processTransaction(initTx);

      const [session] = findSessionPda(payer.publicKey, 0n, PROGRAM_ID);
      const createSessionTx = new Transaction().add(
        createCreateSessionInstruction(
          teamRegistry,
          session,
          payer.publicKey,
          ["Category 1"],
          [owner.publicKey, verifier.publicKey, nonVerifier.publicKey],
          5,
          PROGRAM_ID
        )
      );
      createSessionTx.recentBlockhash = context.lastBlockhash;
      createSessionTx.feePayer = payer.publicKey;
      createSessionTx.sign(payer);
      await client.processTransaction(createSessionTx);

      // Advance to Discuss
      for (const stage of [SessionStage.WriteNotes, SessionStage.GroupDuplicates, SessionStage.Vote, SessionStage.Discuss]) {
        const advanceTx = new Transaction().add(
          createAdvanceStageInstruction(session, payer.publicKey, stage, PROGRAM_ID)
        );
        advanceTx.recentBlockhash = context.lastBlockhash;
        advanceTx.feePayer = payer.publicKey;
        advanceTx.sign(payer);
        await client.processTransaction(advanceTx);
      }

      // Create action item with only verifier as verifier (not nonVerifier)
      const [actionItem] = findActionItemPda(session, 0n, PROGRAM_ID);
      const createActionItemTx = new Transaction().add(
        createCreateActionItemInstruction(
          session,
          actionItem,
          payer.publicKey,
          "Test action",
          owner.publicKey,
          [verifier.publicKey], // only verifier is a verifier
          1,
          PROGRAM_ID
        )
      );
      createActionItemTx.recentBlockhash = context.lastBlockhash;
      createActionItemTx.feePayer = payer.publicKey;
      createActionItemTx.sign(payer);
      await client.processTransaction(createActionItemTx);

      // Close session
      const closeTx = new Transaction().add(
        createCloseSessionInstruction(session, payer.publicKey, PROGRAM_ID)
      );
      closeTx.recentBlockhash = context.lastBlockhash;
      closeTx.feePayer = payer.publicKey;
      closeTx.sign(payer);
      await client.processTransaction(closeTx);

      // Non-verifier tries to vote
      const [vote] = findVerificationVotePda(actionItem, nonVerifier.publicKey, PROGRAM_ID);
      const [ownerMembership] = findParticipantEntryPda(session, owner.publicKey, PROGRAM_ID);

      const voteTx = new Transaction().add(
        createCastVerificationVoteInstruction(
          session,
          actionItem,
          vote,
          ownerMembership,
          nonVerifier.publicKey,
          0n,
          true,
          PROGRAM_ID
        )
      );
      voteTx.recentBlockhash = context.lastBlockhash;
      voteTx.feePayer = nonVerifier.publicKey;
      voteTx.sign(nonVerifier);

      await expect(client.processTransaction(voteTx)).rejects.toThrow();
    });
  });

  describe("Validation", () => {
    it("rejects action item with owner as verifier", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const participant1 = Keypair.generate();
      const participant2 = Keypair.generate();

      await client.requestAirdrop(participant1.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(participant2.publicKey, BigInt(LAMPORTS_PER_SOL));

      // Setup
      const [teamRegistry] = findTeamRegistryPda(payer.publicKey, PROGRAM_ID);
      const initTx = new Transaction().add(
        createInitTeamRegistryInstruction(payer.publicKey, PROGRAM_ID)
      );
      initTx.recentBlockhash = context.lastBlockhash;
      initTx.feePayer = payer.publicKey;
      initTx.sign(payer);
      await client.processTransaction(initTx);

      const [session] = findSessionPda(payer.publicKey, 0n, PROGRAM_ID);
      const createSessionTx = new Transaction().add(
        createCreateSessionInstruction(
          teamRegistry,
          session,
          payer.publicKey,
          ["Category 1"],
          [participant1.publicKey, participant2.publicKey],
          5,
          PROGRAM_ID
        )
      );
      createSessionTx.recentBlockhash = context.lastBlockhash;
      createSessionTx.feePayer = payer.publicKey;
      createSessionTx.sign(payer);
      await client.processTransaction(createSessionTx);

      // Advance to Discuss
      for (const stage of [SessionStage.WriteNotes, SessionStage.GroupDuplicates, SessionStage.Vote, SessionStage.Discuss]) {
        const advanceTx = new Transaction().add(
          createAdvanceStageInstruction(session, payer.publicKey, stage, PROGRAM_ID)
        );
        advanceTx.recentBlockhash = context.lastBlockhash;
        advanceTx.feePayer = payer.publicKey;
        advanceTx.sign(payer);
        await client.processTransaction(advanceTx);
      }

      // Try to create action item with owner in verifiers list
      const [actionItem] = findActionItemPda(session, 0n, PROGRAM_ID);
      const createActionItemTx = new Transaction().add(
        createCreateActionItemInstruction(
          session,
          actionItem,
          payer.publicKey,
          "Test action",
          participant1.publicKey,
          [participant1.publicKey, participant2.publicKey], // owner is in verifiers!
          1,
          PROGRAM_ID
        )
      );
      createActionItemTx.recentBlockhash = context.lastBlockhash;
      createActionItemTx.feePayer = payer.publicKey;
      createActionItemTx.sign(payer);

      await expect(client.processTransaction(createActionItemTx)).rejects.toThrow();
    });

    it("rejects action item with threshold higher than verifier count", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const participant1 = Keypair.generate();
      const participant2 = Keypair.generate();

      await client.requestAirdrop(participant1.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(participant2.publicKey, BigInt(LAMPORTS_PER_SOL));

      // Setup
      const [teamRegistry] = findTeamRegistryPda(payer.publicKey, PROGRAM_ID);
      const initTx = new Transaction().add(
        createInitTeamRegistryInstruction(payer.publicKey, PROGRAM_ID)
      );
      initTx.recentBlockhash = context.lastBlockhash;
      initTx.feePayer = payer.publicKey;
      initTx.sign(payer);
      await client.processTransaction(initTx);

      const [session] = findSessionPda(payer.publicKey, 0n, PROGRAM_ID);
      const createSessionTx = new Transaction().add(
        createCreateSessionInstruction(
          teamRegistry,
          session,
          payer.publicKey,
          ["Category 1"],
          [participant1.publicKey, participant2.publicKey],
          5,
          PROGRAM_ID
        )
      );
      createSessionTx.recentBlockhash = context.lastBlockhash;
      createSessionTx.feePayer = payer.publicKey;
      createSessionTx.sign(payer);
      await client.processTransaction(createSessionTx);

      // Advance to Discuss
      for (const stage of [SessionStage.WriteNotes, SessionStage.GroupDuplicates, SessionStage.Vote, SessionStage.Discuss]) {
        const advanceTx = new Transaction().add(
          createAdvanceStageInstruction(session, payer.publicKey, stage, PROGRAM_ID)
        );
        advanceTx.recentBlockhash = context.lastBlockhash;
        advanceTx.feePayer = payer.publicKey;
        advanceTx.sign(payer);
        await client.processTransaction(advanceTx);
      }

      // Try to create action item with threshold > verifiers count
      const [actionItem] = findActionItemPda(session, 0n, PROGRAM_ID);
      const createActionItemTx = new Transaction().add(
        createCreateActionItemInstruction(
          session,
          actionItem,
          payer.publicKey,
          "Test action",
          participant1.publicKey,
          [participant2.publicKey], // only 1 verifier
          5, // but threshold is 5!
          PROGRAM_ID
        )
      );
      createActionItemTx.recentBlockhash = context.lastBlockhash;
      createActionItemTx.feePayer = payer.publicKey;
      createActionItemTx.sign(payer);

      await expect(client.processTransaction(createActionItemTx)).rejects.toThrow();
    });

    it("rejects creating action item in wrong stage", async () => {
      const context = await start(
        [{ name: "retroquest", programId: PROGRAM_ID }],
        []
      );
      const client = context.banksClient;
      const payer = context.payer;

      const participant1 = Keypair.generate();
      const participant2 = Keypair.generate();

      await client.requestAirdrop(participant1.publicKey, BigInt(LAMPORTS_PER_SOL));
      await client.requestAirdrop(participant2.publicKey, BigInt(LAMPORTS_PER_SOL));

      // Setup
      const [teamRegistry] = findTeamRegistryPda(payer.publicKey, PROGRAM_ID);
      const initTx = new Transaction().add(
        createInitTeamRegistryInstruction(payer.publicKey, PROGRAM_ID)
      );
      initTx.recentBlockhash = context.lastBlockhash;
      initTx.feePayer = payer.publicKey;
      initTx.sign(payer);
      await client.processTransaction(initTx);

      const [session] = findSessionPda(payer.publicKey, 0n, PROGRAM_ID);
      const createSessionTx = new Transaction().add(
        createCreateSessionInstruction(
          teamRegistry,
          session,
          payer.publicKey,
          ["Category 1"],
          [participant1.publicKey, participant2.publicKey],
          5,
          PROGRAM_ID
        )
      );
      createSessionTx.recentBlockhash = context.lastBlockhash;
      createSessionTx.feePayer = payer.publicKey;
      createSessionTx.sign(payer);
      await client.processTransaction(createSessionTx);

      // Only advance to Vote stage (not Discuss)
      for (const stage of [SessionStage.WriteNotes, SessionStage.GroupDuplicates, SessionStage.Vote]) {
        const advanceTx = new Transaction().add(
          createAdvanceStageInstruction(session, payer.publicKey, stage, PROGRAM_ID)
        );
        advanceTx.recentBlockhash = context.lastBlockhash;
        advanceTx.feePayer = payer.publicKey;
        advanceTx.sign(payer);
        await client.processTransaction(advanceTx);
      }

      // Try to create action item in Vote stage (should fail)
      const [actionItem] = findActionItemPda(session, 0n, PROGRAM_ID);
      const createActionItemTx = new Transaction().add(
        createCreateActionItemInstruction(
          session,
          actionItem,
          payer.publicKey,
          "Test action",
          participant1.publicKey,
          [participant2.publicKey],
          1,
          PROGRAM_ID
        )
      );
      createActionItemTx.recentBlockhash = context.lastBlockhash;
      createActionItemTx.feePayer = payer.publicKey;
      createActionItemTx.sign(payer);

      await expect(client.processTransaction(createActionItemTx)).rejects.toThrow();
    });
  });
});
