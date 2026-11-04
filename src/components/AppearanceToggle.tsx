import { Center, SegmentedControl, Tooltip } from "@mantine/core";
import { IconHeart, IconMoon, IconSun } from "@tabler/icons-react";
import { useAppearance, type Appearance } from "../theme/Appearance";

const ICONS = { light: IconSun, dark: IconMoon, a: IconHeart };
const LABELS = { light: "Light", dark: "Dark", a: "A mode" };

// Compact Light / Dark / A mode switch for the header.
const AppearanceToggle = () => {
  const { appearance, setAppearance } = useAppearance();
  return (
    <SegmentedControl
      size="xs"
      radius="xl"
      aria-label="Appearance"
      value={appearance}
      onChange={(v) => setAppearance(v as Appearance)}
      data={(Object.keys(ICONS) as Appearance[]).map((value) => {
        const Icon = ICONS[value];
        return {
          value,
          label: (
            <Tooltip label={LABELS[value]} withArrow>
              <Center aria-label={LABELS[value]}>
                <Icon size={15} stroke={1.8} />
              </Center>
            </Tooltip>
          ),
        };
      })}
    />
  );
};

export default AppearanceToggle;
