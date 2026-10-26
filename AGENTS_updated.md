# Running project preferences

Updated 2026-10-26 from the user's supplied instructions. This supplements those instructions and does not replace them.

- Product name: **Subject Notebook**; plugin ID: **`subject-notebook`**.
- Current assignment is research and planning only. Do not implement the plugin during this assignment.
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
