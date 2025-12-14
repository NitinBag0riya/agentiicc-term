# AgentiFi Cleanup Analysis

## 🎯 Core Application Files (KEEP)

### Main Entry Points

- ✅ `src/index.ts` - Main Telegram bot entry point
- ✅ `src/server-bun.ts` - API server entry point

### Core Modules

- ✅ `src/adapters/` - Exchange adapters (Aster, Hyperliquid)
  - `base.adapter.ts`
  - `aster.adapter.ts`
  - `hyperliquid.adapter.ts`
  - `factory.ts`
- ✅ `src/api/server.ts` - Main API server
- ✅ `src/bot/` - Telegram bot logic
  - `scenes/link.scene.ts`
  - `scenes/unlink.scene.ts`
  - `types/context.ts`
- ✅ `src/db/` - Database layer
  - `postgres.ts`
  - `users.ts`
- ✅ `src/middleware/` - Auth & session
  - `auth.ts`
  - `session.ts`
- ✅ `src/utils/` - Utilities
  - `encryption.ts`
  - `hyperliquid-signer.ts`

### Configuration

- ✅ `package.json`
- ✅ `tsconfig.json`
- ✅ `.env` (keep, but ensure it's in .gitignore)
- ✅ `.env.example`
- ✅ `.gitignore`
- ✅ `README.md`
- ✅ `README_API.md`

### Deployment

- ✅ `Procfile` - For deployment
- ✅ `railway.json` - Railway config
- ✅ `nixpacks.toml` - Build config

## 🧪 Test Files (KEEP - Useful for Development)

- ✅ `src/simulate-postman-collection.ts` - Comprehensive API test
- ✅ `Universal_API.postman_collection.json` - API collection

## 🗑️ Files to REMOVE (Unused/Debug/Redundant)

### Debug Files

- ❌ `src/debug-hl-meta.ts` - Debug script
- ❌ `src/debug-sdk.ts` - Debug script

### Redundant Test Files

- ❌ `src/api-robust.test.ts` - Redundant (covered by simulate-postman-collection)
- ❌ `src/universal-api.test.ts` - Redundant
- ❌ `src/live-test-aster.ts` - Development test only
- ❌ `src/live-test-hyperliquid.ts` - Development test only
- ❌ `src/live-test-universal.ts` - Development test only
- ❌ `src/verify-credential-api.ts` - Verification script
- ❌ `src/verify-live.ts` - Verification script
- ❌ `src/verify-postman-flows.ts` - Verification script
- ❌ `src/verify-server-fix.ts` - Verification script

### Redundant API Servers

- ❌ `src/api/simple-server.ts` - Replaced by main server
- ❌ `src/api/server-with-docs.ts` - Replaced by main server
- ❌ `src/run-api-docs.ts` - Entry point for unused server
- ❌ `src/run-api-only.ts` - Redundant entry point
- ❌ `src/run-simple-api.ts` - Entry point for unused server

### Backup/Temporary Files

- ❌ `.env.bak` - Backup file
- ❌ `.env.local.backup` - Backup file
- ❌ `.env.remote` - Redundant env file
- ❌ `nohup.out` - Log file
- ❌ `server_strict.log` - Log file

### Root Level Scripts (Move to scripts/ or remove)

- ❌ `link-credentials.ts` - Move to scripts or remove
- ❌ `setup-remote-supabase.sh` - Move to scripts
- ❌ `update-db-password.sh` - Move to scripts

### Scripts to Review

- ⚠️ `scripts/add-test-data.sql` - Keep if needed for testing
- ⚠️ `scripts/backup-db.sh` - Keep
- ⚠️ `scripts/generate-docs.ts` - Keep if generating docs
- ⚠️ `scripts/migrate-local-data.sh` - Keep for migration
- ⚠️ `scripts/reset-db-fresh.sql` - Keep
- ⚠️ `scripts/seed-postman-user.ts` - Keep for testing
- ⚠️ `scripts/setup.sh` - Keep
- ⚠️ `scripts/start-live.sh` - Keep
- ⚠️ `scripts/update-db.sh` - Keep

## 📊 Summary

**Total Files to Remove:** ~25 files
**Core Files to Keep:** ~20 files
**Scripts to Keep:** 9 files

## 🎯 Recommended Actions

1. Remove all debug and verification scripts
2. Remove redundant test files (keep simulate-postman-collection.ts)
3. Remove redundant API servers (keep main server.ts)
4. Remove backup and log files
5. Clean up root directory (move scripts to scripts/)
6. Update package.json to remove unused scripts
