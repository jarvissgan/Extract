import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createTheme,
  MantineProvider,
  mergeThemeOverrides,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";

export type Appearance = "light" | "dark" | "a";

// eslint-disable-next-line react-refresh/only-export-components
export const APPEARANCES: { value: Appearance; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Bright and clean" },
  { value: "dark", label: "Dark", description: "Easy on the eyes at night" },
  { value: "a", label: "A mode", description: "Butter yellow and pink" },
];

const butter: MantineColorsTuple = [
  "#fffdf2",
  "#fff8db",
  "#fff1b8",
  "#ffe98f",
  "#ffe066",
  "#f9d43f",
  "#e8c12a",
  "#cfa91c",
  "#b08e12",
  "#8f7208",
];

// Jade: the one brand colour. It marks primary actions, income and "on track"; amber
// (yellow) means close to a limit and red means over it. Everything else stays neutral.
// It replaces Mantine's teal, so every existing teal (income, positive change) follows.
const jade: MantineColorsTuple = [
  "#e8f6f0",
  "#cdeadd",
  "#9fd6bf",
  "#6ec19f",
  "#46ae85",
  "#2d9f74",
  "#1d8c65",
  "#12795b",
  "#0a674c",
  "#00543d",
];

// Dark mode: a deep green-grey instead of Mantine's neutral greys, so it feels of a piece
// with the jade accent. dark[7] is the page, dark[6] cards and fields, dark[4] borders.
const dark: MantineColorsTuple = [
  "#e4ece7",
  "#bccac2",
  "#93a39b",
  "#6c7d75",
  "#3b4b44",
  "#2e3d36",
  "#1d2924",
  "#15201b",
  "#111a16",
  "#0c1310",
];

// Amber for "close to a limit", one shade family for bars and text. Replaces Mantine's
// yellow, which reads as a bright highlighter rather than a caution.
const amber: MantineColorsTuple = [
  "#fdf6e7",
  "#f8e9c4",
  "#f1d494",
  "#e9be62",
  "#e2aa3a",
  "#d99d24",
  "#c98c17",
  "#b7791f",
  "#9a6413",
  "#7c4f0a",
];

const baseTheme = createTheme({
  primaryColor: "teal",
  // dark mode uses a deeper jade than you'd expect so white text on buttons stays readable
  primaryShade: { light: 7, dark: 6 },
  // Onest for reading and forms; Bricolage Grotesque for amounts and page titles, where
  // the numbers are the point
  fontFamily: "'Onest', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily: "'Bricolage Grotesque', 'Onest', sans-serif",
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "2.75rem", lineHeight: "1.05" },
      h2: { fontSize: "1.875rem", lineHeight: "1.15" },
      h3: { fontSize: "1.375rem", lineHeight: "1.25" },
      h4: { fontSize: "1.125rem", lineHeight: "1.3" },
    },
  },
  black: "#17201c",
  defaultRadius: "md",
  colors: { butter, teal: jade, yellow: amber, dark },
  cursorType: "pointer",
  components: {
    // flat: a hairline border separates surfaces, no drop shadows
    Card: { defaultProps: { radius: "lg", withBorder: true, shadow: "none" } },
    Paper: { defaultProps: { radius: "lg", shadow: "none" } },
    Modal: { defaultProps: { radius: "lg", overlayProps: { blur: 2, backgroundOpacity: 0.4 } } },
    Button: { defaultProps: { radius: "md" }, styles: { root: { fontWeight: 600 } } },
    NavLink: { defaultProps: { variant: "light" }, styles: { root: { borderRadius: "var(--mantine-radius-md)" } } },
    Badge: { defaultProps: { radius: "sm", variant: "light" }, styles: { root: { textTransform: "none", fontWeight: 600 } } },
    Notification: { defaultProps: { radius: "md" } },
    Progress: { defaultProps: { radius: "xl" } },
  },
});

// A mode: pink accents on a butter-yellow background, always light.
const aTheme = mergeThemeOverrides(
  baseTheme,
  createTheme({ primaryColor: "pink", primaryShade: { light: 5, dark: 5 } })
);

const aVariables: CSSVariablesResolver = () => ({
  variables: {},
  dark: {},
  light: {
    "--mantine-color-body": "#fff8db",
    "--mantine-color-text": "#4a3426",
    "--mantine-color-dimmed": "#8a6f5a",
    "--mantine-color-default": "#fffdf5",
    "--mantine-color-default-hover": "#fff1b8",
    "--mantine-color-default-border": "#f7c6d8",
    "--mantine-color-default-color": "#4a3426",
    "--mantine-color-placeholder": "#b39a85",
  },
});

const noVariables: CSSVariablesResolver = () => ({ variables: {}, light: {}, dark: {} });

const STORAGE_KEY = "extract-appearance";

const loadAppearance = (): Appearance => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "a") return saved;
  } catch {
    // storage unavailable
  }
  return "dark";
};

interface AppearanceContextValue {
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

// Wraps MantineProvider so the whole app follows the chosen appearance.
// Saved per device, like most apps' theme settings.
export const AppearanceProvider = ({ children }: { children: ReactNode }) => {
  const [appearance, setAppearanceState] = useState<Appearance>(loadAppearance);

  const setAppearance = (value: Appearance) => {
    setAppearanceState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // storage unavailable; the choice just won't persist
    }
  };

  // lets global CSS style A mode (background, cards)
  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
  }, [appearance]);

  const value = useMemo(() => ({ appearance, setAppearance }), [appearance]);

  return (
    <AppearanceContext.Provider value={value}>
      <MantineProvider
        theme={appearance === "a" ? aTheme : baseTheme}
        forceColorScheme={appearance === "dark" ? "dark" : "light"}
        cssVariablesResolver={appearance === "a" ? aVariables : noVariables}
      >
        {children}
      </MantineProvider>
    </AppearanceContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppearance = () => {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used inside <AppearanceProvider>");
  return ctx;
};

// Props for primary call-to-action buttons: solid jade, or solid pink in A mode.
// eslint-disable-next-line react-refresh/only-export-components
export const ctaProps = (appearance: Appearance) =>
  appearance === "a" ? ({ variant: "filled", color: "pink" } as const) : ({ variant: "filled" } as const);

// Colors for celebrations, matching the current appearance.
// eslint-disable-next-line react-refresh/only-export-components
export const confettiColors = (appearance: Appearance) =>
  appearance === "a"
    ? ["#f06595", "#faa2c1", "#ffe066", "#fff1b8", "#ffffff"]
    : ["#12795b", "#46ae85", "#9fd6bf", "#e8b04b", "#ffffff"];
