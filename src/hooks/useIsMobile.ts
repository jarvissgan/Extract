import { em, useMantineTheme } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

// True below Mantine's `sm` breakpoint (48em / 768px): phones and small tablets.
// Prefer responsive style props (e.g. w={{ base: "100%", sm: 200 }}) or hiddenFrom/visibleFrom;
// use this hook only when the component structure itself must change (e.g. list vs table).
export const useIsMobile = () => {
  const theme = useMantineTheme();
  return useMediaQuery(`(max-width: ${em(parseFloat(theme.breakpoints.sm) * 16 - 0.1)})`, false, {
    getInitialValueInEffect: false,
  });
};
