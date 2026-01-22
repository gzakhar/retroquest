# Solana CLI Installation on Intel macOS — Known Issues & Stable Setup

## TL;DR (Executive Summary)

- Solana 3.x (Agave) is broken on Intel macOS for RPC calls (`solana balance` returns HTTP 400)
- This is not a config issue, not a keypair issue, and not user error
- The issue does not occur on Solana 1.18.x or 2.x
- The official installer is correct, but the latest version it installs is not
- Downgrading to Solana 2.1.x via the Anza installer fully resolves the issue
- Homebrew Solana works only because it pins to 1.18.x

## Environment Where This Occurs

- **Hardware**: Intel MacBook Pro (2015–2019 confirmed)
- **OS**: macOS (Sonoma / Sequoia)
- **Architecture**: x86_64
- **Solana versions affected**: 3.0.x (Agave)

### Symptoms

```bash
solana balance
Error: HTTP status client error (400 Bad request)
```

Happens on:
- devnet
- mainnet-beta

Happens even with:
- correct RPC URL
- valid keypair
- fresh install

## Root Cause (What's Actually Broken)

- Solana 3.x (Agave) introduces a regression in RPC handling on Intel macOS
- POST requests to Solana RPC endpoints intermittently or consistently fail
- This is confirmed by multiple developers across GitHub issues
- ARM Macs (Apple Silicon) are **not** affected
- Downgrading Solana fixes the problem instantly

**This is a Solana client bug, not a networking or TLS issue.**

## What Does NOT Fix It

- ❌ Reinstalling Solana 3.x
- ❌ Resetting solana config
- ❌ Changing RPC URLs
- ❌ Regenerating keypairs
- ❌ Reinstalling Rust
- ❌ Removing Homebrew
- ❌ Cleaning .zshrc
- ❌ Rebooting (sometimes masks it temporarily, not permanent)

## Correct, Stable Installation (Recommended)

### 1. Clean Old Solana Installs (optional but recommended)

```bash
rm -rf ~/.local/share/solana
```

Remove Solana PATH entries from `~/.zshrc`:

```bash
# REMOVE any Solana-related PATH lines like:
# ~/.local/share/solana/install/active_release/bin
```

Reload shell:

```bash
source ~/.zshrc
```

Confirm Solana is gone:

```bash
which solana
# should say: solana not found
```

### 2. Install Solana 2.1.0 (Known-Good Version)

Use the official Anza installer:

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.0/install)"
```

Verify:

```bash
solana --version
# solana-cli 2.1.0
```

### 3. Restore PATH (One Line Only)

Add this to `~/.zshrc`:

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

Reload:

```bash
source ~/.zshrc
```

### 4. Verify Everything Works

```bash
solana balance
```

Expected:

```
0 SOL
```

This confirms:
- RPC works
- CLI works
- Network works
- Keypair works

## SBF / Program Development Support

- `cargo-build-sbf` still works
- Uses pinned Rust 1.79.x internally (this is normal)
- Anchor 0.32.x works with Solana 2.x
- No Homebrew Solana required

Verify:

```bash
cargo-build-sbf --version
```

### Dependency Version Conflicts (indexmap, etc.)

The Solana toolchain ships with an older Rust compiler (rustc 1.79.0-dev) than your system Rust. Some dependencies may require newer Rust versions and fail to build.

**Symptom:**

```bash
cargo build-sbf
error: rustc 1.79.0-dev is not supported by the following package:
  indexmap@2.13.0 requires rustc 1.82
```

**Fix:** Pin incompatible dependencies to older versions in your `Cargo.toml`:

```toml
[dependencies]
# Pin indexmap to version compatible with Solana's rustc 1.79
indexmap = "=2.2.6"
```

**Common packages that may need pinning:**

| Package | Compatible Version | Notes |
|---------|-------------------|-------|
| indexmap | =2.2.6 | Required for rustc 1.79 |

If you encounter other version conflicts, use the same approach: find the latest version that supports rustc 1.79 and pin it with `"=x.y.z"`.

## Why Homebrew "Worked" Before

- Homebrew pins Solana to 1.18.x
- 1.18.x does not have the Intel macOS RPC bug
- Homebrew is deprecated and not suitable for SBF
- **The fix is not Homebrew — it's avoiding Solana 3.x**

## Versions Known to Work on Intel macOS

| Version | Status |
|---------|--------|
| 1.18.x | ✅ Works |
| 2.1.0 | ✅ Works (recommended) |
| 2.2.9 | ✅ Works (reported by others) |
| 3.0.x (Agave) | ❌ Broken on Intel macOS |

## Upgrade Strategy Going Forward

- Stay on 2.1.x or 2.2.x
- Do **not** auto-upgrade to 3.x on Intel Macs
- Re-test 3.x only after:
  - explicit Solana/Anza fix announcement
  - or verified community confirmation

## One-Line Recovery Command (Bookmark This)

If this ever breaks again on a new Intel Mac:

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.0/install)"
```

## Final Notes

- This issue is real, reproducible, and documented
- You did not misconfigure anything
- Downgrading is not a hack — it's the correct workaround
- This setup is official, supported, and stable
