# Subject Notebook — prioritized implementation checklist

This is future work. No plugin code has been implemented. Follow [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), and the gates in [FEASIBILITY.md](FEASIBILITY.md). Use a separate disposable test vault throughout.

## Phase 0 — Resolve API integration risks (P0)

- [ ] Record actual desktop Obsidian version, API package version, and official source revision; pin development dependencies and choose the minimum supported patch.
- [ ] Run E1: named native Base embedding, two simultaneous views, task drag, cleanup, disabled/missing Bases.
- [ ] Run E2: nested managed panes, occupied workspaces, unrelated/pinned tabs, rapid switches, user customization, Workspaces Plus coexistence.
- [ ] Run E3: native project text and safe formula badge; determine whether exact project colors survive rendering.
- [ ] Document outcomes and select documented fallbacks before expanding implementation.

Acceptance: integration evidence names versions and observed behavior. Any reduced acceptance criterion is explicit. No private API, native-DOM selectors, or unverified leaf-state keys are introduced to make a test appear to pass.

## Phase 1 — Skeleton, settings, projects (P0)

- [ ] Scaffold the official plugin build pattern using Subject Notebook / `subject-notebook`, strict TypeScript, lint/format/typecheck/test/build scripts, and a lockfile.
- [ ] Keep entry-point lifecycle wiring small; add precise types, namespace constant imports, and no module-scope side effects.
- [ ] Validate stored settings as unknown input; define defaults and schema migration behavior.
- [ ] Build native settings controls for directory, status default, palettes, headings, styling, status item, optional Home note.
- [ ] Discover immediate project folders after layout readiness; update on relevant vault events.
- [ ] Validate names/paths, case and Unicode collisions, reserved names, and the project-name `Log` collision.
- [ ] Create/adopt projects and repair missing required files without replacing content; create Tasks.base only when absent.
- [ ] Surface failed/partial operations and support safe retry; never delete files on rollback.
- [ ] Handle externally renamed/deleted folders and invalid active context; preview repair of stale task/view references.

Acceptance: PFAS creation produces the specified three project paths and one Base. Repeating it preserves every existing byte. Existing projects appear without configuration. Unrelated folders are ignored. Startup does not read logs, create files, or rearrange panes.

## Phase 2 — Notebook automation and creation commands (P0)

- [ ] Implement pure local-date and daily-section logic with a replaceable section-generation function.
- [ ] Check exact real H2 date headings, ignoring frontmatter/fenced examples; preserve newline style and existing content.
- [ ] Serialize log operations by file, inspect live editable buffers, and use atomic processing only for appropriate background updates.
- [ ] Connect file-open/active-leaf events with cheap path checks and cancellation of stale focus work.
- [ ] Position the requested editable log at current EOF and scroll into view. Preserve ordinary Reading view navigation.
- [ ] Add New project note/task and Open project log/homepage commands with context checks and Home project selection.
- [ ] Create initial task frontmatter safely with configured status; keep ordinary notes schema-free.
- [ ] Test LF/CRLF, empty file, no final newline, edited-today/no-heading, two panes, unsaved edits, rapid events, and midnight changes.

Acceptance: ten rapid log activations append one heading for the local day, preserve unsaved text and undo behavior, and do not repeatedly move the cursor while typing. Task title collisions preserve the existing note. Native new-note behavior remains unchanged.

## Phase 3 — Project switching and Home (P0)

- [ ] Add Switch project and Open Home, initially using a native searchable modal.
- [ ] Implement one active switch with one latest pending request; check cancellation after every asynchronous step.
- [ ] Build/reuse managed leaves using the E2-approved public API sequence.
- [ ] Offer a concrete first-use layout choice in occupied workspaces and restore/preserve choices after user customization.
- [ ] Open log top-left, homepage top-right, planner below; commit context and focus only after the winning request succeeds.
- [ ] Define partial planner/file failure recovery without closing unrelated notes or replaying stale whole-workspace snapshots.
- [ ] Home selects All Projects, clears project styles, and respects optional landing-note settings.
- [ ] Implement conservative empty-editor log fallback with startup/switch/unload/reentrancy guards.
- [ ] Invalidate pending work on unload; do not rebuild restored layouts automatically on startup.

Acceptance: repeated PFAS → ItR → Home → PFAS ends in the correct context with bounded leaves and final Log EOF focus. Extra notes remain usable. Closing the whole project area stays closed. Ordinary navigation does not restore geometry or steal focus.

## Phase 4 — Native shared planner (P0)

- [ ] Generate valid initial Base filters, editable status grouping, exact five-column order, and All Projects/named project views.
- [ ] Escape expression literals separately from YAML serialization; cover quoted and non-ASCII project names.
- [ ] Implement the E1-approved embed host with child-component cleanup; use the documented wrapper-note fallback only if needed.
- [ ] Detect missing/invalid views and configuration; never show an unfiltered board labeled as project-filtered.
- [ ] Add previewed existing-Base view additions with validation, collision handling, and concurrent-change abort/re-preview.
- [ ] Preserve comments, custom views, unknown keys, and filters; offer a manual fragment for unsupported YAML layouts.
- [ ] Explain that unknown statuses are hidden by the fixed group list and remain in their task notes.
- [ ] Show a useful planner fallback for missing/disabled Bases while keeping note/task commands usable.
- [ ] Verify one task in PFAS appears once in PFAS and All Projects; drag Backlog → Today and inspect the same Markdown file.

Acceptance: native drag changes only the intended property while preserving body content. Empty columns stay visible. Two planner instances remain independent. Switching and ordinary opens cause zero Base writes. An existing customized Base stays byte-identical until an explicit approved change.

## Phase 5 — Palettes and small UI (P1)

- [ ] Add the five exact requested preset backgrounds, a small optional preset library, and validated custom colors.
- [ ] Apply scoped palette variables to managed project content; ensure readable text and distinct external links in dark/light themes.
- [ ] Add accessible swatches to fuzzy results without losing native matching/highlighting or keyboard behavior.
- [ ] Add an optional clickable desktop status item; retain a complete command-only workflow.
- [ ] Implement the E3-proven native badge, or document the reduced project text/emoji alternative.
- [ ] Remove all owned style markers on Home, disable, unload, and leaf repurposing.
- [ ] Keep explorer folder decoration deferred unless a verified public hook becomes available.

Acceptance: PFAS background is exactly `#2d4841`; dialogs/menus retain the user's theme; Home restores normal styling. Every project remains identifiable without relying solely on color. Exact-color Kanban support is reported honestly.

## Phase 6 — Reliability, performance, release (P0 before release)

- [ ] Run the complete twelve-step user journey and record pass/fail/deviation for every step.
- [ ] Cover existing projects, missing files, malformed settings/Base YAML, case variants, external renames, project-root changes, read-only/write failures, and custom statuses.
- [ ] Stress rapid switches, open-in-two-panes logs, edits during switching, midnight, unload during pending work, and startup restoration.
- [ ] Test default light/dark plus at least one community theme; test desktop layouts and decide mobile support based on observed behavior.
- [ ] Test coexistence with Workspaces Plus, Templater, and navigator plugins without depending on them.
- [ ] Instrument a large test vault: record startup/switch timings and relevant file operations; confirm no vault enumeration on opens, no polling, and no log content reads at startup except the active restored log.
- [ ] Confirm warm switching does not grow leaves/listeners, write unchanged headings, rewrite Base configuration, or persist settings unnecessarily.
- [ ] Verify commands/listeners/render children/styles are cleaned up; make cleanup best effort without relying on a shutdown event.
- [ ] Run typecheck, lint, formatting check, unit tests, and production build; document manual integration checks separately.
- [ ] Write install/setup, Bases version requirement, layout consent, customized-Base onboarding, rename repair, limitations, and optional migration guidance.
- [ ] Confirm production vaults were not used for destructive or exploratory tests.

Release acceptance: the documented supported workflow matches actual test-vault results. No unapproved file replacement, unrelated pane closure, private API reliance, or silent acceptance downgrade remains. Deferred work stays out of the release scope.
