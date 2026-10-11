# Pre-development review — 2026-10-11

Method: walked the pack the way the coding model will (root `CLAUDE.md` → `00-build-order.md` §0 + M0/M1 → `08-coder-playbook.md` → `09-code-conventions.md` → schema), checked the local machine, and checked that Figma frames are reachable without searching.

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **Blocker (environment)** | Docker is not installed on this machine (`docker: command not found`). M0 needs `docker compose` (Postgres 16, Redis 7, MinIO, Mailpit) and integration tests use Testcontainers. | Owner action: install Docker Desktop (WSL2 backend) and start it before the run. `CLAUDE.md` "Prerequisites" makes this the only allowed stop. |
| 2 | Major | The folder is not a git repository and has no remote, but the playbook assumes branches/PRs. | `CLAUDE.md` "Prerequisites": `git init -b main`, commit `docs/` first, branch per task, local `merge --no-ff`, push only if a remote exists. |
| 3 | Major | The coder was told to open Figma frames "by name"; the MCP tools need node IDs, so every screen would start with a canvas search. | New `docs/figma-frame-index.md`: every Web V2 (124) and Mobile V2 (258) frame with its node ID; referenced from `CLAUDE.md` and playbook §1 step 9. |
| 4 | Major | M0 asked for a `tokens.css` "generated from the Figma variable export" that did not exist. | New `docs/implementation/design-tokens.css` (exported colours, spacing, radius, the 11 text styles, fonts, RTL font swap); `00-build-order.md` M0 risk updated. |
| 5 | Major | Worked example `QuickReply` (09 §3.1, copied verbatim in M0/M1) contradicted `prisma-schema.prisma` (shortcut field, unique key, `@@map`). | Schema completed (`shortcut`, lengths, default locale, index), example aligned, 05 updated; `prisma validate` = valid; logged in `contradictions-log.md`. |
| 6 | Minor | Playbook commit footer hard-coded "Claude Fable 5.1" while Opus codes. | Footer = the attribution Claude Code configures for the session. |
| 7 | Minor | README decisions note still said the page was "being renamed". | Rewritten to "Web V2" + pointer to the frame index. |

Checked and fine: read order, milestone scoping, precedence rule, gap rules (08 §6), contradiction protocol, empty assumption/contradiction logs, error/success envelopes identical in CLAUDE.md, 09 and api-contract, mobile endpoints aligned between 14, 06 and the Mobile V2 frames, 0 open-decision markers.

Not verifiable before code: external accounts (Meta App Review, Chargily, courier APIs, Google OAuth verification, store accounts), AI answer quality on real darija conversations, V1 data migration on a real dump.
