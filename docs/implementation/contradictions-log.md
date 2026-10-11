# Contradictions log

One line per resolved contradiction (see CLAUDE.md "When two documents contradict each other").

| date | milestone | files | what disagreed | winner and reason |
|---|---|---|---|---|
| 2026-10-11 | pre-M0 review | prisma-schema.prisma, 09-code-conventions.md §3.1, 05-data-model.md | QuickReply: example had `shortcut`, VarChar limits, unique (workspaceId, title) and @@map; schema had none of them and unique (workspaceId, locale, title) | Schema completed with `shortcut` (drawn in Figma DLG Settings « Réponse rapide » + inbox « / » popover), lengths 80/1000/30, default locale fr, index (workspaceId, sortOrder); unique stays per locale (schema wins); example aligned, @@map removed (schema uses no @@map). prisma validate = valid |
| 2026-10-11 | pre-M0 | CLAUDE.md, 00-build-order.md, 07-non-functional.md, 09-code-conventions.md, specs/07-architecture.md | Local infra: docs required Docker compose + Testcontainers + MinIO + Mailpit; the machine has no Docker | Owner decision: no Docker locally. embedded-postgres 16.14 (pg_trgm verified) + redis-memory-server (Memurai, verified) + local-disk storage driver + file mail driver; Dockerfiles kept for staging/production only |
| 2026-10-11 | pre-M0 | CLAUDE.md rule 9, 08-coder-playbook.md, 07-non-functional.md | Docs forbade reading any V1 credentials file; owner now authorises taking service keys from V1 | Owner decision wins: V1 .env* readable to fill git-ignored .env; values never printed/logged/committed; deploy keys and SSH keys still off-limits; no production side effects from dev (no webhook re-registration, no real messages/payments/shipments); tests use fake adapters |
