import type { ReactNode } from "react";
import { Card, Text } from "@mantine/core";

interface Props {
  label: string;
  children: ReactNode;
}

const StatCard = ({ label, children }: Props) => (
  <Card withBorder radius="md" padding="lg">
    <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">
      {label}
    </Text>
    {children}
  </Card>
);

export default StatCard;
