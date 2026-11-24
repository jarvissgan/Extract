import type { ReactNode } from "react";
import { Card, Text } from "@mantine/core";

interface Props {
  label: string;
  // kept for existing callers; the cards no longer show decorative icons
  icon?: ReactNode;
  color?: string;
  children: ReactNode;
}

// A quiet labelled panel: a small sentence-case label, then the content.
const StatCard = ({ label, children }: Props) => (
  <Card padding="lg" h="100%">
    <Text size="sm" c="dimmed" fw={500} mb={6}>
      {label}
    </Text>
    {children}
  </Card>
);

export default StatCard;
