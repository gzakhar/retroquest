# Tests - CLAUDE.md

Technical guidance for working with RetroQuest integration tests.

## Tech Stack

- **vitest** - Test runner
- **solana-bankrun** - Solana program testing framework (simulates validator)
- **TypeScript**

## Directory Structure

```
tests/
├── helpers/
│   └── pda.ts        # Test helper PDA derivation
├── *.test.ts         # Test files
```

## Important: Seed Name Discrepancy

The test helpers in `tests/helpers/pda.ts` use **different seed names** than the actual program:

| Test Helper | Actual Program |
|-------------|----------------|
| `team_registry` | `facilitator_registry` |

This is a known inconsistency. When writing or debugging tests:
- Use the test helper functions as-is (they work with the deployed program)
- If adding new PDA helpers, match the pattern in the existing helpers
- The UI uses the correct program seeds

## Running Tests

From the **repository root** (not the tests directory):

```bash
pnpm test        # Run all tests once
pnpm test:watch  # Watch mode for development
```

## Writing Tests

**Use bankrun context**: Tests run against a simulated Solana validator. Set up accounts and state before testing instructions.

**Test the happy path and edge cases**: Verify both successful operations and expected failures (wrong signer, invalid state transitions, etc.).

**Clean test isolation**: Each test should set up its own state. Don't rely on state from previous tests.

## Common Test Patterns

```typescript
// Setting up a test context
const context = await startAnchor(...);
const client = context.banksClient;

// Creating and funding accounts
// Sending transactions
// Asserting on account state after transactions
```

## Debugging Tips

1. **PDA mismatch**: If accounts aren't found, verify seed derivation matches the program
2. **Serialization errors**: Check Borsh encoding matches expected format
3. **Instruction failures**: Log the transaction error for detailed failure reasons

## Linting

```bash
pnpm lint      # Check formatting
pnpm lint:fix  # Auto-fix formatting issues
```
