#!/bin/bash

# ============================================================================
# AgentiFi Bot - Auto Update Script
# Run this to pull latest changes and restart the bot
# ============================================================================
# 
# Usage:
#   ./update.sh              # Pull and restart
#   ./update.sh --force      # Force pull (discard local changes)
#   ./update.sh --watch      # Auto-update every 5 minutes
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$PROJECT_ROOT"

BRANCH="iceberg"
FORCE=false
WATCH=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --force) FORCE=true ;;
        --watch) WATCH=true ;;
    esac
done

update() {
    echo ""
    echo "🔄 Checking for updates..."
    
    # Fetch latest
    git fetch origin $BRANCH
    
    # Check if there are updates
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/$BRANCH)
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        log "Already up to date"
        return 0
    fi
    
    warn "Updates available!"
    echo "   Local:  ${LOCAL:0:8}"
    echo "   Remote: ${REMOTE:0:8}"
    
    # Pull changes
    if [ "$FORCE" = true ]; then
        log "Force pulling (discarding local changes)..."
        git reset --hard origin/$BRANCH
    else
        log "Pulling changes..."
        git pull origin $BRANCH
    fi
    
    # Install dependencies
    log "Installing dependencies..."
    bun install
    
    # Restart services
    log "Restarting services..."
    pm2 restart agentifi-bot
    
    log "Update complete!"
    echo ""
    
    # Show recent commits
    echo "📋 Recent changes:"
    git log --oneline -5
    echo ""
}

if [ "$WATCH" = true ]; then
    log "Starting auto-update watcher (every 5 minutes)..."
    log "Press Ctrl+C to stop"
    
    while true; do
        update
        sleep 300  # 5 minutes
    done
else
    update
fi
