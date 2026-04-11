# Anti-Patterns to Never Do

- [ ] Never append to a file over 600 lines — split it
- [ ] Never use `any` in TypeScript — use `unknown` + narrowing
- [ ] Never use `// @ts-ignore` — fix the type instead
- [ ] Never `await` inside a `Promise.all` loop — use `Promise.allSettled`
- [ ] Never mutate state directly in React — always use `setState` or Zustand actions
- [ ] Never hardcode a URL in code — use env vars
- [ ] Never commit secrets — use Infisical
- [ ] Never use `sleep` in tests — use `waitFor` assertions
- [ ] Never catch `Exception` broadly — catch specific exceptions
- [ ] Never use `eval()` or `new Function()` — use `JSON.parse` for JSON
- [ ] Never make the ML engine depend on the BFF — BFF calls ML, never reverse
