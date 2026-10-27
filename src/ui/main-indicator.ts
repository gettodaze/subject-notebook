import type { Plugin } from "obsidian";
import type { Palette } from "../themes/palettes";
import * as palettes from "../themes/palettes";

const STATUS_CLASS = "subject-notebook-status";
const MAIN_BACKGROUND_VARIABLE = "--sn-main-background";
const MAIN_TEXT_VARIABLE = "--sn-main-text";

export function createIndicator(plugin: Plugin, openSwitcher: () => void): HTMLElement {
  const element = plugin.addStatusBarItem();
  element.classList.add(STATUS_CLASS);
  element.setAttribute("role", "button");
  element.setAttribute("aria-label", "Main notebook. Switch project");
  element.tabIndex = 0;
  plugin.registerDomEvent(element, "click", openSwitcher);
  plugin.registerDomEvent(element, "keydown", (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openSwitcher();
  });
  return element;
}

export function updateIndicator(
  element: HTMLElement,
  label: string,
  busy: boolean,
  palette?: Palette,
): void {
  element.show();
  element.setText(label);
  element.setAttribute("aria-busy", String(busy));
  element.style.setProperty(
    MAIN_BACKGROUND_VARIABLE,
    palette?.background ?? "transparent",
  );
  element.style.setProperty(
    MAIN_TEXT_VARIABLE,
    palette ? palettes.foreground(palette.background) : "var(--text-muted)",
  );
}
