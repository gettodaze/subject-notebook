# Subject Notebook — architectural decisions

Status: proposed implementation baseline, researched 2026-10-26. No plugin implementation is included. [PLAN.md](PLAN.md) defines behavior; [FEASIBILITY.md](FEASIBILITY.md) distinguishes verified capabilities from integration hypotheses.

## 1. Native workspace operations; no Workspaces Plus dependency

Use native leaf creation/opening and nested splits. Keep a single managed project area, reused across project switches. Native split concepts are documented in the [workspace guide](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Workspace.md).

Do not generate arbitrary full-workspace JSON, manipulate split children, or load Workspaces Plus definitions. Capturing and replaying a whole workspace can close unrelated tabs and restore stale user state. It also expands this plugin into workspace management.

The command restores canonical contents only in unmodified managed panes. If users change the panes, the next switch offers a concrete restore-or-preserve choice. Existing unrelated tabs remain available. First-use setup in a busy workspace requires an explicit arrangement choice; subsequent unmodified switches remain one command. Exact proportions and a window-filling T layout are runtime gates, not guaranteed by TypeScript signatures.

Coexist with Workspaces Plus. Never disable it or delete its settings. After another plugin changes the layout, discard stale managed references and require deliberate re-establishment. Migration is user-driven: try Subject Notebook, then independently retire the old workflow if desired.

## 2. Native Bases Kanban; no custom board in v1

Require the native implementation available in Obsidian 1.14+. It supplies task-note rendering and property-updating drag operations, avoiding a second task model and a custom interaction engine. ([Native Kanban](https://obsidian.md/help/bases/views/kanban))

A plugin `ItemView` may host a native embed; that is not a custom Kanban renderer. A custom Bases view is a documented future extension, but it would require implementing columns, editing, dragging, accessibility, performance, and cleanup. Do not use it merely to obtain card colors. ([Custom Bases view guide](https://docs.obsidian.md/plugins/guides/bases-view))

When Bases is disabled or unavailable, keep project/log/note/task commands working and show a compact planner explanation with an enable/update instruction. Do not access private core-plugin registries to toggle it. Capability checks and useful failure UI must be tested; no supported programmatic enablement is assumed.

## 3. Choose A: one Base with named project views

| Choice | Strength | Cost/risk |
| --- | --- | --- |
| A: All Projects plus project views | Persistent, inspectable filters; documented named embeds; independent panes | One small view definition per project; explicit additions to existing files |
| B: filter a native view dynamically | Would avoid per-project configuration | No verified public external setter; persisted filters could affect other panes; private state would be brittle |

Choose A. Every view queries the same task notes. No duplicate database and no task duplication are involved. Create all known views when first creating a missing Base. Later project creation presents any needed Base-view addition for explicit approval; users can also add the view themselves. Switching only selects a named embed and never rewrites filters.

The documented syntax supports both shared and view-level filters. Named-view embeds select a view without changing the default view for every consumer. ([Base syntax](https://obsidian.md/help/bases/syntax), [named embeds](https://obsidian.md/help/bases/create-base))

Prototype concept, not a generated file in this change:

```yaml
filters:
  and:
    - 'file.ext == "md"'
    - 'file.inFolder("Projects")'
    - 'note.type == "task"'
views:
  - type: kanban
    name: All Projects
    groupBy:
      property: note.status
      direction: ASC
    groupOrder: [Backlog, Soon, Today, Now, Done]
    order: [file.name, note.project]
  - type: kanban
    name: PFAS
    filters:
      and:
        - 'note.project == "PFAS"'
    groupBy:
      property: note.status
      direction: ASC
    groupOrder: [Backlog, Soon, Today, Now, Done]
    order: [file.name, note.project]
```

Expressions must encode project/directory names as string literals independently from YAML serialization. Never concatenate unescaped user input. Validate arbitrary existing YAML; handle non-object roots, duplicate view names, missing views, and malformed files without a write.

Keep all five intended groups explicitly listed. This deliberately hides unknown/missing status values in the generated views; explain that in setup and show invalid-status tasks through a user-selected table view or manual inspection. Do not silently normalize task properties. A future validation view can be added explicitly if needed, without inventing placeholder tasks to keep columns visible.

## 4. Preserve Base customizations with explicit configuration edits

Creating an absent `Tasks.base` is authorized by project creation. Its existence is never permission to regenerate it. Existing files are user-owned even if initially generated by this plugin.

Before any later edit, show the path and exact proposed addition. Preserve existing views, comments, unknown keys, filters, and formatting. For a simple validated block-style views sequence, an isolated insertion can preserve surrounding bytes. For complex YAML, provide a manual fragment rather than introducing a YAML document editor dependency. Revalidate the full result and current content during the atomic commit; a concurrent edit invalidates approval of the old proposal and requires a new preview.

If approval is declined, project files and log navigation still work. Show that automatic project-planner selection needs setup; do not pretend the All Projects board is project-filtered. A view-name conflict is a setup error, not permission to replace the conflicting view.

## 5. Color supported surfaces first

Use exact preset backgrounds for project editors, and exact swatches in plugin-owned UI. Scope variables on public view containers and remove them in Home. Leave the user's global theme selected. Do not recolor global UI. Native styling guidance supports variables and plugin stylesheets. ([Styling reference](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling))

Do not color native file-explorer folder rows in the MVP. No verified public decoration interface exists. A CSS selector depending on internal classes/path attributes or a mutation observer remains an internal-DOM dependency even if it appears simple. The searchable switcher supplies the reliable colored-folder affordance. Optional explorer support can wait for an official hook or a separately assessed navigator integration.

For the overall Kanban, display project text and experiment with a formula-generated colored badge. The documented `html()` formula offers a possible native-rendered badge, but Kanban display and style sanitization require testing. Only allow a fixed generated badge structure, validated hex values, and escaped labels; no arbitrary user HTML. Formula definitions would live in the canonical Base and change only through the same previewed editing flow. ([Bases functions](https://obsidian.md/help/bases/functions))

If exact-color badges fail, use a native text/colored-emoji project label. That preserves visual project identification but cannot reproduce arbitrary exact palette colors. Record this as a reduced acceptance criterion, not a completed exact-color feature. No native-card DOM decoration or custom board as a hidden fallback.

## 6. Explicit note/task commands

Provide these command names under Subject Notebook:

- New project
- Switch project
- Open Home
- New project note
- New project task
- Open project log
- Open project homepage

Use stable IDs such as `new-project` and `switch-project` in one owning module. Obsidian supplies the plugin command prefix. Leave hotkeys unassigned by default so users can select bindings without collisions.

Only these commands default creation into the active project. Home prompts for a project. Do not patch the native new-note command, global default-note directory, or other plugins' creation behavior. There is no verified public scoped native-new-note interception API. Explicit commands fulfill keyboard-first creation while keeping side effects clear.

Create a task's initial frontmatter together with the new file. For later existing-note property edits, use the official frontmatter operation. Do not impose metadata on ordinary notes. Native Bases creation buttons are optional convenience; do not assume a project filter automatically populates all required properties and folder placement. ([Plugin API-use guidance](https://docs.obsidian.md/oo/plugin))

## 7. Project identity, rename policy, and persistence

Use normalized folder paths rather than display names for runtime identity and palette assignments. Task frontmatter retains the requested human-readable project name. This intentionally means external renames require reconciliation of that property and any filtered view. Silent bulk rewriting is more dangerous than a visible repair action.

Discover all immediate folders and infer their paths. Persist only user choices: settings schema version, directory, status default, palette overrides, feature toggles, and optional Home note. Do not persist derived project lists or duplicate task metadata. Runtime switches, queues, and managed leaf references live in memory; startup preserves Obsidian's restored workspace.

## 8. Conservative log fallback and template boundary

Treat empty-editor fallback as a small recovery action within the managed project area. Never intercept leaf closure or open the log whenever an unrelated tool becomes active. Reopen only in a surviving empty managed editor after a verified project-note-to-empty transition; respect explicit closure of the whole area. This sacrifices aggressive fallback to avoid navigation loops.

Keep daily content generation as a pure function receiving a date. File synchronization and cursor positioning remain separate. This is sufficient preparation for future per-project templates; a template registry, Templater dependency, or cross-plugin event protocol is unnecessary now.
