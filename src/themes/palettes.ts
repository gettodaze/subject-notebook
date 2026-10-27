export interface Palette {
  readonly id: string;
  readonly name: string;
  readonly background: string;
  readonly indicator: string;
}

export const PRESETS: readonly Palette[] = [
  { id: "forest-teal", name: "Forest Teal", background: "#2d4841", indicator: "🟢" },
  { id: "golden-brown", name: "Golden Brown", background: "#372700", indicator: "🟡" },
  { id: "burgundy", name: "Burgundy", background: "#380a2d", indicator: "🟣" },
  { id: "deep-ocean", name: "Deep Ocean Blue", background: "#072d3d", indicator: "🔵" },
  { id: "forest-green", name: "Forest Green", background: "#062711", indicator: "🟢" },
  { id: "lavender", name: "Lavender", background: "#30273f", indicator: "🟣" },
  { id: "slate", name: "Slate", background: "#26333d", indicator: "⚪" },
  { id: "navy", name: "Navy", background: "#192c49", indicator: "🔵" },
  { id: "gray", name: "Neutral Gray", background: "#303030", indicator: "⚪" },
];
export const DEFAULT_ASSIGNMENTS: Readonly<Record<string, string>> = {
  PFAS: "forest-teal",
  QMatrix: "golden-brown",
  ItR: "burgundy",
  Geomamba: "deep-ocean",
  Lisa: "forest-green",
};
export const DEFAULT_PRESET_ID = "slate";
export const CUSTOM_PALETTE_ID = "custom";
export const HEX_COLOR = /^#[\da-f]{6}$/iu;
const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#000000";
const MINIMUM_CONTRAST = 4.5;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const LUMINANCE_OFFSET = 0.05;
const SRGB_THRESHOLD = 0.04045;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_DIVISOR = 1.055;
const SRGB_GAMMA = 2.4;
const COLOR_CHANNEL_MAXIMUM = 255;

export function resolvePalette(name: string, assignment?: string): Palette {
  const defaultId = Object.hasOwn(DEFAULT_ASSIGNMENTS, name)
    ? DEFAULT_ASSIGNMENTS[name]
    : undefined;
  const presetId = assignment ?? defaultId ?? DEFAULT_PRESET_ID;
  if (HEX_COLOR.test(presetId)) {
    return {
      id: CUSTOM_PALETTE_ID,
      name: "Custom",
      background: presetId,
      indicator: "●",
    };
  }
  return PRESETS.find((preset) => preset.id === presetId) ?? PRESETS[0]!;
}

export function isPaletteAssignment(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (HEX_COLOR.test(value) || PRESETS.some((preset) => preset.id === value))
  );
}

export function foreground(background: string): string {
  return contrast(background, DARK_TEXT) >= MINIMUM_CONTRAST ? DARK_TEXT : LIGHT_TEXT;
}

export function isDarkBackground(background: string): boolean {
  return foreground(background) === LIGHT_TEXT;
}

export function contrast(left: string, right: string): number {
  const first = luminance(left);
  const second = luminance(right);
  return (
    (Math.max(first, second) + LUMINANCE_OFFSET) /
    (Math.min(first, second) + LUMINANCE_OFFSET)
  );
}

export function linkColor(background: string, external: boolean): string {
  const light = foreground(background) === LIGHT_TEXT;
  const candidate = external
    ? light
      ? "#ffd28a"
      : "#4a2300"
    : light
      ? "#b6edff"
      : "#003b52";
  return contrast(background, candidate) >= MINIMUM_CONTRAST
    ? candidate
    : foreground(background);
}

function luminance(background: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value =
      Number.parseInt(background.slice(offset, offset + 2), 16) / COLOR_CHANNEL_MAXIMUM;
    return value <= SRGB_THRESHOLD
      ? value / SRGB_LINEAR_DIVISOR
      : ((value + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_DIVISOR) ** SRGB_GAMMA;
  });
  return channels.reduce(
    (total, channel, index) => total + channel * LUMINANCE_WEIGHTS[index]!,
    0,
  );
}
