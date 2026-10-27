import {
  MarkdownView,
  type Editor,
  type TFile,
  type Vault,
  type Workspace,
} from "obsidian";
import { FileQueue } from "../core/serial";
import * as daily from "./daily-section";

export class LogService {
  private readonly queue = new FileQueue();
  private disposed = false;

  constructor(
    private readonly vault: Vault,
    private readonly workspace: Workspace,
    private readonly enabled: () => boolean,
    private readonly now: () => Date,
  ) {}

  dispose(): void {
    this.disposed = true;
  }

  async ensureToday(file: TFile): Promise<void> {
    await this.queue.run(file.path, async () => {
      if (this.disposed || !this.enabled()) return;
      const date = daily.localDate(this.now());
      const editor = this.findEditor(file);
      if (editor) {
        const suffix = daily.dailySuffix(editor.getValue(), date);
        if (suffix) editor.replaceRange(suffix, endPosition(editor));
      } else {
        await this.updateBackground(file, date);
      }
    });
  }

  private findEditor(file: TFile): Editor | undefined {
    const active = this.workspace.getActiveViewOfType(MarkdownView);
    const activeEditor = editingFile(active, file);
    if (activeEditor) return activeEditor;
    let result: Editor | undefined;
    this.workspace.iterateAllLeaves((leaf) => {
      result ??= editingFile(leaf.view, file);
    });
    return result;
  }

  private async updateBackground(file: TFile, date: string): Promise<void> {
    const content = await this.vault.read(file);
    if (this.disposed || daily.hasDailyHeading(content, date)) return;
    // A pane may have opened while the read was pending; prefer its current buffer.
    const editor = this.findEditor(file);
    if (editor) {
      const suffix = daily.dailySuffix(editor.getValue(), date);
      if (suffix) editor.replaceRange(suffix, endPosition(editor));
      return;
    }
    await this.vault.process(
      file,
      (current) => current + daily.dailySuffix(current, date),
    );
  }
}

function editingFile(view: unknown, file: TFile): Editor | undefined {
  return view instanceof MarkdownView && view.file === file && view.getMode() === "source"
    ? view.editor
    : undefined;
}

export function endPosition(editor: Editor): { line: number; ch: number } {
  const line = editor.lastLine();
  return { line, ch: editor.getLine(line).length };
}

export function moveToEnd(editor: Editor, focus: boolean): void {
  const position = endPosition(editor);
  editor.setCursor(position);
  editor.scrollIntoView({ from: position, to: position }, true);
  if (focus) editor.focus();
}
