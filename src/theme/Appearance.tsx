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

const baseTheme = createTheme({
  primaryColor: "violet",
  primaryShade: { light: 6, dark: 5 },
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: "750" },
  defaultRadius: "md",
  colors: { butter },
  cursorType: "pointer",
  components: {
    Card: { defaultProps: { radius: "lg", withBorder: true } },
    Paper: { defaultProps: { radius: "lg" } },
    Modal: { defaultProps: { radius: "lg", overlayProps: { blur: 3, backgroundOpacity: 0.35 } } },
    Button: { defaultProps: { radius: "md" } },
    NavLink: { defaultProps: { variant: "light" }, styles: { root: { borderRadius: "var(--mantine-radius-md)" } } },
    Badge: { defaultProps: { radius: "sm" } },
    Notification: { defaultProps: { radius: "md" } },
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

// Gradient for primary call-to-action buttons.
// eslint-disable-next-line react-refresh/only-export-components
export const brandGradient = (appearance: Appearance) =>
  appearance === "a" ? { from: "pink.5", to: "orange.4", deg: 120 } : { from: "violet", to: "pink", deg: 120 };

// Colors for celebrations, matching the current appearance.
// eslint-disable-next-line react-refresh/only-export-components
export const confettiColors = (appearance: Appearance) =>
  appearance === "a"
    ? ["#f06595", "#faa2c1", "#ffe066", "#fff1b8", "#ffffff"]
    : ["#7950f2", "#f06595", "#20c997", "#fcc419", "#4dabf7"];
