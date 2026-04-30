#!/bin/sh
# Fix permissions on named volumes that Docker initializes as root.
# This runs BEFORE the main process (as root), then execs so the app
# runs as the tradersapp user defined in the Dockerfile USER directive.
for dir in /app/board-room /app/runtime /app/bff/data; do
  if [ -d "$dir" ]; then
    mkdir -p "$dir"
    chown -R tradersapp:tradersapp "$dir" 2>/dev/null || true
    chmod -R 755 "$dir" 2>/dev/null || true
  fi
done
exec "$@"
