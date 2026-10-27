import type { Plugin } from "obsidian";

export interface CommandActions {
  readonly newProject: () => void;
  readonly switchProject: () => void;
  readonly openHome: () => void;
  readonly newNote: () => void;
  readonly newTask: () => void;
  readonly openLog: () => void;
  readonly openHomepage: () => void;
  readonly reportIssue: () => void;
  readonly newScratch: () => void;
  readonly restoreLayout: () => void;
  readonly combineProject: () => void;
  readonly archiveProject: () => void;
  readonly useCurrentNotebook: () => void;
  readonly trashScratch: () => void;
}

export function registerCommands(plugin: Plugin, actions: CommandActions): void {
  const commands: readonly [string, string, () => void][] = [
    [
      "set-main-notebook",
      "Set main notebook from current note",
      actions.useCurrentNotebook,
    ],
    ["new-project", "New project", actions.newProject],
    ["switch-project", "Switch project", actions.switchProject],
    ["open-home", "Open Home", actions.openHome],
    ["new-project-note", "New project note", actions.newNote],
    ["new-project-task", "New project task", actions.newTask],
    ["open-project-log", "Open project log", actions.openLog],
    ["open-project-homepage", "Open project homepage", actions.openHomepage],
    ["report-issue", "Report Issue", actions.reportIssue],
    ["new-scratch-project", "New scratch project", actions.newScratch],
    ["restore-project-layout", "Restore project layout", actions.restoreLayout],
    ["combine-project", "Combine project into another project", actions.combineProject],
    ["archive-project", "Archive project", actions.archiveProject],
    ["trash-scratch-project", "Trash scratch project", actions.trashScratch],
  ];
  for (const [id, name, callback] of commands) plugin.addCommand({ id, name, callback });
}
