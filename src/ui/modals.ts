import {
  App,
  FuzzySuggestModal,
  Modal,
  Notice,
  Setting,
  renderResults,
  type FuzzyMatch,
} from "obsidian";
import type { Project } from "../projects/model";
import type { Palette } from "../themes/palettes";

export type Selection = Project | null;
const SWATCH_CLASS = "subject-notebook-swatch";

export interface NameModalOptions {
  readonly initialValue?: string;
  readonly submitLabel?: string;
  readonly description?: string;
}

export class ProjectSwitcher extends FuzzySuggestModal<Selection> {
  constructor(
    app: App,
    private readonly projects: readonly Project[],
    private readonly palette: (project: Project) => Palette,
    private readonly choose: (project: Selection) => void,
    private readonly includeHome: boolean = true,
    private readonly annotation: (project: Project) => string = () => "",
  ) {
    super(app);
    this.setPlaceholder("Choose a project");
  }

  override getItems(): Selection[] {
    return this.includeHome ? [null, ...this.projects] : [...this.projects];
  }
  override getItemText(project: Selection): string {
    return project
      ? `${project.name}${this.annotation(project)} — ${project.folderPath}`
      : "Home";
  }
  override onChooseItem(project: Selection): void {
    this.choose(project);
  }

  override renderSuggestion(match: FuzzyMatch<Selection>, element: HTMLElement): void {
    const swatch = element.createSpan({ cls: SWATCH_CLASS });
    if (match.item) swatch.style.backgroundColor = this.palette(match.item).background;
    swatch.setAttribute("aria-hidden", "true");
    renderResults(element.createSpan(), this.getItemText(match.item), match.match);
  }
}

export class NameModal extends Modal {
  private opened = false;
  constructor(
    app: App,
    private readonly title: string,
    private readonly submit: (name: string, current: () => boolean) => Promise<void>,
    private readonly options: NameModalOptions = {},
  ) {
    super(app);
  }

  override onOpen(): void {
    this.opened = true;
    this.setTitle(this.title);
    let value = this.options.initialValue ?? "";
    if (this.options.description)
      this.contentEl.createEl("p", { text: this.options.description });
    const form = this.contentEl.createEl("form");
    const input = new Setting(form).setName("Name");
    input.addText((text) => {
      text.setValue(value);
      text.onChange((next) => {
        value = next;
      });
      text.inputEl.focus();
      text.inputEl.select();
    });
    const error = form.createEl("p", { cls: "subject-notebook-error" });
    const button = form.createEl("button", {
      text: this.options.submitLabel ?? "Create",
      type: "submit",
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      button.disabled = true;
      void this.submit(value, () => this.opened)
        .then(() => this.close())
        .catch((reason: unknown) => {
          if (!this.opened) {
            new Notice(errorMessage(reason));
            return;
          }
          error.setText(errorMessage(reason));
          button.disabled = false;
        });
    });
  }
  override onClose(): void {
    this.opened = false;
    this.contentEl.empty();
  }
}

export interface Choice {
  readonly label: string;
  readonly value: string;
}

export class ChoiceModal extends Modal {
  private settled = false;
  constructor(
    app: App,
    private readonly title: string,
    private readonly description: string,
    private readonly choices: readonly Choice[],
    private readonly resolve: (value: string | null) => void,
    private readonly preview: string = "",
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle(this.title);
    this.contentEl.createEl("p", { text: this.description });
    if (this.preview)
      this.contentEl.createEl("pre", {
        text: this.preview,
        cls: "subject-notebook-preview",
      });
    for (const choice of this.choices) {
      new Setting(this.contentEl).addButton((button) =>
        button.setButtonText(choice.label).onClick(() => {
          this.settled = true;
          this.resolve(choice.value);
          this.close();
        }),
      );
    }
  }
  override onClose(): void {
    if (!this.settled) this.resolve(null);
    this.contentEl.empty();
  }
}

export function chooseAction(
  app: App,
  title: string,
  description: string,
  choices: readonly Choice[],
  preview?: string,
): Promise<string | null> {
  return new Promise((resolve) =>
    new ChoiceModal(app, title, description, choices, resolve, preview).open(),
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
