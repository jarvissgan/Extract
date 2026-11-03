import { Center, Loader, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { BarChart } from "@mantine/charts";
import MonthHeader from "../components/MonthHeader";
import StatCard from "../components/StatCard";
import TransactionTable from "../components/TransactionTable";
import { useMonthTransactions, useSelectedMonth } from "../hooks/useMonthTransactions";
import { CATEGORIES, formatMoney } from "../lib/transactions";
import dayjs from "dayjs";

const Transactions = () => {
  const { month, setMonth } = useSelectedMonth();
  const { transactions, total, loading, error } = useMonthTransactions(month);
  const monthName = month.format("MMMM YYYY");

  const daily = Array.from({ length: month.daysInMonth() }, (_, i) => ({
    day: String(i + 1),
    Spent: 0,
  }));
  transactions.forEach((t) => {
    const d = dayjs(t.createdAt);
    if (d.isSame(month, "month")) daily[d.date() - 1].Spent += t.amount;
  });

  const largest = transactions.reduce<(typeof transactions)[number] | null>(
    (max, t) => (!max || t.amount > max.amount ? t : max),
    null
  );
  const topCategory = CATEGORIES.map((c) => ({
    label: c.label,
    value: transactions.filter((t) => t.category === c.value).reduce((s, t) => s + t.amount, 0),
  })).sort((a, b) => b.value - a.value)[0];
  const average = transactions.length ? total / transactions.length : 0;

  return (
    <Stack p={{ base: "md", md: "xl" }} gap="lg">
      <MonthHeader title="Transactions" month={month} onMonthChange={setMonth} />

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

            <StatCard label="Daily spending">
              <BarChart
                h={90}
                data={daily}
                dataKey="day"
                series={[{ name: "Spent", color: "blue.6" }]}
                withXAxis={false}
                withYAxis={false}
                gridAxis="none"
                valueFormatter={formatMoney}
              />
            </StatCard>

            <StatCard label="Insights">
              {transactions.length ? (
                <Stack gap={4}>
                  <Text size="sm">
                    Largest: <b>{largest?.name}</b> ({formatMoney(largest?.amount ?? 0)})
                  </Text>
                  <Text size="sm">
                    Top category: <b>{topCategory.label}</b> ({formatMoney(topCategory.value)})
                  </Text>
                  <Text size="sm">
                    Average per transaction: <b>{formatMoney(average)}</b>
                  </Text>
                </Stack>
              ) : (
                <Text c="dimmed">No insights yet for this month.</Text>
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

export default Transactions;
