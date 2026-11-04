import { useMemo, useState } from "react";
import {
  Badge,
  Card,
  Center,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import dayjs from "dayjs";
import { IconPigMoney, IconReceipt2, IconWallet } from "@tabler/icons-react";
import StatCard from "../components/StatCard";
import { useCurrentUser } from "../context/UserContext";
import { useRangeTransactions } from "../hooks/useMonthTransactions";
import { expensesOf, incomeOf, sumAmounts } from "../lib/transactions";

const Reports = () => {
  const { categories, formatMoney } = useCurrentUser();
  const [months, setMonths] = useState("6");
  const count = Number(months);

  // whole months, ending with the current one
  const end = dayjs().endOf("month");
  const start = dayjs().startOf("month").subtract(count - 1, "month");
  const { transactions, spent, income, loading, error } = useRangeTransactions(start, end);

  const monthKeys = Array.from({ length: count }, (_, i) => start.add(i, "month"));

  const data = useMemo(() => {
    const byMonth = monthKeys.map((m) => {
      const inMonth = transactions.filter((t) => dayjs(t.createdAt).isSame(m, "month"));
      const expenses = expensesOf(inMonth);
      const row: Record<string, string | number> = {
        month: m.format("MMM YY"),
        Spent: sumAmounts(expenses),
        Income: sumAmounts(incomeOf(inMonth)),
      };
      // keyed by category value so a category can't clash with the Spent/Income series
      for (const c of categories) row[`cat_${c.value}`] = sumAmounts(expenses.filter((t) => t.category === c.value));
      return row;
    });

    // this month so far vs the same days of last month
    const today = dayjs();
    const lastMonth = today.subtract(1, "month");
    const lastMonthSoFar = expensesOf(transactions).filter(
      (t) => dayjs(t.createdAt).isSame(lastMonth, "month") && dayjs(t.createdAt).date() <= today.date()
    );

    const categoryRows = categories
      .map((c) => {
        const perMonth = byMonth.map((r) => Number(r[`cat_${c.value}`]));
        const total = perMonth.reduce((a, b) => a + b, 0);
        const last = perMonth[perMonth.length - 1];
        const prev = sumAmounts(lastMonthSoFar.filter((t) => t.category === c.value));
        return { ...c, total, average: total / count, last, prev };
      })
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);

    return { byMonth, categoryRows };
    // monthKeys is derived from count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories, count]);

  const usedCategories = data.categoryRows.map((c) => ({ name: `cat_${c.value}`, label: c.label, color: c.color }));
  const net = income - spent;
  const savingsRate = income > 0 ? (net / income) * 100 : null;

  return (
    <Stack p={{ base: "md", md: "xl" }} gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Reports</Title>
          <Text c="dimmed" size="sm">
            How your money moved over the last few months.
          </Text>
        </div>
        <SegmentedControl
          aria-label="Period"
          value={months}
          onChange={setMonths}
          data={[
            { value: "3", label: "3 months" },
            { value: "6", label: "6 months" },
            { value: "12", label: "12 months" },
          ]}
        />
      </Group>

      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : error ? (
        <Text c="red">Unable to load transactions. Please try again later.</Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            <StatCard label={`Spent in ${count} months`} icon={<IconReceipt2 size={20} />}>
              <Title order={2}>{formatMoney(spent)}</Title>
              <Text size="sm" c="dimmed">
                {formatMoney(spent / count)} per month on average
              </Text>
            </StatCard>
            <StatCard label="Income" icon={<IconWallet size={20} />} color="teal">
              <Title order={2} c="teal">
                +{formatMoney(income)}
              </Title>
              <Text size="sm" c="dimmed">
                {formatMoney(income / count)} per month on average
              </Text>
            </StatCard>
            <StatCard label="Net saved" icon={<IconPigMoney size={20} />} color="pink">
              <Title order={2} c={net < 0 ? "red" : undefined}>
                {formatMoney(net)}
              </Title>
              <Text size="sm" c="dimmed">
                {savingsRate === null ? "No income recorded" : `${Math.round(savingsRate)}% of income`}
              </Text>
            </StatCard>
          </SimpleGrid>

          <StatCard label="Income vs spending">
            <BarChart
              h={260}
              data={data.byMonth}
              dataKey="month"
              series={[
                { name: "Income", color: "teal.6" },
                { name: "Spent", color: "red.6" },
              ]}
              valueFormatter={formatMoney}
              withLegend
            />
          </StatCard>

          {usedCategories.length > 0 && (
            <StatCard label="Spending by category">
              <BarChart
                h={300}
                data={data.byMonth}
                dataKey="month"
                type="stacked"
                series={usedCategories}
                valueFormatter={formatMoney}
                withLegend
              />
            </StatCard>
          )}

          {data.categoryRows.length > 0 && (
            <Card padding={0} shadow="xs">
            <Table.ScrollContainer minWidth={520}>
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Category</Table.Th>
                    <Table.Th ta="right">Total</Table.Th>
                    <Table.Th ta="right">Monthly average</Table.Th>
                    <Table.Th ta="right">This month so far</Table.Th>
                    <Table.Th ta="right">vs same days last month</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.categoryRows.map((c) => {
                    const change = c.prev > 0 ? ((c.last - c.prev) / c.prev) * 100 : null;
                    return (
                      <Table.Tr key={c.value}>
                        <Table.Td>
                          <Badge variant="light" color={c.color}>
                            {c.label}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">{formatMoney(c.total)}</Table.Td>
                        <Table.Td ta="right">{formatMoney(c.average)}</Table.Td>
                        <Table.Td ta="right">{formatMoney(c.last)}</Table.Td>
                        <Table.Td ta="right" c={change === null ? "dimmed" : change > 0 ? "red" : "teal"}>
                          {change === null ? "—" : `${change > 0 ? "+" : ""}${Math.round(change)}%`}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            </Card>
          )}
          <Text size="xs" c="dimmed">
            The current month is included up to today, and compared with the same days of last month.
          </Text>
        </>
      )}
    </Stack>
  );
};

export default Reports;
