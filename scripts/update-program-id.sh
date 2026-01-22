#!/bin/bash
# Updates all program ID references across the codebase
# Usage: ./scripts/update-program-id.sh <NEW_PROGRAM_ID>

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/update-program-id.sh <NEW_PROGRAM_ID>"
  echo "Example: ./scripts/update-program-id.sh AHiDdpGftbt2mVBSeXKafgWVqTFaGtmnC2fMvXR3Uuph"
  exit 1
fi

NEW_ID="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Updating program ID to: $NEW_ID"

# Read current ID from config
CURRENT_ID=$(grep -o '"programId": "[^"]*"' "$ROOT_DIR/program-id.json" | cut -d'"' -f4)
echo "Current program ID: $CURRENT_ID"

if [ "$CURRENT_ID" = "$NEW_ID" ]; then
  echo "Program ID is already set to $NEW_ID"
  exit 0
fi

# Update program-id.json (source of truth)
sed -i '' "s/\"programId\": \"$CURRENT_ID\"/\"programId\": \"$NEW_ID\"/" "$ROOT_DIR/program-id.json"
echo "Updated: program-id.json"

# Update Rust program
sed -i '' "s/declare_id!(\"$CURRENT_ID\")/declare_id!(\"$NEW_ID\")/" "$ROOT_DIR/programs/retroquest/src/lib.rs"
echo "Updated: programs/retroquest/src/lib.rs"

# Update UI types
sed -i '' "s/\"$CURRENT_ID\"/\"$NEW_ID\"/" "$ROOT_DIR/ui/src/types/index.ts"
echo "Updated: ui/src/types/index.ts"

# Update debug file
sed -i '' "s/\"$CURRENT_ID\"/\"$NEW_ID\"/" "$ROOT_DIR/ui/src/debug-participant-entry.ts"
echo "Updated: ui/src/debug-participant-entry.ts"

# Update tests
sed -i '' "s/\"$CURRENT_ID\"/\"$NEW_ID\"/" "$ROOT_DIR/tests/bankrun.test.ts"
echo "Updated: tests/bankrun.test.ts"

sed -i '' "s/\"$CURRENT_ID\"/\"$NEW_ID\"/" "$ROOT_DIR/tests/action-items.test.ts"
echo "Updated: tests/action-items.test.ts"

# Update CLAUDE.md docs
sed -i '' "s/\`$CURRENT_ID\`/\`$NEW_ID\`/" "$ROOT_DIR/programs/retroquest/CLAUDE.md"
echo "Updated: programs/retroquest/CLAUDE.md"

echo ""
echo "All references updated to: $NEW_ID"
echo ""
echo "Next steps:"
echo "  1. Rebuild the program: cargo build-sbf"
echo "  2. Deploy: solana program deploy target/deploy/retroquest.so"
echo "  3. Rebuild UI: cd ui && npm run build"
