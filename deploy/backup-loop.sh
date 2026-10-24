#!/bin/sh
# Runs backup.sh once at start, then every day at about 03:00 UTC.
while true; do
  sh /scripts/backup.sh || echo "$(date -u +%FT%TZ) backup FAILED"
  now=$(date -u +%s)
  next=$(( (now / 86400 + 1) * 86400 + 3 * 3600 ))
  sleep $(( next - now ))
done
