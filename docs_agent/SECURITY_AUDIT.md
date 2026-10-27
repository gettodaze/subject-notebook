# Repository security checks

Agent-authored record, 2026-10-26.

The official Gitleaks 8.30.1 Linux binary was downloaded and verified against the release checksum. Redacted scans found no secrets in:

- All available local Git history (`--all`, one existing commit).
- A fresh snapshot of Git-eligible tracked and untracked source/documentation files, excluding deleted files and ignored local artifacts.
- The final installable `dist/subject-notebook/` bundle, manifest, and stylesheet.

Reports and scan snapshots are outside the repository in `/tmp`. Local `.aws/`, `.agents/`, `.codex/`, environment files, key files, dependencies, build outputs, and test-vault directories are ignored. No credential files were copied into the release artifact. `npm audit --audit-level=low` reported zero known vulnerabilities for the locked dependencies.

Production source has no filesystem adapter, Node filesystem, polling, native DOM selector, or mutation-observer integration. Report Issue only opens the configured GitHub new-issue page and does not collect note content or submit an issue. Project changes use Obsidian’s Vault/FileManager APIs. No push or publication was performed.

Pattern scanning cannot prove that every possible secret is absent. Review future changes and rerun source/history/artifact scans before publishing new work.
