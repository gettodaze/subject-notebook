# Subject Notebook — validation record

Agent-authored, 2026-10-26. This record distinguishes automated checks from native-host experiments and remaining release work.

## Environment

- Desktop Obsidian 1.14.5, installed at `/opt/Obsidian/obsidian`.
- Obsidian API declarations pinned to npm `obsidian@1.14.4`; exact dependency artifacts/integrities are recorded in `package-lock.json`.
- Node.js 18.19.1, npm 9.2.0; strict TypeScript 5.7.3.
- Separate vault: `/tmp/subject-notebook-validation/subject-notebook-test-vault`.
- Separate profile: `/tmp/subject-notebook-obsidian-profile`; debugging bound to localhost port 9227.
- No production vault was used. The earlier exploratory vault at `/tmp/subject-notebook-test-vault` is separate from the clean validation vault.

## Integration findings

Early experiments confirmed that the public split API constructs the requested T-shaped region and that a public Markdown-renderer host displays an interactive named native Base embed. Dragging a native card updates task frontmatter. Two simultaneous native views can select different filters without changing each other's selection.

The native `html()` formula renders a fixed, palette-colored project swatch and escaped project text on Kanban cards. This is the selected implementation. There is no native-card decorator, custom board renderer, or mutation observer in the plugin.

The exploratory tests exposed a directory-parent bug and a light-theme planner contrast problem. Project colors now scope to Markdown panes; the planner retains the native theme and colored badges. A contrast assertion checks native board headings in the host test. The test driver also waits for native autosave and uses a viewport wide enough for the drag source and target to stay mounted during native column virtualization. Task creation leaves the current editor in place rather than opening a task automatically; persisted status is checked after subsequent switches.

## Automated checks

The suite covers exact daily headings, local dates/midnight, fences/frontmatter, LF/CRLF, concurrent log opens, live-buffer updates, no-op background processing, unload guards, name/path validation, case collisions, safe missing-file repair, immediate-child discovery, settings validation, independent defaults, palette handling, YAML escaping, view conflicts, preview invalidation, lossless configuration insertion, managed formula protection, file queues, and latest-request switching.

`npm run check` passed: strict type checking, ESLint, Prettier, **45 passing unit tests**, and the production build. `npm run package` produced the three installable files in `dist/subject-notebook/`. `npm audit --audit-level=low` reported **0 vulnerabilities** for the locked dependency tree.

Native host checks passed in desktop Obsidian 1.14.5:

- Core journey: PFAS creation/repair, exact Forest Teal palette, T-shaped layout, Log EOF, one local daily heading, task creation, native drag to Today, same task and exact swatch in global Home, switch-back, unchanged Base bytes, and no duplicated heading. PFAS’s palette is assigned by the preset default; settings overrides have unit coverage.
- Project isolation: ItR filtering, two simultaneous native Base view selections, reload/startup context restoration, and bounded leaves through subsequent switches.
- Report Issue: the repository’s exact new-issue URL was intercepted and verified; no issue was submitted.
- Optional features: all four project homepage/Kanban combinations, independent global Home toggles, create-only project/Home templates, and unchanged existing homepage content.
- Lifecycle: scratch combine into PFAS, preserved separate Logs/status/body and task visibility; archive exclusion and restoration by moving the folder back; scratch removal into recoverable vault-local trash.
- Notebook identity: a green Lisa reference remains green while main PFAS retains its teal status pill; new tasks target PFAS; an empty managed primary editor returns to PFAS Log; explicit Set main notebook changes context and Restore opens that notebook’s layout.
- Native board heading contrast measured **15.24:1** in the tested default light theme after keeping native planner styling separate from colored Markdown.

The first lifecycle run exercised combine end to end. Reruns preserve that moved fixture and report it as skipped; archive/restore and trash run again. The disposable vault intentionally retains test notes between runs.

The suite uses public product APIs. Browser test drivers use native UI selectors and test-only application inspection to observe actual host behavior; these are not production API dependencies. See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for the separate source/history/package secret scans.

## Reproducing native-host checks

Prepare only the disposable vault above, copy the built plugin files into its `.obsidian/plugins/subject-notebook/`, enable the plugin and Bases there, and launch with an isolated profile:

```sh
/opt/Obsidian/obsidian --no-sandbox \
  --user-data-dir=/tmp/subject-notebook-obsidian-profile \
  --remote-debugging-port=9227 --remote-debugging-address=127.0.0.1 \
  --disable-gpu --ozone-platform=x11
npm run test:host
node scripts/host-features.mjs
node scripts/host-notebooks.mjs
```

`--no-sandbox` is specific to this isolated development environment and is not a user installation requirement. The driver validates the exact disposable vault path before any action. It creates test projects/tasks, exercises UI commands and native dragging, and can reload the test window. Screenshots are written to `/tmp/subject-notebook-project.png`.

## Known limits / remaining release work

- The minimum manifest version is 1.14.5, matching the tested host. Native Kanban itself is documented for the 1.14 family; earlier patches have not been tested here.
- Explorer folder coloring has no verified public hook and is deferred. Switcher swatches and native task badges provide project identity.
- Arbitrary customized pane layouts require a deliberate layout choice. Normal navigation does not force them back. The conservative Log fallback only uses an existing empty managed editor and respects closing the entire project area.
- Existing complex/custom YAML receives a manual configuration fragment; user edits are never silently regenerated.
- Palette changes require an approved Base badge update; cards remain useful with their previous colors until then.
- External renames require manual reconciliation of task properties, homepage names, and views. No bulk repair tool is included yet.
- Disabled Bases behavior, multiple desktop platforms, community-theme compatibility, Workspaces Plus coexistence, shutdown under I/O failures, and large-vault timings require broader release validation. Mobile is not advertised.
- Local queues and atomic processing do not guarantee cross-device exactly-once writes under sync conflicts.
