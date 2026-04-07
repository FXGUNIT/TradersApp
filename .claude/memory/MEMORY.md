# TradersApp Memory Index

Memory files are loaded into every Claude Code conversation context. Each entry has a frontmatter with `name`, `description`, and `type`.

## Adding a Memory
1. Create a new `.md` file in this directory with frontmatter
2. Add a one-line entry below (under ~150 chars)
3. Delete stale entries when no longer relevant

## Memory Types
- **user** — User's role, preferences, knowledge level
- **feedback** — Guidance on how to approach work (what to avoid/repeat)
- **project** — Current work goals, deadlines, blockers
- **reference** — Pointers to external systems (Linear, Grafana, etc.)

- [user_project_context.md](user_project_context.md) — TradersApp project overview and architecture
- [k8s_kafka_audit_2026_04_08.md](k8s_kafka_audit_2026_04_08.md) — k3s v1.34.6 running on WSL Ubuntu, PV inventory, Kafka all 5 consumers wired, SQLite data loss fix applied
