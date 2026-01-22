.PHONY: build build-release deploy deploy-fresh deploy-upgrade ui-build ui-start test lint help

# Default target
help:
	@echo "RetroQuest Makefile"
	@echo ""
	@echo "Program Commands:"
	@echo "  make build          - Build the Solana program (debug)"
	@echo "  make build-release  - Build the Solana program (release)"
	@echo "  make deploy-fresh   - Deploy a NEW program instance (generates new keypair)"
	@echo "  make deploy-upgrade - Upgrade EXISTING program (keeps same address)"
	@echo ""
	@echo "UI Commands:"
	@echo "  make ui-build       - Build the React UI"
	@echo "  make ui-start       - Start the React dev server"
	@echo ""
	@echo "Test Commands:"
	@echo "  make test           - Run integration tests"
	@echo "  make lint           - Run linter"
	@echo ""
	@echo "Info Commands:"
	@echo "  make program-id     - Show current program ID"
	@echo "  make config         - Show Solana CLI config"

# Show current program ID
program-id:
	@cat program-id.json | grep programId

# Show Solana config
config:
	@solana config get
	@echo ""
	@echo "Wallet balance:"
	@solana balance

# Build program (debug)
build:
	cargo build-sbf

# Build program (release)
build-release:
	cargo build-sbf --release

# Deploy a fresh program instance (new keypair, new address)
# Note: Uses shell variables ($$) instead of Make's $(eval) to ensure correct ordering
deploy-fresh:
	@echo "=== Deploying FRESH program instance ==="
	@echo ""
	@echo "Step 1: Generating new program keypair..."
	@solana-keygen new -o target/deploy/retroquest-keypair.json --no-bip39-passphrase --force
	@echo ""
	@echo "Step 2: Getting new program ID and updating references..."
	@NEW_ID=$$(solana-keygen pubkey target/deploy/retroquest-keypair.json) && \
		echo "New Program ID: $$NEW_ID" && \
		./scripts/update-program-id.sh $$NEW_ID
	@echo ""
	@echo "Step 3: Building program with new ID..."
	@cargo build-sbf
	@echo ""
	@echo "Step 4: Deploying to Solana..."
	@solana program deploy target/deploy/retroquest.so --program-id target/deploy/retroquest-keypair.json
	@echo ""
	@echo "Step 5: Building UI..."
	@cd ui && npm run build
	@echo ""
	@echo "=== Deployment complete! ==="
	@cat program-id.json

# Upgrade existing program (same address)
deploy-upgrade:
	@echo "=== Upgrading EXISTING program ==="
	@echo ""
	@echo "Current program ID:"
	@cat program-id.json | grep programId
	@echo ""
	@echo "Step 1: Building program..."
	cargo build-sbf
	@echo ""
	@echo "Step 2: Deploying upgrade..."
	solana program deploy target/deploy/retroquest.so --program-id target/deploy/retroquest-keypair.json
	@echo ""
	@echo "=== Upgrade complete! ==="

# Build UI
ui-build:
	cd ui && npm run build

# Start UI dev server
ui-start:
	cd ui && npm start

# Run tests
test:
	pnpm test

# Run linter
lint:
	pnpm lint
