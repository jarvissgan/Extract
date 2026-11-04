import type { ReactNode } from "react";
import { Card, Group, Text, ThemeIcon } from "@mantine/core";

interface Props {
  label: string;
  icon?: ReactNode;
  color?: string;
  children: ReactNode;
}

const StatCard = ({ label, icon, color, children }: Props) => (
  <Card padding="lg" shadow="xs" className="lift" h="100%">
    <Group justify="space-between" align="flex-start" mb="sm" wrap="nowrap">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.4} style={{ minWidth: 0 }}>
        {label}
      </Text>
      {icon && (
        <ThemeIcon variant="light" color={color} radius="md" size="lg" visibleFrom="xs">
          {icon}
        </ThemeIcon>
      )}
    </Group>
    {children}
  </Card>
);

export default StatCard;
