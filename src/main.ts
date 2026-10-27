import { Plugin } from "obsidian";
import { PluginRuntime } from "./plugin-runtime";

export default class SubjectNotebookPlugin extends Plugin {
  private runtime: PluginRuntime | null = null;

  override async onload(): Promise<void> {
    this.runtime = new PluginRuntime(this);
    await this.runtime.load();
  }

  override onunload(): void {
    this.runtime?.dispose();
    this.runtime = null;
  }
}
