import { Group, Text } from "@mantine/core";
import { useAppearance } from "../theme/Appearance";

const Logo = () => {
  const { appearance } = useAppearance();
  const [from, to] = appearance === "a" ? ["#f06595", "#fcc419"] : ["#7c5cff", "#f06595"];
  return (
    <Group gap={8} wrap="nowrap">
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#logo-gradient)" />
        <path d="M20 18h24v6H27v5h14v6H27v5h17v6H20z" fill="#fff" />
      </svg>
      <Text fw={800} fz="lg" lts={-0.3}>
        Extract
      </Text>
    </Group>
  );
};

export default Logo;
