import { Box, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useCurrentUser } from "../context/UserContext";
import type { Transaction } from "../lib/types";
import { expensesOf, sumAmounts } from "../lib/transactions";

// Where the month's money went, largest first. A category with a budget shows its bar
// against that budget (amber near it, red over it); the rest are compared with the
// biggest category.
const CategoryBreakdown = ({ transactions }: { transactions: Transaction[] }) => {
  const { categories, categoryBudgets, formatMoney } = useCurrentUser();
  const expenses = expensesOf(transactions);
  const rows = categories
    .map((c) => {
      const spent = sumAmounts(expenses.filter((t) => t.category === c.value));
      const budget = categoryBudgets[c.value] > 0 ? categoryBudgets[c.value] : null;
      return { key: c.value, label: c.label, color: c.color, spent, budget };
    })
    .filter((r) => r.spent > 0 || r.budget)
    .sort((a, b) => b.spent - a.spent);
  const biggest = Math.max(...rows.map((r) => r.spent), 1);

  return (
    <Card padding="lg">
      <Text fw={600} mb="md">
        Where it went
      </Text>
      {rows.length === 0 ? (
        <Text c="dimmed">Nothing spent yet this month. Add a transaction and it shows up here by category.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" verticalSpacing="md">
          {rows.map((r) => {
            const percent = r.budget ? (r.spent / r.budget) * 100 : (r.spent / biggest) * 100;
            const barColor = !r.budget
              ? `var(--mantine-color-${r.color.replace(".", "-")})`
              : percent >= 100
                ? "var(--mantine-color-red-filled)"
                : percent >= 80
                  ? "var(--mantine-color-yellow-filled)"
                  : "var(--mantine-primary-color-filled)";
            return (
              <Stack key={r.key} gap={6} data-testid="category-row">
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={500} truncate>
                    {r.label}
                  </Text>
                  <Text className="tabular" c={r.budget && percent >= 100 ? "red" : undefined} style={{ flexShrink: 0 }}>
                    {formatMoney(r.spent)}
                    {r.budget && (
                      <Text span c="dimmed">
                        {" "}
                        of {formatMoney(r.budget)}
                      </Text>
                    )}
                  </Text>
                </Group>
                <Box
                  h={8}
                  style={{ borderRadius: 999, background: "var(--mantine-color-default-border)", overflow: "hidden" }}
                  role="progressbar"
                  aria-label={r.budget ? `${r.label} budget used` : `${r.label} share of spending`}
                  aria-valuenow={Math.round(Math.min(100, percent))}
                >
                  <Box h="100%" w={`${Math.min(100, percent)}%`} style={{ background: barColor, borderRadius: 999 }} />
                </Box>
              </Stack>
            );
          })}
        </SimpleGrid>
      )}
    </Card>
  );
};

export default CategoryBreakdown;
