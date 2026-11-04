import { useAuth0 } from "@auth0/auth0-react";
import { Center, Group, Loader, Progress, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { DonutChart } from "@mantine/charts";
import dayjs from "dayjs";
import MonthHeader from "../components/MonthHeader";
import StatCard from "../components/StatCard";
import TransactionTable from "../components/TransactionTable";
import { useCurrentUser } from "../context/UserContext";
import { useMonthTransactions, useSelectedMonth } from "../hooks/useMonthTransactions";

const Home = () => {
  const { user } = useAuth0();
  const { monthlyBudget, categories, formatMoney } = useCurrentUser();
  const { month, setMonth } = useSelectedMonth();
  const { transactions, total, loading, error } = useMonthTransactions(month);

  const isCurrentMonth = month.isSame(dayjs(), "month");
  const monthName = month.format("MMMM YYYY");

  const byCategory = categories.map((c) => ({
    name: c.label,
    color: c.color,
    value: transactions.filter((t) => t.category === c.value).reduce((s, t) => s + t.amount, 0),
  })).filter((c) => c.value > 0);

  const remaining = monthlyBudget !== null ? monthlyBudget - total : null;
  const usedPercent =
    monthlyBudget && monthlyBudget > 0 ? Math.min(100, (total / monthlyBudget) * 100) : 0;

  return (
    <Stack p={{ base: "md", md: "xl" }} gap="lg">
      <MonthHeader title={`Hello, ${user?.given_name || user?.name || "there"}`} month={month} onMonthChange={setMonth} />

      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : error ? (
        <Text c="red">Unable to load transactions. Please try again later.</Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <StatCard label={`Spending for ${monthName}`}>
              <Title order={2}>{formatMoney(total)}</Title>
              <Text size="sm" c="dimmed">
                {transactions.length} transaction{transactions.length === 1 ? "" : "s"}
              </Text>
            </StatCard>

            <StatCard label={isCurrentMonth ? "Budget remaining" : "Budget"}>
              {monthlyBudget === null || remaining === null ? (
                <Text c="dimmed">No monthly budget set.</Text>
              ) : (
                <Stack gap="xs">
                  <Group gap={6} align="baseline">
                    <Title order={2} c={remaining < 0 ? "red" : undefined}>
                      {formatMoney(remaining)}
                    </Title>
                    <Text size="sm" c="dimmed">
                      of {formatMoney(monthlyBudget)}
                    </Text>
                  </Group>
                  <Progress
                    value={usedPercent}
                    color={remaining < 0 ? "red" : usedPercent > 80 ? "yellow" : "teal"}
                    aria-label="Budget used"
                  />
                </Stack>
              )}
            </StatCard>

            <StatCard label="Spending by category">
              {byCategory.length ? (
                <Group wrap="nowrap" gap="md">
                  <DonutChart
                    data={byCategory}
                    size={110}
                    thickness={16}
                    withTooltip
                    valueFormatter={formatMoney}
                  />
                  <Stack gap={4}>
                    {byCategory.map((c) => (
                      <Text key={c.name} size="sm">
                        <Text span c={c.color} fw={700}>
                          ●
                        </Text>{" "}
                        {c.name}: {formatMoney(c.value)}
                      </Text>
                    ))}
                  </Stack>
                </Group>
              ) : (
                <Text c="dimmed">Nothing spent yet.</Text>
              )}
            </StatCard>
          </SimpleGrid>

          <TransactionTable
            transactions={transactions}
            emptyText={`No transactions for ${monthName}.`}
          />
        </>
      )}
    </Stack>
  );
};

export default Home;
