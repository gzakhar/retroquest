# UI - CLAUDE.md

Technical guidance for working with the RetroQuest React frontend.

## Tech Stack

- **React** with TypeScript
- **Tailwind CSS** for styling
- **Solana wallet adapter** for wallet connections

## Directory Structure

```
ui/src/
├── components/
│   └── stages/       # Stage-specific views (Setup, WriteNotes, etc.)
├── hooks/            # React hooks for program interaction
├── utils/
│   ├── pda.ts        # PDA derivation (must match Rust seeds)
│   ├── instructions.ts # Instruction builders
│   └── deserialize.ts  # Borsh deserialization
└── types/            # TypeScript type definitions
```

## Critical: PDA Matching

The UI's PDA derivation in `utils/pda.ts` **must exactly match** the Rust program's seeds. If PDAs don't match, transactions will fail with "account not found" or similar errors.

Seeds to match (see `programs/retroquest/CLAUDE.md` for canonical definitions):
- `facilitator_registry`
- `board`
- `membership`
- `note`
- `group`
- `vote`

When debugging PDA issues, verify:
1. Seed strings are identical (case-sensitive)
2. Byte ordering matches (little-endian for numeric IDs)
3. All seed components are included in the correct order

## Stage Components

Each retro stage has a corresponding component in `components/stages/`. The stage flow is:

```
Setup → WriteNotes → GroupDuplicates → Vote → Discuss
```

Components should:
- Fetch and display relevant on-chain data
- Provide appropriate controls based on user role (facilitator vs participant)
- Handle loading and error states gracefully

## Development Conventions

**State management**: Use React hooks. Prefer local state where possible; lift state only when necessary.

**Wallet interactions**: All transactions go through the wallet adapter. Handle connection states and signing errors gracefully.

**Error handling**: Display user-friendly error messages. Log detailed errors for debugging.

**Styling**: Use Tailwind utility classes. Keep components visually consistent.

## Commands

```bash
npm start     # Development server with hot reload
npm run build # Production build
npm test      # Run React tests
```

## Philosophy Reminder

The UI should guide users toward creating **actionable, completable** items. Design choices in the interface directly impact whether action items get followed through. Keep the stage views focused on moving toward commitment, not endless discussion.
