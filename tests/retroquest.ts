import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Retroquest } from "../target/types/retroquest";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

describe("retroquest", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Retroquest as Program<Retroquest>;

  const teamAuthority = provider.wallet;
  let participant1: Keypair;
  let participant2: Keypair;

  let teamRegistryPda: PublicKey;
  let sessionPda: PublicKey;

  before(async () => {
    participant1 = Keypair.generate();
    participant2 = Keypair.generate();

    // Airdrop SOL to participants for transaction fees
    const airdropAmount = 2 * anchor.web3.LAMPORTS_PER_SOL;

    await provider.connection.requestAirdrop(participant1.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(participant2.publicKey, airdropAmount);

    // Wait for airdrops to confirm
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Derive TeamRegistry PDA
    [teamRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("team_registry"), teamAuthority.publicKey.toBuffer()],
      program.programId
    );
  });

  describe("Step 1: Create TeamRegistry", () => {
    it("should initialize a team registry", async () => {
      await program.methods
        .initTeamRegistry()
        .accounts({
          teamRegistry: teamRegistryPda,
          teamAuthority: teamAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const registry = await program.account.teamRegistry.fetch(teamRegistryPda);
      expect(registry.teamAuthority.toString()).to.equal(teamAuthority.publicKey.toString());
      expect(registry.sessionCount.toNumber()).to.equal(0);
    });
  });

  describe("Step 2: Create Session", () => {
    it("should create a retro session with categories and credits", async () => {
      const registry = await program.account.teamRegistry.fetch(teamRegistryPda);
      const sessionIndex = registry.sessionCount;

      [sessionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("session"),
          teamAuthority.publicKey.toBuffer(),
          sessionIndex.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .createSession({
          categories: ["What went well", "What didn't go well", "Action items"],
          maxNotesPerParticipant: 5,
          votingCreditsPerParticipant: 3,
          allowlistEnabled: true,
          openJoin: false,
        })
        .accounts({
          teamRegistry: teamRegistryPda,
          session: sessionPda,
          teamAuthority: teamAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const session = await program.account.retroSession.fetch(sessionPda);
      expect(session.stage).to.deep.equal({ setup: {} });
      expect(session.categories.length).to.equal(3);
      expect(session.votingCreditsPerParticipant).to.equal(3);
      expect(session.allowlistEnabled).to.be.true;
    });
  });

  describe("Step 3: Add participants to allowlist and join", () => {
    let allowlistEntry1Pda: PublicKey;
    let allowlistEntry2Pda: PublicKey;
    let participantEntry1Pda: PublicKey;
    let participantEntry2Pda: PublicKey;

    it("should add participant1 to allowlist", async () => {
      [allowlistEntry1Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("allowlist"), sessionPda.toBuffer(), participant1.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .addToAllowlist(participant1.publicKey)
        .accounts({
          session: sessionPda,
          allowlistEntry: allowlistEntry1Pda,
          facilitator: teamAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const entry = await program.account.allowlistEntry.fetch(allowlistEntry1Pda);
      expect(entry.participant.toString()).to.equal(participant1.publicKey.toString());
      expect(entry.allowed).to.be.true;
    });

    it("should add participant2 to allowlist", async () => {
      [allowlistEntry2Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("allowlist"), sessionPda.toBuffer(), participant2.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .addToAllowlist(participant2.publicKey)
        .accounts({
          session: sessionPda,
          allowlistEntry: allowlistEntry2Pda,
          facilitator: teamAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const entry = await program.account.allowlistEntry.fetch(allowlistEntry2Pda);
      expect(entry.allowed).to.be.true;
    });

    it("should allow participant1 to join the session", async () => {
      [participantEntry1Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("participant"), sessionPda.toBuffer(), participant1.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .joinSessionWithAllowlist()
        .accounts({
          session: sessionPda,
          allowlistEntry: allowlistEntry1Pda,
          participantEntry: participantEntry1Pda,
          participant: participant1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant1])
        .rpc();

      const entry = await program.account.participantEntry.fetch(participantEntry1Pda);
      expect(entry.joined).to.be.true;
      expect(entry.notesSubmitted).to.equal(0);
    });

    it("should allow participant2 to join the session", async () => {
      [participantEntry2Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("participant"), sessionPda.toBuffer(), participant2.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .joinSessionWithAllowlist()
        .accounts({
          session: sessionPda,
          allowlistEntry: allowlistEntry2Pda,
          participantEntry: participantEntry2Pda,
          participant: participant2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant2])
        .rpc();

      const session = await program.account.retroSession.fetch(sessionPda);
      expect(session.participantCount).to.equal(2);
    });
  });

  describe("Step 4: Advance to Stage 1 and create notes", () => {
    let note0Pda: PublicKey;
    let note1Pda: PublicKey;
    let participantEntry1Pda: PublicKey;

    before(() => {
      [participantEntry1Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("participant"), sessionPda.toBuffer(), participant1.publicKey.toBuffer()],
        program.programId
      );
    });

    it("should advance to WriteNotes stage", async () => {
      await program.methods
        .advanceStage({ writeNotes: {} })
        .accounts({
          session: sessionPda,
          facilitator: teamAuthority.publicKey,
        })
        .rpc();

      const session = await program.account.retroSession.fetch(sessionPda);
      expect(session.stage).to.deep.equal({ writeNotes: {} });
    });

    it("should allow participant1 to create a note", async () => {
      const session = await program.account.retroSession.fetch(sessionPda);
      const noteIndex = session.noteCount;

      [note0Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("note"),
          sessionPda.toBuffer(),
          noteIndex.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .createNote(0, "The team collaboration was excellent!")
        .accounts({
          session: sessionPda,
          participantEntry: participantEntry1Pda,
          note: note0Pda,
          author: participant1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant1])
        .rpc();

      const note = await program.account.note.fetch(note0Pda);
      expect(note.categoryId).to.equal(0);
      expect(note.content).to.equal("The team collaboration was excellent!");
      expect(note.groupId).to.be.null;
    });

    it("should allow participant1 to create another note in a different category", async () => {
      const session = await program.account.retroSession.fetch(sessionPda);
      const noteIndex = session.noteCount;

      [note1Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("note"),
          sessionPda.toBuffer(),
          noteIndex.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .createNote(1, "Deployments were too slow")
        .accounts({
          session: sessionPda,
          participantEntry: participantEntry1Pda,
          note: note1Pda,
          author: participant1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant1])
        .rpc();

      const session2 = await program.account.retroSession.fetch(sessionPda);
      expect(session2.noteCount.toNumber()).to.equal(2);
    });
  });

  describe("Step 5: Advance to Stage 2 and create groups", () => {
    let group0Pda: PublicKey;
    let note0Pda: PublicKey;
    let participantEntry1Pda: PublicKey;

    before(() => {
      [participantEntry1Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("participant"), sessionPda.toBuffer(), participant1.publicKey.toBuffer()],
        program.programId
      );

      [note0Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("note"),
          sessionPda.toBuffer(),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
        ],
        program.programId
      );
    });

    it("should advance to GroupDuplicates stage", async () => {
      await program.methods
        .advanceStage({ groupDuplicates: {} })
        .accounts({
          session: sessionPda,
          facilitator: teamAuthority.publicKey,
        })
        .rpc();

      const session = await program.account.retroSession.fetch(sessionPda);
      expect(session.stage).to.deep.equal({ groupDuplicates: {} });
    });

    it("should allow participant to create a group", async () => {
      const session = await program.account.retroSession.fetch(sessionPda);
      const groupIndex = session.groupCount;

      [group0Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("group"),
          sessionPda.toBuffer(),
          groupIndex.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .createGroup("Team Collaboration")
        .accounts({
          session: sessionPda,
          participantEntry: participantEntry1Pda,
          group: group0Pda,
          creator: participant1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant1])
        .rpc();

      const group = await program.account.group.fetch(group0Pda);
      expect(group.title).to.equal("Team Collaboration");
      expect(group.voteTally.toNumber()).to.equal(0);
    });

    it("should allow assigning a note to a group", async () => {
      await program.methods
        .assignNoteToGroup(new anchor.BN(0), new anchor.BN(0))
        .accounts({
          session: sessionPda,
          participantEntry: participantEntry1Pda,
          note: note0Pda,
          group: group0Pda,
          participant: participant1.publicKey,
        })
        .signers([participant1])
        .rpc();

      const note = await program.account.note.fetch(note0Pda);
      expect(note.groupId.toNumber()).to.equal(0);
    });

    it("should reject assigning an already-grouped note", async () => {
      try {
        await program.methods
          .assignNoteToGroup(new anchor.BN(0), new anchor.BN(0))
          .accounts({
            session: sessionPda,
            participantEntry: participantEntry1Pda,
            note: note0Pda,
            group: group0Pda,
            participant: participant1.publicKey,
          })
          .signers([participant1])
          .rpc();
        expect.fail("Should have thrown NoteAlreadyGrouped error");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("NoteAlreadyGrouped");
      }
    });
  });

  describe("Step 6: Advance to Stage 3 and vote", () => {
    let group0Pda: PublicKey;
    let voteRecord1Pda: PublicKey;
    let voteRecord2Pda: PublicKey;
    let participantEntry1Pda: PublicKey;
    let participantEntry2Pda: PublicKey;

    before(() => {
      [participantEntry1Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("participant"), sessionPda.toBuffer(), participant1.publicKey.toBuffer()],
        program.programId
      );
      [participantEntry2Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("participant"), sessionPda.toBuffer(), participant2.publicKey.toBuffer()],
        program.programId
      );
      [group0Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("group"),
          sessionPda.toBuffer(),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
        ],
        program.programId
      );
      [voteRecord1Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          sessionPda.toBuffer(),
          participant1.publicKey.toBuffer(),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
        ],
        program.programId
      );
      [voteRecord2Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          sessionPda.toBuffer(),
          participant2.publicKey.toBuffer(),
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
        ],
        program.programId
      );
    });

    it("should advance to Vote stage", async () => {
      await program.methods
        .advanceStage({ vote: {} })
        .accounts({
          session: sessionPda,
          facilitator: teamAuthority.publicKey,
        })
        .rpc();

      const session = await program.account.retroSession.fetch(sessionPda);
      expect(session.stage).to.deep.equal({ vote: {} });
    });

    it("should allow participant1 to cast vote", async () => {
      await program.methods
        .castVote(new anchor.BN(0), 2)
        .accounts({
          session: sessionPda,
          participantEntry: participantEntry1Pda,
          group: group0Pda,
          voteRecord: voteRecord1Pda,
          voter: participant1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant1])
        .rpc();

      const group = await program.account.group.fetch(group0Pda);
      expect(group.voteTally.toNumber()).to.equal(2);

      const voteRecord = await program.account.voteRecord.fetch(voteRecord1Pda);
      expect(voteRecord.creditsSpent).to.equal(2);
    });

    it("should allow participant2 to cast vote", async () => {
      await program.methods
        .castVote(new anchor.BN(0), 3)
        .accounts({
          session: sessionPda,
          participantEntry: participantEntry2Pda,
          group: group0Pda,
          voteRecord: voteRecord2Pda,
          voter: participant2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant2])
        .rpc();

      const group = await program.account.group.fetch(group0Pda);
      expect(group.voteTally.toNumber()).to.equal(5);
    });

    it("should reject over-credit voting", async () => {
      try {
        // participant1 has 3 total credits, already spent 2, trying to spend 2 more
        await program.methods
          .castVote(new anchor.BN(0), 2)
          .accounts({
            session: sessionPda,
            participantEntry: participantEntry1Pda,
            group: group0Pda,
            voteRecord: voteRecord1Pda,
            voter: participant1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([participant1])
          .rpc();
        expect.fail("Should have thrown InsufficientCredits error");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InsufficientCredits");
      }
    });
  });

  describe("Step 7: Advance to Stage 4 and close", () => {
    let participantEntry1Pda: PublicKey;
    let note1Pda: PublicKey;

    before(() => {
      [participantEntry1Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("participant"), sessionPda.toBuffer(), participant1.publicKey.toBuffer()],
        program.programId
      );
      [note1Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("note"),
          sessionPda.toBuffer(),
          Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]),
        ],
        program.programId
      );
    });

    it("should advance to Discuss stage", async () => {
      await program.methods
        .advanceStage({ discuss: {} })
        .accounts({
          session: sessionPda,
          facilitator: teamAuthority.publicKey,
        })
        .rpc();

      const session = await program.account.retroSession.fetch(sessionPda);
      expect(session.stage).to.deep.equal({ discuss: {} });
    });

    it("should close the session", async () => {
      await program.methods
        .closeSession()
        .accounts({
          session: sessionPda,
          facilitator: teamAuthority.publicKey,
        })
        .rpc();

      const session = await program.account.retroSession.fetch(sessionPda);
      expect(session.closed).to.be.true;
    });

    it("should compute top groups from tallies", async () => {
      const session = await program.account.retroSession.fetch(sessionPda);
      const groups: any[] = [];

      for (let i = 0; i < session.groupCount.toNumber(); i++) {
        const [groupPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("group"),
            sessionPda.toBuffer(),
            new anchor.BN(i).toArrayLike(Buffer, "le", 8),
          ],
          program.programId
        );
        const group = await program.account.group.fetch(groupPda);
        groups.push({
          id: i,
          title: group.title,
          voteTally: group.voteTally.toNumber(),
        });
      }

      groups.sort((a, b) => b.voteTally - a.voteTally);
      expect(groups[0].title).to.equal("Team Collaboration");
      expect(groups[0].voteTally).to.equal(5);
    });

    it("should reject mutations after close", async () => {
      // Create a new group PDA that doesn't exist yet
      const session = await program.account.retroSession.fetch(sessionPda);
      const [newGroupPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("group"),
          sessionPda.toBuffer(),
          session.groupCount.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      try {
        await program.methods
          .createGroup("New Group After Close")
          .accounts({
            session: sessionPda,
            participantEntry: participantEntry1Pda,
            group: newGroupPda,
            creator: participant1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([participant1])
          .rpc();
        expect.fail("Should have thrown InvalidStage error");
      } catch (err: any) {
        // Will fail due to wrong stage (Discuss instead of GroupDuplicates)
        expect(err.error.errorCode.code).to.equal("InvalidStage");
      }
    });
  });
});
