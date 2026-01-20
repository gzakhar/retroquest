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

---

## Project Structure

RetroQuest consists of three main components:

| Component | Location | Tech Stack |
|-----------|----------|------------|
| Solana Program | `programs/retroquest/` | Rust, native Solana (not Anchor) |
| React UI | `ui/` | React, TypeScript, Tailwind CSS |
| Integration Tests | `tests/` | TypeScript, solana-bankrun, vitest |

See the CLAUDE.md files in each directory for domain-specific guidance.

## Common Commands

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
