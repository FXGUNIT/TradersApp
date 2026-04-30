#!/bin/sh
# Run as root to fix named volume permissions, then exec as tradersapp.
# Named Docker volumes are initialized as root, making them inaccessible
# to the tradersapp USER at runtime without this fix.
for dir in /app/board-room /app/runtime /app/bff/data; do
  mkdir -p "$dir"
  chown -R tradersapp:tradersapp "$dir" 2>/dev/null || true
  chmod -R 755 "$dir" 2>/dev/null || true
done
exec gosu tradersapp "$@"
