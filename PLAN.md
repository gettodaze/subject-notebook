# Subject Notebook — implementation plan

Planning baseline: 2026-10-26. Display name: **Subject Notebook**. Plugin ID: **`subject-notebook`**. Description: “Easily create, manage, and switch between projects.” This replaces the earlier Colored Folders name throughout the proposed plugin.

## Repository findings and scope

The repository has no tracked application files, package manifest, dependencies, local Obsidian declarations, or commits. There is no implementation to preserve or test. The user-supplied AGENTS.md instructions govern future code; project-specific preferences are recorded in [AGENTS_updated.md](AGENTS_updated.md).

This change creates planning documents only. No plugin, dependency installation, test vault, or production-vault changes are included. API declarations were inspected remotely in the official repository. Documentation verification is not a runtime compatibility test.

## Recommended MVP

Build a keyboard-first project switcher, project/log/task creation, scoped editor palettes, and a native Bases planner. Require Obsidian 1.14+ with Bases enabled for the complete workflow. Do not require community plugins. Confirm the exact minimum patch version during development rather than claiming every 1.14 build has been tested.

Use one `Projects/Tasks.base`, with an All Projects view and named project views. The bottom pane should host an embed of the selected native view. Do not build a task renderer, drag engine, workspace manager, or template system. Native Kanban and property-changing drag operations are documented for 1.14+. ([Kanban documentation](https://obsidian.md/help/bases/views/kanban))

Three integration experiments must precede implementation of the full workflow: interactive named-view embedding in a plugin pane, nested split construction without disturbing unrelated tabs, and a native color-badge formula on Kanban cards. See [FEASIBILITY.md](FEASIBILITY.md). These are release gates, not verified promises.

The smallest useful fallback is project switching with log/homepage, task commands, and a native planner with project names visible. A release using that fallback must explicitly describe any unmet color or layout criteria; it must not claim the entire requested journey passes.

## Files and modules

Proposed repository structure; create modules when their phase needs them:

```text
manifest.json                 # subject-notebook; tested minAppVersion
package.json                  # build, typecheck, lint, format, test scripts
package-lock.json
tsconfig.json                 # strict; noUncheckedIndexedAccess
esbuild.config.mjs
styles.css
versions.json
src/
  main.ts                     # lifecycle and dependency wiring only
  settings/
    model.ts                  # settings types, defaults, validation
    persistence.ts            # load/validate/migrate/save
    settings-tab.ts           # native controls, discovered project rows
  projects/
    model.ts                  # Project and context types
    paths.ts                  # normalization and name validation
    discovery.ts              # immediate children + vault events
    files.ts                  # create missing folder/log/homepage
  logs/
    daily-section.ts          # pure heading detection and append transform
    log-service.ts            # editor updates and per-file serialization
  workspace/
    switch-project.ts         # serialized context transitions
    project-layout.ts         # managed leaves and split construction
    log-fallback.ts           # guarded empty-editor behavior
  tasks/
    model.ts                  # statuses and property keys
    task-files.ts             # create notes with task properties
    base-config.ts            # validate/generate/preview safe view additions
    planner-view.ts           # native Base embed host, no custom task UI
  themes/
    palettes.ts               # preset data and custom-color validation
    project-styles.ts         # scoped markers and cleanup
  ui/
    commands.ts               # seven explicit commands
    project-switcher.ts       # FuzzySuggestModal
    name-modal.ts             # shared simple filename input
    status-bar.ts
test/
  projects.test.ts
  daily-section.test.ts
  switch-project.test.ts
  base-config.test.ts
  settings.test.ts
  manual-acceptance.md
```

Keep meaningful literals in their owning module: filenames and default directory in project paths; statuses/property keys in task model; command IDs in commands; CSS names in theme/UI constants. Import constants through namespaces, such as `import * as taskModel from "./tasks/model"`. Avoid an unrelated global constants collection.

Use TypeScript, Obsidian's UI, esbuild, and a small test runner. No React or production dependencies beyond the host API are planned. Use Obsidian YAML helpers for generated data, with runtime validation at parsing boundaries. Do not round-trip user YAML just to add a view if that would discard comments or unknown content.

Proposed vault files:

```text
Projects/
  Tasks.base
  PFAS/
    Log.md
    PFAS.md
    Test QE Pipeline.md        # task or ordinary note, as appropriate
.obsidian/plugins/subject-notebook/
  manifest.json
  main.js
  styles.css
  data.json                   # preferences only; no task database
```

No project registry, daily-log index, duplicate task store, or workspace definitions are needed. Runtime context and managed-leaf references are not persisted as project configuration.

## Core data types

Design sketches only, not plugin implementation:

```typescript
type TaskStatus = "Backlog" | "Soon" | "Today" | "Now" | "Done";
type LocalDate = string; // validated YYYY-MM-DD from local calendar fields
type ProjectPath = string; // normalized vault-relative path, validated at boundary

interface Project {
  readonly name: string;
  readonly folderPath: ProjectPath;
  readonly logPath: string;
  readonly homepagePath: string;
}

type ProjectContext =
  | { readonly kind: "home" }
  | { readonly kind: "project"; readonly folderPath: ProjectPath };

interface PaletteColors {
  readonly background: string;
  readonly text: string;
  readonly heading: string;
  readonly internalLink: string;
  readonly externalLink: string;
  readonly selection: string;
  readonly accent: string;
}

type PaletteAssignment =
  | { readonly kind: "preset"; readonly presetId: string }
  | { readonly kind: "custom"; readonly colors: PaletteColors };

interface SubjectNotebookSettings {
  readonly schemaVersion: number;
  readonly projectsDir: string;
  readonly defaultTaskStatus: TaskStatus;
  readonly palettesByProjectPath: Readonly<Record<string, PaletteAssignment>>;
  readonly automaticDailyHeadings: boolean;
  readonly projectStyling: boolean;
  readonly showStatusBar: boolean;
  readonly homeLandingNote: string | null;
}
```

In code, derive the status type from a single ordered constant tuple. Define preset IDs as a closed union from palette data. Settings load as `unknown`, then validate fields and apply defaults. Do not trust a TypeScript cast to validate stored JSON.

Pass the vault, workspace, settings access, and clock into the services that need them. Use a function taking a local date to generate a daily section; a future template provider can replace that function without changing file/event coordination. No Templater integration in v1.

## Components and behavior

### Lifecycle and settings

Load and validate settings, register commands/view/settings UI, then defer discovery and restored-view inspection until layout readiness. Never switch projects or build panes automatically during startup. Register events through plugin lifecycle helpers; invalidate pending operations and remove owned styling on unload. The official sample demonstrates settings persistence, commands, UI registration, and cleanup patterns. ([Sample entry point](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/src/main.ts), [sample settings](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/src/settings.ts))

Use defaults: `Projects`, Backlog, daily headings enabled, styling enabled, status indicator enabled on desktop, no Home landing note, and no stored project list. Known project names resolve to the requested preset unless explicitly assigned otherwise. The settings tab lists discovered folders rather than requiring duplicate project configuration.

Changing the projects directory changes discovery scope; it does not move existing files, rewrite task properties, or migrate an existing Base silently. Show missing/invalid-directory errors with a setup action. Create the directory on explicit project creation, not at import or plugin load.

### Discovery and safe creation

Resolve the configured directory directly and inspect its immediate folder children only. Subscribe to create/delete/rename events and update that small list when affected. Ordinary file opens require path checks, not discovery or content scans. Direct path lookup is recommended by the official guidelines. ([Plugin guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md))

Use normalized paths as identity. Reject empty/whitespace names, traversal, separators, control characters, cross-platform invalid/reserved filenames, and trailing dots/spaces. Validate the resulting path stays immediately beneath ProjectsDir. Reject case-insensitive creation collisions and Unicode-normalization collisions. Discover pre-existing case variants separately with full paths and a warning; do not merge their data or palettes. On case-insensitive storage, fail safely if paths cannot be distinguished.

Reject `Log` as a new project name because `Log.md` would also be its homepage. Existing `Log` folders remain discoverable, but show that both roles share a file and require manual resolution for two distinct notes.

Project creation is an idempotent sequence of create-if-missing operations. Existing folders are adopted; existing notes are never replaced. Missing files are repaired only on explicit creation/open/switch actions. Handle concurrent-create errors by re-resolving and checking the expected file/folder type. Keep partial results on failure and allow retry; never “roll back” by deleting user files.

When an external project rename occurs, update discovery, runtime context, and path-keyed palette settings. Do not automatically rename its old homepage, edit all task `project` values, or rewrite Base views. Report the stale references and offer a previewed repair. A missing new-name homepage can be created on request while preserving the old one. Delete/move-out clears invalid active context to Home without forcing navigation.

### Logs and daily sections

Only inspect an exact immediate-project `Log.md` when it is opened, explicitly requested, or restored as the active file after layout readiness. Treat active-leaf changes as an additional trigger for the same log in another pane. Repeated layout events must not keep moving the cursor while the user types.

For each log, serialize pending work. Resolve the current file and target editor again inside the queued operation. Compute today's date from local calendar fields at execution time; never use UTC slicing or file modification time. A day change is handled on the next open/activation, with no midnight timer.

Check exact H2 date lines in the current content, ignoring frontmatter and fenced code examples. Support LF and CRLF without treating `###`, extra text, or a different date as a match. Append only the missing section, inserting the newline separation needed before `## YYYY-MM-DD` and leaving a blank line afterward. Preserve existing text and newline style.

For an editable open log, inspect the live buffer and append through an editor transaction/range insertion. Do not replace the full buffer. For a background/reading-view log, read current content first and return without a write if the heading exists; otherwise use an atomic read/transform/write and recheck the heading inside that transform. Do not assume returning unchanged content from an atomic transform guarantees no disk write. Do not mix a stale vault read with an editor update. Official guidance favors the editor for active content and atomic processing for background changes. ([API-use checklist](https://docs.obsidian.md/oo/plugin))

The serialization guard is per file, not per pane. Two panes must not independently append to the same document. Verify shared-buffer propagation and pending-save interactions in the test vault; if a background path sees another editable pane, route through that buffer instead. Never promise cross-device atomicity: a local queue cannot prevent a remote sync conflict.

After completion, use the target editor's current EOF for cursor placement and scrolling. Focus only the log opened by the switch or the user's active log, and cancel stale focus work if the user navigated elsewhere. Automatic log opens in Reading view preserve that mode; commands that promise a cursor open the log in editing mode. Reading view has no editor cursor, so that case gets a heading but no forced mode change.

### Workspace switching

Create one managed set of three leaves in the main workspace. Build top/bottom first, then split the top into left/right. Treat the familiar T-shaped layout as a supported-API composition requiring runtime confirmation; do not edit split child arrays or serialized workspace JSON. Obsidian documents nested split and tab concepts. ([Workspace guide](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Workspace.md))

The switch command authorizes replacing the contents of managed project panes. It does not authorize closing unrelated notes. On first use in an occupied workspace, offer an explicit choice between arranging the current area and retaining existing tabs alongside a new project area. Explain that a preserved occupied workspace may prevent the project area from filling the entire window. Never silently close leaves to achieve a screenshot.

Reuse intact managed leaves. Track expected view/file as well as leaf references: a user opening an unrelated document in a managed leaf makes it unsafe to replace automatically. If the topology or contents have been customized, show a concrete restore-layout choice on the next switch, with a preserve-layout option. Normal navigation never triggers layout restoration. Do not promise arbitrary exact layout restoration and automatic preservation of every customization simultaneously.

Serialize switches with one pending latest request. After every awaited step, reject superseded requests before further UI effects. Preflight project paths and planner availability, prepare missing files, open the three roles, ensure the log heading, then commit context/styles and focus EOF. No overlapping layout mutation. On failure, leave notes intact, retain a usable log, explain planner failure, and keep the context indicator honest. Do not restore an old full-workspace snapshot over newer user actions.

Home removes all project overrides from managed surfaces and displays All Projects in the planner. If a landing note is configured, open it without replacing unrelated user content. Otherwise leave existing notes available and focus the planner; never manufacture `Home.md`. The switcher and optional clickable status item remain available.

Implement log fallback conservatively: after a coalesced layout change, restore only into an existing empty managed main-editor leaf when an active project previously had a note there and no other project Markdown file remains open in main editor leaves. Exclude sidebars, embeds, and popouts. Do nothing during switching, startup, unload, or when the focused view is a nonempty tool/other note. Recheck immediately before opening and use a reentrancy guard. If the managed region was closed entirely, respect closure; use Open project log instead of recreating panes.

### Shared planner and task creation

Use global Base filters for Markdown tasks beneath ProjectsDir and view filters for the exact `project` property. Group on the editable `note.status` property, not a formula. Display filename and project; order groups Backlog, Soon, Today, Now, Done. Empty groups and manual ordering are documented. ([Views](https://obsidian.md/help/bases/views))

Use named views rather than changing global filters on each switch. Named embeds are documented, whereas an external runtime filter setter is not established. ([Embedding a Base](https://obsidian.md/help/bases/create-base))

Create `Tasks.base` only if absent, initially with All Projects and views for discovered projects. For later projects, prepare a view addition and request explicit approval before changing existing configuration. Validate current content inside the final atomic operation and abort/re-preview if it changed. Do not reserialize an entire customized file. Prefer a validated append to an unambiguous block-style `views` sequence; for flow-style YAML or ambiguous content, show a manual paste-ready fragment. Preserve comments, unknown keys, existing filters, and view order. No Base writes during ordinary switching.

The planner pane is a thin native-embed host, not a custom Bases view. If host embedding fails the experiment, use a user-approved ordinary Markdown planner note containing the same named embed and open it in Reading view. This introduces a wrapper note, not another database. Do not assume undocumented native view-state keys select a named view.

New note/task commands operate only in the explicitly active project. In Home, prompt for a project. New ordinary notes have no imposed schema. For a new task, create the file with safely serialized frontmatter in its initial content so it enters Bases complete: `type: task`, project name, configured status (Backlog by default). Use the official frontmatter operation for later property edits. Cancel on collision; never append to an existing note with the requested title. Leave native new-note commands untouched.

### Color and UI

Preset backgrounds are fixed:

| Default project | Preset | Background |
| --- | --- | --- |
| PFAS | Forest Teal | `#2d4841` |
| QMatrix | Golden Brown | `#372700` |
| ItR | Burgundy | `#380a2d` |
| Geomamba | Deep Ocean Blue | `#072d3d` |
| Lisa | Forest Green | `#062711` |

Add only a few optional presets (lavender, slate, navy, gray). Validate custom hex values. Provide readable foreground/link/heading/selection combinations for these dark backgrounds even under a light theme. Check text contrast at least 4.5:1 for ordinary text; use more than color alone to distinguish links and projects. External links should retain a distinct hue and underline.

Apply a plugin class/data attribute and CSS variables through public view containers, scoped to project Markdown panes and the planner host. Do not put project variables on `body`, change the selected theme, or recolor menus/settings. Remove markers when leaves are repurposed, Home opens, styling is disabled, or the plugin unloads. CSS variables and plugin stylesheets are documented extension mechanisms. ([Styling](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling), [HTML elements](https://docs.obsidian.md/Plugins/User%20interface/HTML%20elements))

Use native fuzzy suggestions with a swatch and project name; include Home, keyboard navigation, and Enter selection. Status-bar support is optional and desktop-specific. Native modal customization avoids a separate UI framework. ([Modals](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Modals.md))

Native explorer folder decorations and native Kanban card borders lack verified public extension hooks. Defer explorer coloring. For cards, prototype a displayed project badge using documented Base formula rendering; retain plain project text as the dependable fallback. Exact palette-colored native cards remain conditional. See the feasibility assessment before promising acceptance step 10.

## Relevant API inventory

Verified in the official declarations at research time:

| Area | Public API surface |
| --- | --- |
| Lifecycle | `Plugin.onload`, `onunload`, `loadData`, `saveData`, `registerEvent`, `registerDomEvent` |
| Discovery/files | `Vault.getAbstractFileByPath`, `TFolder.children`, `Vault.create`, `createFolder`, `process`; create/delete/rename events |
| Frontmatter | `FileManager.processFrontMatter` |
| Workspace | `onLayoutReady`, `getLeaf`, `createLeafBySplit`, `setActiveLeaf`; file-open, active-leaf-change, layout-change events |
| Leaves | `WorkspaceLeaf.openFile`, `setViewState`, `getViewState`, `loadIfDeferred` |
| Editors | `MarkdownView.editor`, `Editor.getValue`, `lastLine`, `getLine`, `replaceRange`, `setCursor`, `scrollIntoView`, `focus` |
| UI/planner | `addCommand`, `PluginSettingTab`, `Setting`, `FuzzySuggestModal`, `addStatusBarItem`, `ItemView`, `registerView`, `MarkdownRenderer.render`, `Component` |

`getLayout`/`changeLayout` are public, but serialized layout details are not a typed construction contract. `QueryController` exposes no declared external filter setter. Custom Bases view registration is public; it does not expose a native card decorator. ([Official TypeScript declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts))

## Roadmap and validation

0. **Resolve integration risks:** verify the three experiments in a disposable vault and pin actual host/API versions.
1. **Foundation:** skeleton, strict tooling, validated settings, discovery, safe project creation, plain Base creation.
2. **Notebook:** log idempotency and explicit note/task/log/homepage commands.
3. **Switching:** managed pane construction, serialized switches, Home, conservative fallback.
4. **Planner:** named native views, safe configuration onboarding, full drag workflow.
5. **Identity:** palettes, swatches, small status UI, proven badge alternative.
6. **Release:** safety/race/performance tests, theme/platform checks, documentation and migration guidance.

Automate pure path/name/date/heading/config transformations and controlled event/switch races. Use meaningful service fakes; mocked Obsidian methods cannot prove pane geometry or native Kanban integration. Run strict typecheck, ESLint, formatting check, unit tests, and production build once introduced. Perform the complete twelve-step journey manually in a separate test vault, recording exact versions and deviations. Detailed completion gates are in [TODO.md](TODO.md).
