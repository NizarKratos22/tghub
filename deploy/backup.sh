#!/bin/sh
# One backup: the MongoDB database and the uploaded media, in a dated folder.
# Old folders past KEEP_DAYS are removed. Restore steps are in DEPLOY.md.
set -eu

STAMP=$(date -u +%Y%m%d-%H%M%S)
DEST="/backups/$STAMP"
mkdir -p "$DEST"

mongodump --uri="$MONGO_URI" --archive="$DEST/mongo.archive.gz" --gzip --quiet
tar -czf "$DEST/media.tar.gz" -C /data media

# A backup that can't be read is worse than none: check the archive lists cleanly.
mongorestore --archive="$DEST/mongo.archive.gz" --gzip --dryRun --quiet

find /backups -mindepth 1 -maxdepth 1 -type d -mtime "+${KEEP_DAYS:-14}" -exec rm -rf {} +
echo "$(date -u +%FT%TZ) backup $STAMP ok ($(du -sh "$DEST" | cut -f1))"
