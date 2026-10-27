import { MarkdownView, type Workspace } from "obsidian";
import type { Project } from "../projects/model";
import { notebookForFile } from "../projects/notebooks";
import type { Palette } from "./palettes";
import * as palettes from "./palettes";

export const PROJECT_CLASS = "subject-notebook-project";
const BACKGROUND_VARIABLE = "--sn-background";
const TEXT_VARIABLE = "--sn-text";
const INTERNAL_LINK_VARIABLE = "--sn-internal-link";
const EXTERNAL_LINK_VARIABLE = "--sn-external-link";
const PALETTE_VARIABLES = [
  BACKGROUND_VARIABLE,
  TEXT_VARIABLE,
  INTERNAL_LINK_VARIABLE,
  EXTERNAL_LINK_VARIABLE,
] as const;
const DARK_THEME_CLASS = "theme-dark";
const LIGHT_THEME_CLASS = "theme-light";

interface StyledPane {
  readonly background: string;
  readonly addedTheme: string | null;
}

export class ProjectStyles {
  private readonly styled = new Map<HTMLElement, StyledPane>();
  private readonly notebooks = new Map<string, Project>();

  setNotebooks(notebooks: readonly Project[]): void {
    this.notebooks.clear();
    for (const notebook of notebooks) this.notebooks.set(notebook.folderPath, notebook);
  }

  clear(): void {
    for (const element of [...this.styled.keys()]) this.restore(element);
  }

  apply(workspace: Workspace, paletteFor: (notebook: Project) => Palette): void {
    const desired = new Set<HTMLElement>();
    workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof MarkdownView) || !leaf.view.file) return;
      const notebook = notebookForFile(leaf.view.file.path, this.notebooks);
      if (!notebook) return;
      const element = leaf.view.containerEl;
      desired.add(element);
      this.style(element, paletteFor(notebook));
    });
    for (const element of [...this.styled.keys()]) {
      if (!desired.has(element)) this.restore(element);
    }
  }

  private style(element: HTMLElement, palette: Palette): void {
    // Visual tokens derive from background; ordinary navigation needs no repeated DOM writes.
    if (this.styled.get(element)?.background === palette.background) return;
    this.restore(element);
    const theme = palettes.isDarkBackground(palette.background)
      ? DARK_THEME_CLASS
      : LIGHT_THEME_CLASS;
    const addedTheme = element.classList.contains(theme) ? null : theme;
    element.classList.add(PROJECT_CLASS, theme);
    element.style.setProperty(BACKGROUND_VARIABLE, palette.background);
    element.style.setProperty(TEXT_VARIABLE, palettes.foreground(palette.background));
    element.style.setProperty(
      INTERNAL_LINK_VARIABLE,
      palettes.linkColor(palette.background, false),
    );
    element.style.setProperty(
      EXTERNAL_LINK_VARIABLE,
      palettes.linkColor(palette.background, true),
    );
    this.styled.set(element, { background: palette.background, addedTheme });
  }

  private restore(element: HTMLElement): void {
    const previous = this.styled.get(element);
    if (!previous) return;
    element.classList.remove(PROJECT_CLASS);
    if (previous.addedTheme) element.classList.remove(previous.addedTheme);
    for (const variable of PALETTE_VARIABLES) element.style.removeProperty(variable);
    this.styled.delete(element);
  }
}
