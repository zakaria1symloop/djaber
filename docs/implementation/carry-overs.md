# Carry-overs between stages

Items that belong to a stage's screens or flows but depend on a module built in a later stage.
Each line: where it came from → the stage that must close it. Remove the line when done (and say so in that stage's progress note).

| from | item | closes in |
|---|---|---|
| M1 | In-app notifications `member.invited`, `member.joined`, `member.role_changed`, `workspace.deletion_scheduled` (M1 sends the e-mails only) | M5 (notifications module, AT-NTF) |
| M1 | Workspace deletion: Meta unsubscribe of connected pages at purge time; subscription cancelled at purge | M3 (channels) / M9 (billing) |
| M1 | Public account-deletion page `/account/deletion` + `POST /account-deletion/*`; `GET /me/data-export` and the export job | M11 (public pages) |
| M1 | Onboarding steps 3–5 main buttons (add products / create agent / connect a page) only advance | M2 (products) · M3 (channel) · M4 (agent) |
| M1 | AT-AUTH-08 / AT-AUTH-09 server tests use harness routes for "channel connect" and "order delete" | M3 / M5: point them at the real routes |
| M1 | Avatar / logo crop step of the upload dialogs (API already resizes to 512 px) | M11 polish pass |
| M1 | `(app)` routes of later stages (`/orders`, …) render the localized 404 outside the shell | each stage adds its routes; final pass in M11 checks every sidebar link |
| all | Storybook: stories exist for every primitive and for the GLOBAL states; per-screen state stories are replaced by Playwright specs per AT id + axe checks (`apps/web/e2e`) | decision recorded in assumptions-log (M1) |
