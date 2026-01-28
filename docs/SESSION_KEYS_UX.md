# Session Keys: Painless dApp Interactions

## The Problem: Wallet Fatigue

Every action in a Solana dApp requires a wallet signature. For interactive applications, this creates a painful user experience:

```
1. Click a button
2. Wallet popup appears
3. Review transaction
4. Click "Approve"
5. Wait for confirmation
6. Repeat... 20-50 times per session
```

In a typical retrospective session, users perform dozens of actions:
- Writing notes (5-10 per person)
- Grouping similar notes (10-20 drag-and-drops)
- Voting on groups (5-15 votes)
- Creating action items (3-5 items)
- Verifying completed items (multiple votes)

**Each action = another popup.** This breaks flow, kills engagement, and makes the app feel clunky compared to Web2 alternatives.

---

## The Solution: Session Keys

Session keys eliminate wallet fatigue by letting users sign **once** at the start of a session.

### How It Works

1. When a user joins a board, they're prompted to "Enable smooth mode"
2. They sign **one** transaction to create a session
3. An ephemeral keypair is generated and authorized to act on their behalf
4. All subsequent actions happen instantly—no popups
5. The session expires automatically (or when they leave)

### Before vs After

| Without Session Keys | With Session Keys |
|---------------------|-------------------|
| 30+ wallet popups per retro | 1 wallet popup per retro |
| Constant context switching | Uninterrupted flow |
| "This feels like a chore" | "This feels like Notion" |

---

## Security: Why This Is Safe

Session keys are designed with security as a first principle:

| Protection | How It Works |
|------------|--------------|
| **Program-scoped** | A session for RetroQuest can't be used on other programs |
| **Time-limited** | Sessions expire automatically (default: 1 hour, max: 7 days) |
| **Revocable** | Users can end a session early at any time |
| **Memory-only** | Ephemeral keys live in browser memory, never stored persistently |
| **Limited scope** | Session keys can only perform participant actions, not transfer funds |

### What Can Go Wrong?

**Worst case**: Someone gains access to your browser tab while you have an active session. They could:
- Add notes to the current board
- Vote on groups
- Create action items

They **cannot**:
- Transfer SOL or tokens
- Access other boards
- Perform facilitator actions
- Do anything after you close the tab

This is a significantly smaller attack surface than a compromised wallet.

---

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User joins board                                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  "Enable smooth mode?"                                │  │
│  │                                                       │  │
│  │  Sign once to skip wallet popups for this session.   │  │
│  │  Your session will expire in 1 hour.                  │  │
│  │                                                       │  │
│  │  [Enable]  [Maybe Later]                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  User clicks [Enable]                                       │
│  → Wallet popup (ONE TIME)                                  │
│  → User signs                                               │
│  → Session active                                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Session active (expires in 59 min)            [End]  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  All actions now instant - no popups                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Principle

> **Interactions with RetroQuest should feel as smooth as a Web2 app.**

Blockchain is the accountability layer, not the user experience. Users shouldn't have to think about transactions, signatures, or gas fees while running a retrospective. Session keys bridge this gap—keeping the benefits of on-chain data while removing the friction.

---

## Technical Details

For implementation details, see:
- [`crates/session-keys/docs/DESIGN.md`](../crates/session-keys/docs/DESIGN.md) - Technical design
- [`crates/session-keys/src/lib.rs`](../crates/session-keys/src/lib.rs) - Library implementation
