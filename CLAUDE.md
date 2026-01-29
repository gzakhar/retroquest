# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The Problem

RetroQuest exists to solve a real problem in agile teams: **poor follow-through on retrospective action items**.

Teams run structured retrospectives that produce thoughtful, high-quality action items. But these items frequently fail—not because they're bad ideas, but because:
- There's no persistence or accountability across sprints
- Action items fade once the retro ends
- There's no incentive mechanism to encourage follow-through

**Core belief**: Execution consistency is more valuable than idea quality. Retrospectives fail at the last mile: sustained action.

## Core Product Philosophy: Retros Designed for Execution

RetroQuest is a **retrospective platform first**, but unlike traditional retro tools, its defining goal is **maximizing follow-through on action items**.

This means:
- Retrospective stages are not neutral facilitation steps
- Each stage should intentionally bias the team toward:
  - Fewer, clearer, more executable action items
  - Shared ownership over individual task dumping
  - Decisions that can realistically be completed within a sprint

When evolving retro mechanics, always ask:
> "Does this stage increase the likelihood that the resulting action items will be completed?"

## What RetroQuest Is

RetroQuest is a **gamified, Web3-integrated retrospective companion tool**.

Its focus is not the retro discussion itself—it's **what happens after the retrospective**.

At its core, RetroQuest:
- Tracks action items across time (not just within a single sprint)
- Treats action items as "quests" or challenges
- Makes follow-through visible, persistent, and socially reinforced
- Uses gamification and Web3 primitives to incentivize execution

## Design Principles

**Gamification with purpose**: Not cosmetic. Rewards should meaningfully encourage consistent behavior—completing action items, maintaining streaks, achieving team goals.

**Collective accountability over individual punishment**: Encourage team-level ownership rather than shame or surveillance.

**Web3 as an incentive layer, not a gimmick**: Use tokens, NFTs, on-chain reputation only if they strengthen persistence, ownership, or transparency. Don't overcomplicate the core experience.

**Simple, extensible systems**: Prefer straightforward solutions over over-engineered ones.

## Development Guidelines

When making decisions, ask: **Does this improve follow-through on action items?**

- Keep the follow-through problem as the north star
- Question features that don't directly improve execution consistency
- Default to choices that increase the likelihood action items are remembered, tracked, and completed across sprints
- Acknowledge this is early-stage—details will evolve, but never lose sight of why RetroQuest exists

**Prefer generalization**: When building a feature, ask: "Could this be useful beyond RetroQuest?" If yes, design it as a standalone, reusable component first (e.g., a separate crate in `crates/`), then integrate it. This creates cleaner separation of concerns and potentially reusable infrastructure. Example: `crates/session-keys/` is a generic session key library that RetroQuest happens to use.

---

## Development Workflow

When working on issues, follow this systematic approach:

### 1. Understand
- Read the issue thoroughly (Linear, GitHub, etc.)
- Explore relevant code to understand current state
- Identify affected files and dependencies

### 2. Branch
Create a feature branch from `main` using this naming convention:
```
{type}/{ISSUE-ID}-{short-description}

Types:
  feature/  - New functionality
  fix/      - Bug fixes
  refactor/ - Code cleanup, no behavior change
  docs/     - Documentation only
  test/     - Test additions/fixes

Examples:
  feature/GZA-5-participant-discovery
  fix/GZA-12-vote-calculation
```

### 3. Clarify
Ask questions before coding. It's cheaper to clarify upfront than to rewrite later.

### 4. Plan
Break down the work into testable increments. Use TodoWrite to track tasks.

### 5. Implement (Layered Testing Strategy)

Different layers require different testing approaches:

| Layer | Approach | Examples |
|-------|----------|----------|
| **Utils/Logic** | TDD (Red-Green-Refactor) | Pure functions, data transformations |
| **Data/RPC** | Integration tests | `getProgramAccounts`, on-chain state |
| **UI Components** | Manual verification | Layout, styling, visual design |
| **Critical Flows** | E2E tests (when justified) | Full user journeys |

For each increment:
- **If testable**: Write failing test → Implement → Refactor
- **If UI-only**: Implement → Manually verify → Document what was verified

### 6. Commit
- Keep commits atomic and focused
- Push to GitHub

### 7. Pull Request
- Create PR with summary, root cause (if bug), and test plan
- Link to issue (e.g., "Fixes GZA-5")

### 8. Review
- Wait for human review before merging
- Address feedback in new commits (don't amend unless asked)

### Deployment Notes

| Change Type | Action Required |
|-------------|-----------------|
| **UI-only** | Rebuild and redeploy UI (`cd ui && npm run build`) |
| **Program** | Requires `make deploy-upgrade` from local machine |
| **Both** | Deploy program first, then rebuild UI |

---

## Project Structure

RetroQuest consists of three main components:

| Component | Location | Tech Stack |
|-----------|----------|------------|
| Solana Program | `programs/retroquest/` | Rust, native Solana (not Anchor) |
| React UI | `ui/` | React, TypeScript, Tailwind CSS |
| Integration Tests | `tests/` | TypeScript, solana-bankrun, vitest |

See the CLAUDE.md files in each directory for domain-specific guidance.

## Program ID (Single Source of Truth)

The Solana program ID is defined in `program-id.json` at the repository root. This is the authoritative source.

**Current Program ID**: Check `program-id.json`

To update the program ID across all files:
```bash
./scripts/update-program-id.sh <NEW_PROGRAM_ID>
```

This script updates:
- `program-id.json` (source of truth)
- `programs/retroquest/src/lib.rs` (Rust declare_id!)
- `ui/src/types/index.ts` (React UI)
- `ui/src/debug-participant-entry.ts`
- `tests/bankrun.test.ts`
- `tests/action-items.test.ts`
- `programs/retroquest/CLAUDE.md`

## Current Implementation Status

### Retro Board Flow (Complete)
The core retrospective flow is fully implemented:
1. **Setup** - Facilitator creates board with categories and allowlist
2. **WriteNotes** - Participants add notes to categories
3. **GroupDuplicates** - Participants group similar notes
4. **Vote** - Participants vote on groups (quadratic voting)
5. **Discuss** - Review results and create action items

### Action Items (Complete)
Action items are the core value proposition. Implementation:
- **Solana Program**: `ActionItem` and `VerificationVote` structs in `state.rs`
- **Instructions**: `CreateActionItem` (facilitator only), `CastVerificationVote` (verifiers only when board closed)
- **UI**: DiscussStage component handles creation and verification
- **Flow**: Facilitator assigns owner + verifiers → Board closes → Verifiers approve/reject → Owner's score updates

### Key Files for Action Items
- `programs/retroquest/src/state.rs` - ActionItem, VerificationVote, ActionItemStatus
- `programs/retroquest/src/processor.rs` - process_create_action_item, process_cast_verification_vote
- `ui/src/components/stages/DiscussStage.tsx` - Action item creation form and verification UI
- `ui/src/utils/instructions.ts` - createCreateActionItemInstruction, createCastVerificationVoteInstruction
- `ui/src/types/index.ts` - TypeScript types for ActionItem, VerificationVote

## Common Commands

Use the Makefile for common operations:

```bash
make help            # Show all available commands

# Deployment
make deploy-fresh    # Deploy NEW program (generates new keypair & address)
make deploy-upgrade  # Upgrade EXISTING program (keeps same address)

# Building
make build           # Build Solana program (debug)
make build-release   # Build Solana program (release)
make ui-build        # Build React UI
make ui-start        # Start React dev server

# Testing & Info
make test            # Run integration tests
make lint            # Run linter
make program-id      # Show current program ID
make config          # Show Solana CLI config & balance
```

### Manual Commands (if needed)

```bash
# Solana Program
cargo build-sbf           # Build the program
cargo build-sbf --release # Release build

# Integration Tests (root directory)
pnpm test                 # Run all tests
pnpm test:watch           # Watch mode
pnpm lint                 # Check formatting
pnpm lint:fix             # Fix formatting

# React UI (in ui/ directory)
cd ui
npm start                 # Development server
npm run build             # Production build
npm test                  # React tests
```
