# Subject Notebook — prioritized implementation checklist

Agent-authored implementation checklist. Follow [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), and the gates in [FEASIBILITY.md](FEASIBILITY.md). Use a separate disposable test vault throughout. Current evidence is in [VALIDATION.md](VALIDATION.md); unchecked host-only items remain release work.

## Phase 0 — Resolve API integration risks (P0)

- [ ] Record actual desktop Obsidian version, API package version, and official source revision; pin development dependencies and choose the minimum supported patch.
- [ ] Run E1: named native Base embedding, two simultaneous views, task drag, cleanup, disabled/missing Bases.
- [ ] Run E2: nested managed panes, occupied workspaces, unrelated/pinned tabs, rapid switches, user customization, Workspaces Plus coexistence.
- [ ] Run E3: native project text and safe formula badge; determine whether exact project colors survive rendering.
- [ ] Document outcomes and select documented fallbacks before expanding implementation.

Acceptance: integration evidence names versions and observed behavior. Any reduced acceptance criterion is explicit. No private API, native-DOM selectors, or unverified leaf-state keys are introduced to make a test appear to pass.

## Phase 1 — Skeleton, settings, projects (P0)

- [x] Scaffold the official plugin build pattern using Subject Notebook / `subject-notebook`, strict TypeScript, lint/format/typecheck/test/build scripts, and a lockfile.
- [x] Keep entry-point lifecycle wiring small; add precise types, namespace constant imports, and no module-scope side effects.
- [x] Validate stored settings as unknown input; define defaults and schema migration behavior.
- [x] Build native settings controls for directory, status default, palettes, headings, styling, status item, optional Home note.
- [x] Discover immediate project folders after layout readiness; update on relevant vault events.
- [x] Validate names/paths, case and Unicode collisions, reserved names, and the project-name `Log` collision.
- [x] Create/adopt projects and repair missing required files without replacing content; create Tasks.base only when absent.
- [x] Surface failed/partial operations and support safe retry; never delete files on rollback.
- [ ] Handle externally renamed/deleted folders and invalid active context; preview repair of stale task/view references.

Acceptance: PFAS creation produces the specified three project paths and one Base. Repeating it preserves every existing byte. Existing projects appear without configuration. Unrelated folders are ignored. Startup does not read logs, create files, or rearrange panes.

## Phase 2 — Notebook automation and creation commands (P0)

- [x] Implement pure local-date and daily-section logic with a replaceable section-generation function.
- [x] Check exact real H2 date headings, ignoring frontmatter/fenced examples; preserve newline style and existing content.
- [x] Serialize log operations by file, inspect live editable buffers, and use atomic processing only for appropriate background updates.
- [x] Connect file-open/active-leaf events with cheap path checks and cancellation of stale focus work.
- [x] Position the requested editable log at current EOF and scroll into view. Preserve ordinary Reading view navigation.
- [x] Add New project note/task and Open project log/homepage commands with context checks and Home project selection.
- [x] Create initial task frontmatter safely with configured status; keep ordinary notes schema-free.
- [x] Test LF/CRLF, empty file, no final newline, edited-today/no-heading, two panes, unsaved edits, rapid events, and midnight changes.

Acceptance: ten rapid log activations append one heading for the local day, preserve unsaved text and undo behavior, and do not repeatedly move the cursor while typing. Task title collisions preserve the existing note. Native new-note behavior remains unchanged.

## Phase 3 — Project switching and Home (P0)

- [x] Add Switch project and Open Home, initially using a native searchable modal.
- [x] Implement one active switch with one latest pending request; check cancellation after every asynchronous step.
- [x] Build/reuse managed leaves using the E2-approved public API sequence.
- [x] Offer a concrete first-use layout choice in occupied workspaces and restore/preserve choices after user customization.
- [x] Open log top-left, homepage top-right, planner below; commit context and focus only after the winning request succeeds.
- [x] Define partial planner/file failure recovery without closing unrelated notes or replaying stale whole-workspace snapshots.
- [x] Home selects All Projects, clears the main indicator, preserves folder colors on reference notes, and respects optional landing-note settings.
- [x] Implement conservative empty-editor log fallback with startup/switch/unload/reentrancy guards.
- [x] Invalidate pending work on unload; do not rebuild restored layouts automatically on startup.

Acceptance: repeated PFAS → ItR → Home → PFAS ends in the correct context with bounded leaves and final Log EOF focus. Extra notes remain usable. Closing the whole project area stays closed. Ordinary navigation does not restore geometry or steal focus.

## Phase 4 — Native shared planner (P0)

- [x] Generate valid initial Base filters, editable status grouping, exact five-column order, and All Projects/named project views.
- [x] Escape expression literals separately from YAML serialization; cover quoted and non-ASCII project names.
- [x] Implement the E1-approved embed host with child-component cleanup; use the documented wrapper-note fallback only if needed.
- [x] Detect missing/invalid views and configuration; never show an unfiltered board labeled as project-filtered.
- [x] Add previewed existing-Base view additions with validation, collision handling, and concurrent-change abort/re-preview.
- [x] Preserve comments, custom views, unknown keys, and filters; offer a manual fragment for unsupported YAML layouts.
- [x] Explain that unknown statuses are hidden by the fixed group list and remain in their task notes.
- [x] Show a useful planner fallback for missing/disabled Bases while keeping note/task commands usable.
- [x] Verify one task in PFAS appears once in PFAS and All Projects; drag Backlog → Today and inspect the same Markdown file.

Acceptance: native drag changes only the intended property while preserving body content. Empty columns stay visible. Two planner instances remain independent. Switching and ordinary opens cause zero Base writes. An existing customized Base stays byte-identical until an explicit approved change.

## Phase 5 — Palettes and small UI (P1)

- [x] Add the five exact requested preset backgrounds, a small optional preset library, and validated custom colors.
- [x] Apply scoped palette variables to every note according to its notebook folder; ensure readable text and distinct external links in dark/light themes.
- [x] Add accessible swatches to fuzzy results without losing native matching/highlighting or keyboard behavior.
- [x] Add an optional clickable desktop status item; retain a complete command-only workflow.
- [x] Implement the E3-proven native badge, or document the reduced project text/emoji alternative.
- [x] Remove owned style markers on disable, unload, and leaf repurposing outside notebooks; Home keeps reference notes colored.
- [x] Keep explorer folder decoration deferred unless a verified public hook becomes available.

Acceptance: PFAS background is exactly `#2d4841`; dialogs/menus retain the user's theme; Home uses a neutral main indicator and native planner styling. Every project remains identifiable without relying solely on color. Exact-color Kanban support is reported honestly.

## Phase 6 — Reliability, performance, release (P0 before release)

- [x] Run the complete twelve-step user journey and record pass/fail/deviation for every step.
- [ ] Cover existing projects, missing files, malformed settings/Base YAML, case variants, external renames, project-root changes, read-only/write failures, and custom statuses.
- [ ] Stress rapid switches, open-in-two-panes logs, edits during switching, midnight, unload during pending work, and startup restoration.
- [ ] Test default light/dark plus at least one community theme; test desktop layouts and decide mobile support based on observed behavior.
- [ ] Test coexistence with Workspaces Plus, Templater, and navigator plugins without depending on them.
- [ ] Instrument a large test vault: record startup/switch timings and relevant file operations; confirm no vault enumeration on opens, no polling, and no log content reads at startup except the active restored log.
- [ ] Confirm warm switching does not grow leaves/listeners, write unchanged headings, rewrite Base configuration, or persist settings unnecessarily.
- [ ] Verify commands/listeners/render children/styles are cleaned up; make cleanup best effort without relying on a shutdown event.
- [x] Run typecheck, lint, formatting check, unit tests, and production build; document manual integration checks separately.
- [x] Write install/setup, Bases version requirement, layout consent, customized-Base onboarding, rename repair, limitations, and optional migration guidance.
- [x] Confirm production vaults were not used for destructive or exploratory tests.

Release acceptance: the documented supported workflow matches actual test-vault results. No unapproved file replacement, unrelated pane closure, private API reliance, or silent acceptance downgrade remains. Deferred work stays out of the release scope.

## Added workflow requirements (implemented preview)

- [x] Colored main-notebook status pill, independent per-file notebook palettes, and explicit Set main notebook command.
- [x] Reference-note navigation preserves main context, note/task destination, and Log fallback.
- [x] Separate Restore project layout and Open Home commands, unassigned hotkeys.
- [x] Independent per-project and global homepage/Kanban toggles, verified in native Obsidian.
- [x] Create-only plain Markdown homepage templates with safe token substitution.
- [x] Scratch creation, explicit previewed recoverable trash, no automatic expiry.
- [x] Previewed combine into a target subfolder; task reassignment, separate logs, collision/race checks and guarded rollback.
- [x] Previewed archive to a separate root, active-board exclusion, preference migration and manual restore.
- [x] GitHub Report Issue command targets gettodaze/subject-notebook without automatically submitting content.
- [x] Agent documentation moved to docs_agent and linked from README.

Acceptance: native-host tests demonstrate independent green-reference/teal-main colors, task destination, fallback, all optional pane combinations, template preservation, scratch combine, archive/restore and vault-local trash. Broader platform, theme and failure-stress work above remains a release gate.
