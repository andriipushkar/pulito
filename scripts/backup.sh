#!/usr/bin/env bash
# Pulito — Backup Script
# Performs PostgreSQL database backup and uploads directory sync.
#
# Usage:
#   ./scripts/backup.sh              # Full backup (DB + uploads)
#   ./scripts/backup.sh --db-only    # Database backup only
#   ./scripts/backup.sh --files-only # Uploads backup only
#
# Environment variables:
#   BACKUP_DIR       — Backup destination (default: /backups)
#   DATABASE_URL     — PostgreSQL connection string
#   UPLOAD_DIR       — Uploads directory (default: ./uploads)
#   BACKUP_RETENTION — Days to keep backups (default: 30)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
BACKUP_RETENTION="${BACKUP_RETENTION:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

DB_BACKUP_DIR="${BACKUP_DIR}/db"
FILES_BACKUP_DIR="${BACKUP_DIR}/uploads"

MODE="${1:-full}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

backup_database() {
  log "Starting database backup..."

  mkdir -p "$DB_BACKUP_DIR"

  if [ -z "${DATABASE_URL:-}" ]; then
    log "ERROR: DATABASE_URL is not set"
    exit 1
  fi

  DUMP_FILE="${DB_BACKUP_DIR}/pulito_${TIMESTAMP}.sql.gz"
  pg_dump "$DATABASE_URL" | gzip > "$DUMP_FILE"

  DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
  log "Database backup complete: ${DUMP_FILE} (${DUMP_SIZE})"
}

backup_uploads() {
  log "Starting uploads backup..."

  mkdir -p "$FILES_BACKUP_DIR"

  if [ ! -d "$UPLOAD_DIR" ]; then
    log "WARNING: Upload directory ${UPLOAD_DIR} does not exist, skipping"
    return
  fi

  rsync -avz --delete "$UPLOAD_DIR/" "$FILES_BACKUP_DIR/"
  log "Uploads backup complete"
}

cleanup_old_backups() {
  log "Cleaning up backups older than ${BACKUP_RETENTION} days..."

  if [ -d "$DB_BACKUP_DIR" ]; then
    find "$DB_BACKUP_DIR" -name "*.sql.gz" -mtime +"$BACKUP_RETENTION" -delete 2>/dev/null || true
    REMAINING=$(find "$DB_BACKUP_DIR" -name "*.sql.gz" | wc -l)
    log "Database backups remaining: ${REMAINING}"
  fi
}

# Main
log "=== Pulito Backup ==="
log "Mode: ${MODE}"

case "$MODE" in
  --db-only)
    backup_database
    cleanup_old_backups
    ;;
  --files-only)
    backup_uploads
    ;;
  full|*)
    backup_database
    backup_uploads
    cleanup_old_backups
    ;;
esac

log "=== Backup complete ==="
