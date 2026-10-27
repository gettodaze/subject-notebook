# Subject Notebook — setup and development

Agent-authored documentation. This is a development preview, not a published community-plugin release.

## Build and install in a test vault

Use Node.js 18.19+ and npm. The plugin itself uses the Obsidian host API and has no bundled third-party runtime dependency.

```sh
npm ci
npm run check
npm run package
```

Copy the three files from `dist/subject-notebook/` into `<test-vault>/.obsidian/plugins/subject-notebook/`, then enable Subject Notebook in Obsidian's community-plugin settings. Use desktop Obsidian 1.14.5+ and enable Bases under Core plugins. Earlier 1.14 patches have not been tested.

`npm run dev` watches source and rebuilds the root `main.js`. It does not install into a vault, enable plugins, or reload Obsidian automatically. Recopy files and reload the test vault after changes.

## Everyday workflow

1. Run **Subject Notebook: New project**, enter `PFAS`, and create it. This creates the directory, `Log.md`, `PFAS.md`, and an absent `Projects/Tasks.base`. Existing files are preserved.
2. If the workspace is occupied or its managed project panes changed, choose whether to arrange project panes or retain the existing geometry and use tabs. No unrelated notes are closed.
3. Use **Switch project** to search by name and select a project or Home. Subsequent switches reuse intact managed panes. Add a hotkey in Obsidian's Hotkeys settings for this command.
4. Use **New project task** for a task in the selected project, with Backlog by default. Task creation leaves your current editor in place; click its native card when you want to edit the task body. Native card dragging edits the task's status property.
5. **New project note**, **Open project log**, and **Open project homepage** work independently of the planner. In Home, creation/open commands prompt for a project.
6. **Open Home** selects the overall board and clears the main-notebook indicator. Open project notes keep their own folder colors. No particular Home note is required; configure an optional landing-note path and template if desired.
7. **Report Issue** opens [a new GitHub issue](https://github.com/gettodaze/subject-notebook/issues/new) in your browser. It does not submit an issue or collect note contents. A repository override is available in settings.

The five statuses are Backlog, Soon, Today, Now, Done. On narrow panes, scroll horizontally to reach all columns. Tasks with unlisted or missing statuses are not shown in the generated Kanban; their Markdown files remain intact. Fix those properties manually or inspect them in a table view.

Daily log headings use the local calendar date. Exact H2 headings already present in ordinary Markdown are authoritative; dates inside frontmatter and fenced examples do not count. Logs opened in editing mode go to EOF. Ordinary Reading view navigation stays in Reading view and has no cursor to position.

## Main notebook and reference notes

**Main notebook: PFAS** appears in a Forest Teal status-bar pill. Clicking it opens the switcher. Opening Lisa’s green notes while PFAS is main leaves those notes green and keeps the main pill teal. New notes/tasks still go to PFAS. Browsing, including opening a reference Log, never changes the main context.

**Set main notebook from current note** explicitly selects that note’s active project without rearranging panes. **Restore project layout** opens the main notebook’s selected layout features and focuses its Log at EOF. **Open Home** is separate. Both commands have no assigned hotkey; bind Ctrl+H to Restore project layout if desired.

If an existing managed primary editor becomes empty and the main Log is absent, it falls back to that Log. Closing the entire project region or an unrelated tab does not cause the plugin to recreate it. This conservative behavior avoids fighting native pane closure.

## Optional panes and templates

Settings show independent homepage and Kanban toggles for each discovered project. Log always remains the core notebook. Global Home has its own homepage/Kanban toggles; its homepage requires a configured landing note. Changes take effect on the next switch or restore, and disabling a pane does not delete its note.

Choose an existing Markdown file as a project homepage or Home landing-note template. The plugin copies it only when the destination is missing. Supported substitutions are `{{project}}`, `{{log}}` (a wikilink, empty for global Home), and `{{date}}` (local YYYY-MM-DD). Existing destinations, including empty notes, are never replaced. This is plain token substitution, with no Templater requirement. Daily-section templates remain future work.

## Scratch, combine, and archive

**New scratch project** creates an ordinary notebook with a suggested timestamped name and a scratch indicator. There is no timer or automatic deletion. **Trash scratch project** shows a file preview and requires an explicit confirmation before moving the folder into the vault’s recoverable `.trash`. Restore files through your file manager if needed; the plugin does not permanently delete them.

**Combine project into another project** previews moving the source into a named subfolder of the target. Both Logs and homepages remain separate. Task notes receive the target’s `project` property; their statuses and bodies are preserved, so they follow onto the target board. Existing destination folders are rejected. The preview is invalidated if source files change before execution; pending source editors are saved before inventory. Guarded rollback handles failed task updates/moves without replacing concurrent user edits. This is an explicit operation; ordinary navigation never scans project contents.

**Archive project** previews moving its entire folder to `Projects Archive/` by default. The archive root must be separate from the active projects root. Tasks retain their properties and disappear from generated active boards because those boards also filter by the active directory. Move the folder back to restore discovery; palette/layout preferences follow observed moves. Archived notes keep their notebook color. Custom Bases with different global filters may continue to show archived tasks; inspect their filters.

Existing Base views are preserved after combines/archives. Old named views may be empty; remove them manually if desired. FileManager handles native link updates according to your Obsidian preferences. Backups and sync are still the user’s responsibility, especially across simultaneous devices.

## Settings and planner customizations

Settings include the projects directory, default status, daily headings, styling, status indicator, optional Home note, and project palette rows discovered from folders. Changing the directory changes discovery scope; it does not relocate notes or rewrite existing Base filters.

PFAS, QMatrix, ItR, Geomamba, and Lisa receive the requested default palettes. Choose another preset or a custom background in settings. Foreground and link colors are selected for readability; editor changes remain scoped to project content.

Every project Markdown pane, including references from another notebook and archived projects, receives its own folder’s locally scoped light/dark palette so native editor controls remain readable. The native planner follows the user's regular theme and identifies projects with colored card badges.

**Review setup** prepares missing native views and the project-color formula in `Tasks.base`. Existing Base changes require an explicit preview approval. Palette changes apply to editors immediately; approve a planner setup update to refresh the stored native badge colors. Ordinary switching never edits the Base.

An existing Base is user-owned. The plugin preserves custom views, comments, unknown sections, and surrounding formatting. Automatic changes support ordinary block-style YAML. For flow-style YAML or a customized badge formula, the preview supplies a fragment for manual editing instead of rewriting the file. If a conflicting view already uses a required name, resolve it manually; it is never replaced automatically.

Generated native view names are `All Projects` and `Project: PFAS` (and equivalents for other projects). The shared badge formula is `Project`. It uses validated palette colors and escaped project labels. Native board interaction and query evaluation belong to Bases.

External project renames are discovered automatically. Palette assignments follow an observed rename, while existing task project properties, old homepages, and Base views are preserved. Review and repair those references manually; no bulk rewrite occurs. New project creation rejects filename/link characters, case/Unicode collisions, reserved names, and the special `Log` project-name collision.

## Validation commands

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

The Node test runner uses a small test-only Obsidian boundary and YAML parser. It covers data/path/configuration logic and controlled service races. It cannot establish native rendering behavior.

`npm run test:host` is an opt-in Playwright driver for the isolated test instance described in [VALIDATION.md](VALIDATION.md). It refuses any other vault path. It drives native UI controls, so selectors in the **test driver** may need updates across Obsidian versions. Production code does not depend on those native DOM structures.

See [TODO.md](TODO.md) for release work and [VALIDATION.md](VALIDATION.md) for what was actually exercised. Mobile, native explorer folder coloring, and automatic rename migration are outside this preview.
