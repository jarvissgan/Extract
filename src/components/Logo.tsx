import { Group, Text } from "@mantine/core";
import { useAppearance } from "../theme/Appearance";
import { HoneyPot } from "./Pooh";

const Logo = () => {
  const { appearance } = useAppearance();
  if (appearance === "a") {
    return (
      <Group gap={6} wrap="nowrap">
        <HoneyPot size={28} />
        <Text fw={800} fz="lg" lts={-0.3}>
          Extract
        </Text>
      </Group>
    );
  }
  return (
    <Group gap={8} wrap="nowrap">
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="var(--mantine-primary-color-filled)" />
        <path d="M20 18h24v6H27v5h14v6H27v5h17v6H20z" fill="#fff" />
      </svg>
      <Text ff="heading" fw={700} fz="xl" lts={-0.4}>
        Extract
      </Text>
    </Group>
  );
};

export default Logo;
