# AI agents in oval

- **Rules:** `.agents/rules/*.mdc` — checklists for Cursor and other agents.
- **Entry:** `AGENTS.md` / `CLAUDE.md` at repo root.
- **Cursor:** `.cursor/rules/` symlinks into `.agents/rules/`.
- **Product plan:** [`PLAN.md`](../../PLAN.md).

When you introduce a repeatable workflow (webhooks, payments, bots), add or extend a scoped `.mdc` and a row in `maintain-rules.mdc`.
