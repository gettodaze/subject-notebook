# Running project preferences

Updated 2026-10-26 from the user's supplied instructions. This supplements those instructions and does not replace them.

- Product name: **Subject Notebook**; plugin ID: **`subject-notebook`**.
- Implementation is now authorized (2026-10-26: “okay, lets do it!”). Follow the plan, record real validation evidence, and distinguish host-only checks from automated tests.
- Prioritize behavior preservation, clarity, maintainability, simple explicit control flow, and testability, in that order.
- Use strict TypeScript, comprehensive parameter/return types, validated data boundaries, and small cohesive modules.
- Aim for functions around 20 lines. Explain logical blocks and document concrete reasons for exceptions.
- Keep imports, constants, types, classes, and function definitions at module scope; no import-time I/O or initialization workflows.
- Put meaningful/repeated literals in their owning module and use namespace imports for constants.
- Prefer native Obsidian APIs, Markdown, and Bases. Keep community plugins optional, and avoid React, polling, broad scans, and internal-DOM dependencies.
- Keep the plugin entry point thin. Dashboard-specific package/CLI instructions apply only if such code is actually introduced; do not force dashboard organization onto this plugin.
- Existing notes, customized Base configurations, workspace layouts, and other plugins' commands are user-owned. Changes requiring consent must have concrete previews.
- Use a separate test vault. Verify uncertain integrations against a real host before claiming compatibility.
- Maintain this running preferences file as new preferences are learned, and periodically remind the user that it is being updated.
- Store agent-authored documentation in `docs_agent/` and link it from the root `README.md` (user request, 2026-10-26). This includes this running preferences file.
- Include a Report Issue command that opens the repository's GitHub new-issue page. The plugin is named Subject Notebook; do not restore the old Colored Folders product name merely for its command prefix.

- Notebook color belongs to the note’s project folder, independent of the selected main notebook. Reading another notebook must never change the main context automatically.
- Show the main notebook as a colored status-bar pill. Main context controls new notes/tasks, layout restore, and conservative Log fallback.
- Keep Restore project layout and Open Home as separate commands with no default hotkeys; the user may bind Ctrl+H to restore.
- Project homepage/Kanban toggles and global Home toggles are independent. Templates are optional plain Markdown and never replace existing files.
- Scratch projects are ordinary folders with explicit recoverable trash, no automatic expiry. Combine by moving into a target subfolder, reassign task project properties, and keep logs separate.
- Archive whole project folders outside the active root, retain task data and preferences, and allow manual folder restoration.
