# Retrospective Flow Specification

This document defines the retrospective flow in RetroQuest—the core user experience that produces action items.

## Overview

A RetroQuest retrospective progresses through five stages. Each stage is designed to move the team toward **fewer, clearer, more actionable commitments**.

```
Setup → WriteNotes → GroupDuplicates → Vote → Discuss
```

Only the facilitator can advance stages. Stages cannot be reversed.

---

## Stage 1: Setup

**Purpose**: Configure the retrospective before participants join.

**Facilitator actions**:
- Create a new board
- Define categories (e.g., "What went well", "What to improve", "Action items")
- Set voting credits per participant (default: 5)
- Add participants to the allowlist

**Participants**: Cannot interact yet.

**Exit criteria**: Facilitator advances to WriteNotes.

### Design considerations

- Categories should encourage actionable observations, not just venting
- Limiting categories (max 5) forces focus
- Allowlist ensures only team members participate

---

## Stage 2: WriteNotes

**Purpose**: Capture individual observations and ideas.

**Participant actions**:
- Write notes in any category
- Notes are limited to 280 characters (forces conciseness)
- All participants can see all notes in real-time

**Facilitator actions**:
- Can also write notes
- Advances stage when ready

**Exit criteria**: Facilitator advances to GroupDuplicates.

### Design considerations

- Character limit prevents essays—forces distillation
- Real-time visibility creates shared awareness
- No editing after submission encourages thoughtful initial input

---

## Stage 3: GroupDuplicates

**Purpose**: Consolidate similar notes into themes.

**Facilitator actions**:
- Create groups with descriptive titles (max 80 chars)
- Assign notes to groups
- Unassigned notes remain standalone

**Participants**: View-only during this stage.

**Exit criteria**: Facilitator advances to Vote.

### Design considerations

- Grouping surfaces patterns the team cares about
- Facilitator-controlled to keep momentum (avoids endless discussion)
- Group titles should capture the actionable essence, not just describe

---

## Stage 4: Vote

**Purpose**: Prioritize which themes deserve team commitment.

**Participant actions**:
- Allocate voting credits to groups
- Can split credits across multiple groups
- Cannot vote on ungrouped notes

**Facilitator actions**:
- Can also vote
- Advances stage when voting complete

**Exit criteria**: Facilitator advances to Discuss.

### Design considerations

- Limited credits (default 5) forces prioritization
- Voting on groups (not individual notes) focuses on themes
- Results reveal what the team collectively wants to commit to

---

## Stage 5: Discuss

**Purpose**: Convert top-voted themes into concrete action items.

**Current state**: Discussion stage is implemented but action item creation is not yet built.

**Planned functionality**:
- View groups ranked by vote count
- Create action items from top groups
- Assign owners to action items
- Action items persist beyond the retrospective

**Exit criteria**: Facilitator closes the retrospective.

### Design considerations

- Discussion should converge on commitment, not endless reflection
- Action items need: clear description, owner, and visibility
- This is where RetroQuest's value proposition kicks in—what happens after the retro

---

## Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max participants | 8 | Keep retros focused and manageable |
| Max categories | 5 | Force category discipline |
| Max category name length | 32 chars | Concise labels |
| Max note length | 280 chars | Force distillation |
| Max group title length | 80 chars | Descriptive but focused |
| Default voting credits | 5 | Enough for nuance, limited enough to force prioritization |

---

## Future Considerations

These are not committed features—just areas to explore:

- **Action item tracking**: The core value prop. Persist items, track completion, surface in future retros.
- **Gamification hooks**: Streaks, team achievements, completion rewards
- **Web3 integration**: On-chain action items, token incentives for completion
- **Anonymous mode**: Option for anonymous note writing
- **Timer/timeboxing**: Optional time limits per stage
