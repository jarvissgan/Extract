import { useAuth0 } from "@auth0/auth0-react";
import {
  Alert,
  Box,
  Center,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { DonutChart } from "@mantine/charts";
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconChartDonut,
  IconReceipt2,
  IconTarget,
  IconWallet,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import MonthHeader from "../components/MonthHeader";
import QuickAddBar from "../components/QuickAddBar";
import StatCard from "../components/StatCard";
import TransactionTable from "../components/TransactionTable";
import { useCurrentUser } from "../context/UserContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { useMonthTransactions, useSelectedMonth } from "../hooks/useMonthTransactions";
import { expensesOf, findCategory, sumAmounts } from "../lib/transactions";

const progressColor = (percent: number) => (percent >= 100 ? "red" : percent >= 80 ? "yellow" : "teal");

const Home = () => {
  const { user } = useAuth0();
  const { monthlyBudget, categoryBudgets, categories, formatMoney } = useCurrentUser();
  const { month, setMonth } = useSelectedMonth();
  const { transactions, spent, income, loading, error } = useMonthTransactions(month);
  const previous = useMonthTransactions(month.subtract(1, "month"));
  const isMobile = useIsMobile();

  const isCurrentMonth = month.isSame(dayjs(), "month");
  const monthName = month.format("MMMM YYYY");
  const expenses = expensesOf(transactions);

  // compare with the same point in the previous month when looking at the current month
  const dayOfMonth = isCurrentMonth ? dayjs().date() : month.daysInMonth();
  const previousSoFar = sumAmounts(
    expensesOf(previous.transactions).filter((t) => dayjs(t.createdAt).date() <= dayOfMonth)
  );
  const change = previousSoFar > 0 ? ((spent - previousSoFar) / previousSoFar) * 100 : null;

  const byCategory = categories
    .map((c) => ({
      name: c.label,
      color: c.color,
      value: sumAmounts(expenses.filter((t) => t.category === c.value)),
    }))
    .filter((c) => c.value > 0);

  const remaining = monthlyBudget !== null ? monthlyBudget - spent : null;
  const usedPercent = monthlyBudget && monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0;
  const daysLeft = month.daysInMonth() - dayjs().date();

  const categoryProgress = Object.entries(categoryBudgets)
    .filter(([, budget]) => budget > 0)
    .map(([key, budget]) => {
      const used = sumAmounts(expenses.filter((t) => t.category === key));
      return { key, label: findCategory(categories, key).label, budget, used, percent: (used / budget) * 100 };
    })
    .sort((a, b) => b.percent - a.percent);
  const overCategories = categoryProgress.filter((c) => c.percent >= 100);

  return (
    <Stack p={{ base: "md", md: "xl" }} gap="lg">
      <MonthHeader title={`Hello, ${user?.given_name || user?.name || "there"}`} month={month} onMonthChange={setMonth} />
      <QuickAddBar />

      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : error ? (
        <Text c="red">Unable to load transactions. Please try again later.</Text>
      ) : (
        <>
          {isCurrentMonth && monthlyBudget !== null && usedPercent >= 80 && (
            <Alert
              color={usedPercent >= 100 ? "red" : "yellow"}
              icon={<IconAlertTriangle size={18} />}
              title={usedPercent >= 100 ? "Over budget" : "Close to your budget"}
            >
              {usedPercent >= 100
                ? `You've spent ${formatMoney(spent - monthlyBudget)} more than your ${formatMoney(monthlyBudget)} budget this month.`
                : `You've used ${Math.round(usedPercent)}% of your budget with ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`}
              {overCategories.length > 0 &&
                ` Over budget in: ${overCategories.map((c) => c.label).join(", ")}.`}
            </Alert>
          )}

          {/* phones: the two money totals side by side, wider cards below */}
          <SimpleGrid cols={{ base: 2, lg: 4 }} spacing={{ base: "sm", sm: "lg" }}>
            <StatCard label={`Spent in ${monthName}`} icon={<IconReceipt2 size={20} />}>
              <Title order={2} fz={{ base: "h3", sm: "h2" }} className="tabular">{formatMoney(spent)}</Title>
              {change !== null ? (
                <Group gap={4} c={change > 0 ? "red" : "teal"}>
                  {change > 0 ? <IconArrowUpRight size={16} /> : <IconArrowDownRight size={16} />}
                  <Text size="sm" c="inherit">
                    {Math.abs(Math.round(change))}% vs {isCurrentMonth && !isMobile ? "this point last month" : "last month"}
                  </Text>
                </Group>
              ) : (
                <Text size="sm" c="dimmed">
                  {expenses.length} expense{expenses.length === 1 ? "" : "s"}
                </Text>
              )}
            </StatCard>

            <StatCard label="Income and net" icon={<IconWallet size={20} />} color="teal">
              <Title order={2} fz={{ base: "h3", sm: "h2" }} c="teal" className="tabular">
                +{formatMoney(income)}
              </Title>
              <Text size="sm" c={income - spent < 0 ? "red" : "dimmed"}>
                Net {income - spent < 0 ? "" : "+"}
                {formatMoney(income - spent)}
              </Text>
            </StatCard>

            <Box style={{ gridColumn: isMobile ? "span 2" : undefined }}>
            <StatCard label={isCurrentMonth ? "Budget remaining" : "Budget"} icon={<IconTarget size={20} />} color="orange">
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
                  <Progress value={Math.min(100, usedPercent)} color={progressColor(usedPercent)} aria-label="Budget used" />
                </Stack>
              )}
            </StatCard>

            </Box>
            <Box style={{ gridColumn: isMobile ? "span 2" : undefined }}>
            <StatCard label="Spending by category" icon={<IconChartDonut size={20} />} color="grape">
              {byCategory.length ? (
                <Group wrap="nowrap" gap="md">
                  <DonutChart data={byCategory} size={90} thickness={14} withTooltip valueFormatter={formatMoney} />
                  <Stack gap={2}>
                    {byCategory.slice(0, 4).map((c) => (
                      <Text key={c.name} size="xs">
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
            </Box>
          </SimpleGrid>

          {categoryProgress.length > 0 && (
            <StatCard label="Category budgets">
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" verticalSpacing="sm">
                {categoryProgress.map((c) => (
                  <Stack key={c.key} gap={4}>
                    <Group justify="space-between" gap="xs">
                      <Text size="sm" fw={500}>
                        {c.label}
                      </Text>
                      <Text size="sm" c={c.percent >= 100 ? "red" : "dimmed"}>
                        {formatMoney(c.used)} / {formatMoney(c.budget)}
                      </Text>
                    </Group>
                    <Progress value={Math.min(100, c.percent)} color={progressColor(c.percent)} aria-label={`${c.label} budget used`} />
                  </Stack>
                ))}
              </SimpleGrid>
            </StatCard>
          )}

          <TransactionTable transactions={transactions} emptyText={`No transactions for ${monthName}.`} />
        </>
      )}
    </Stack>
  );
};

export default Home;
