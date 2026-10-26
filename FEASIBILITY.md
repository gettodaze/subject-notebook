# Subject Notebook — feasibility assessment

Researched 2026-10-26 against official live documentation, the official sample repository, and published TypeScript declarations. The local repository is empty; no installed Obsidian or local type package was available. All “verified” statements below mean documented or declared capabilities, not successful execution in a running vault.

## Capability assessment

| Requirement | Evidence level | Recommendation / practical limit |
| --- | --- | --- |
| Lifecycle, settings, commands, native settings controls | Verified in official sample | Use ordinary plugin lifecycle and persistence; validate saved values. [Sample source](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/src/main.ts) |
| Searchable keyboard switcher with swatches | Verified extension mechanism | Use fuzzy modal custom suggestion rendering. Swatch DOM is plugin-owned. [Modal guide](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Modals.md) |
| Clickable status indicator | Verified sample capability | Desktop enhancement; commands remain sufficient on mobile. [Sample source](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/src/main.ts) |
| Folder discovery, file creation, atomic background updates | Verified Vault mechanism | Inspect immediate children and subscribe to events; no direct filesystem access. [Vault guide](https://docs.obsidian.md/Plugins/Vault) |
| Idempotent daily sections and EOF | Feasible application logic over verified APIs | Check actual content, serialize per file, edit live buffers when open; cursor behavior requires editing mode. Test multiple panes and pending saves. [API guidance](https://docs.obsidian.md/oo/plugin) |
| Nested project panes | Public workspace mechanisms verified; exact composition untested | Split top/bottom, then top left/right in a managed area. Never infer supported mutability of split internals. [Workspace guide](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Workspace.md) |
| Restore canonical layout while preserving every arbitrary layout | Conflicting goals, no automatic guarantee | Explicit switch restores managed panes; customized areas require a preserve/restore choice. Do not close unrelated notes. |
| Native Kanban with drag updating status | Verified, Obsidian 1.14+ | Group by the note property; no custom drag engine. [Kanban](https://obsidian.md/help/bases/views/kanban) |
| Ordered five columns, including empty ones | Verified documented configuration/UI | Manual groups support empty values. Check rendering in the pinned host. [Views](https://obsidian.md/help/bases/views) |
| One shared Base with per-project queries | Verified file format | Use shared filters plus named filtered views. [Syntax](https://obsidian.md/help/bases/syntax) |
| Select a named Base view | Verified Markdown embed syntax | Prefer `![[Projects/Tasks.base#PFAS]]`; do not invent native leaf-state fields. [Create a Base](https://obsidian.md/help/bases/create-base) |
| Interactive Base embed inside plugin pane | Integration hypothesis | Thin embed host is the recommended first experiment. Fallback: ordinary user-approved Markdown embed note in Reading view. |
| Apply arbitrary dynamic native filter from outside Bases | No verified public entry point | Choose persistent named views. A custom view API does not imply control of the built-in view. |
| Safe changes to any customized Base YAML | File format known; universal lossless editing not provided | Preview isolated additions; provide a manual fragment for unsupported formatting. Never regenerate on switching. |
| Exact project editor colors without global recoloring | Supported styling approach; theme details untested | Use scoped variables; test dark/light and community themes. [Styling](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling) |
| Native explorer folder icons/names colored through a public hook | No verified hook | Defer; use exact swatches in the switcher and status UI. |
| Exact palette border/background for each native Kanban card | No verified card-decorator hook | Test a displayed formula badge; otherwise project text plus colored emoji. Do not target internal card DOM. |
| Colored badge via native formula | Formula HTML rendering documented; Kanban result untested | Prototype safe fixed markup; native sanitization may remove inline colors. [Functions](https://obsidian.md/help/bases/functions) |
| Scoped integration with native new-note command | No verified public interception hook | Explicit Subject Notebook commands. |
| Always replace the last closed editor with Log.md | Nonintrusive universal behavior unreliable | Only restore an existing empty managed leaf; respect closure of the entire area. |
| Automatic cross-device exactly-once headings | Beyond local API guarantee | Local serialization and atomic processing reduce local races; sync conflicts still require normal Obsidian resolution. |

The public declaration review establishes the API inventory in [PLAN.md](PLAN.md); it also exposes important gaps around external Bases control and typed workspace serialization. Absence here means “not verified in the inspected public contract,” not proof that an internal mechanism cannot exist. ([Official declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts))

## Required experiments before feature implementation

### E1 — Native planner embedding and view isolation

In a disposable vault with a recorded Obsidian version, create one Base with All Projects and PFAS/ItR views and three task notes. Render the PFAS named embed in a minimal plugin-owned pane using the public Markdown renderer and a managed component lifecycle. Open All Projects simultaneously elsewhere.

Pass only if the PFAS pane filters correctly, dragging updates frontmatter, both panes refresh, switching the host embed does not change another pane's selection/filter, and disposing/remounting leaves no stale listeners. Test Bases disabled, re-enabled, and an invalid/missing named view. Do not infer success merely because Markdown rendering resolves without an exception.

If this fails, repeat using an ordinary Markdown Reading view with the same embed. Prefer that documented user-facing workflow over internal view-state keys. If neither is reliable, automatic filtered planner switching is blocked; release only a clearly labeled partial MVP or revise the plan with the user before claiming completion.

### E2 — Canonical geometry and preservation

Start with an empty workspace, then repeat with unrelated tabs, pinned notes, existing splits, a modified managed leaf, and a Workspaces Plus layout change. Build top/bottom before top left/right using public operations. Test repeated PFAS/ItR/Home switches and rapid queued requests.

Pass only if the T layout is repeatable in the managed area, the log receives final focus, unrelated tabs and pinned state survive, and leaf count stays bounded. No fixed pixel ratios are required. On mobile use a tab-based presentation; the desktop T layout is not a sensible universal guarantee. Confirm mobile behavior before declaring mobile support in the manifest.

### E3 — Native project identification

Display the project property and a formula-generated badge in the native Kanban. Test exact custom hex colors, dark/light themes, escaping, narrow cards, and disabled plugin behavior. The generated Base must remain understandable independently of Subject Notebook.

Pass exact-color acceptance only if native rendering reliably preserves the badge's color with no internal selectors. Otherwise document project text/colored emoji as the supported baseline and mark exact custom-color cards deferred. Do not introduce a custom board just to conceal this limitation.

## Acceptance journey disposition

| Requested steps | Planned proof |
| --- | --- |
| 1–3: create PFAS, files, Forest Teal | Creation tests plus settings UI; verify existing-file preservation and exact `#2d4841` background |
| 4–5: keyboard switch and three panes | E1/E2 must pass; safe first-use layout consent precedes one-command subsequent switching |
| 6–7: daily heading and cursor | Content-based unit cases and real editor checks, including two panes and midnight |
| 8–9: create Backlog task and drag to Today | Real native Kanban test; inspect Markdown property and preserved task body |
| 10: Home sees same PFAS task with visual identity | E1 verifies shared data; E3 determines exact color badge versus explicitly reduced text/emoji fallback |
| 11–12: resume and no duplicate heading | Repeated/rapid switching tests with manual EOF/focus verification |

The complete requested MVP is plausible, but exact native card coloring and unconstrained workspace preservation must not be presented as settled. The primary release goal is dependable switching and plain-file task management. Broader explorer coloring, templates, and workspace history remain outside v1.
