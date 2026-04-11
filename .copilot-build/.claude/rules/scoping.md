# Monorepo Scoping Rules

## Every Reply Must Start With
```
Scoped to: [folder] — [description]
```

## Detection Priority
1. **Error pasted** → Stack trace, file paths, service names → scope
2. **File open** → That file's folder
3. **Unclear** → Ask for error text only

## Scope Keywords
| Keyword in Error | Scope |
|---|---|
| `src/`, `.jsx`, `vite`, `npm run` | `src/` |
| `bff/`, `server.mjs`, `.mjs` | `bff/` |
| `ml-engine/`, `.py`, `fastapi` | `ml-engine/` |
| `telegram-bridge/` | `telegram-bridge/` |
| `scripts/`, `.ps1` | `scripts/` |

## Rules When Scoped
- Read/edit ONLY in the scoped microservice folder
- Never auto-expand to other services
- Use grep before read — never glob the whole repo
- Use `/compact` when context > 60%
