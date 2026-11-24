import { useAuth0 } from "@auth0/auth0-react";
import { Card, Center, Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight } from "@tabler/icons-react";
import dayjs from "dayjs";
import BudgetPace from "../components/BudgetPace";
import CategoryBreakdown from "../components/CategoryBreakdown";
import MonthHeader from "../components/MonthHeader";
import QuickAddBar from "../components/QuickAddBar";
import TransactionTable from "../components/TransactionTable";
import { useCurrentUser } from "../context/UserContext";
import { useMonthTransactions, useSelectedMonth } from "../hooks/useMonthTransactions";
import { expensesOf, findCategory, sumAmounts } from "../lib/transactions";

// One figure in the totals row under the budget.
const Figure = ({ label, value, color, note }: { label: string; value: string; color?: string; note?: React.ReactNode }) => (
  <Stack gap={4}>
    <Text size="sm" c="dimmed" fw={500}>
      {label}
    </Text>
    <Text className="amount" fz={{ base: 22, sm: 28 }} fw={700} c={color}>
      {value}
    </Text>
    {note}
  </Stack>
);

// Home: the budget answer first, then adding a transaction, the month's totals, where the
// money went, and the transactions themselves.
const Home = () => {
  const { user: authUser } = useAuth0();
  const { user, categoryBudgets, categories, formatMoney } = useCurrentUser();
  // the name chosen in setup or Settings; the login's name only until the account exists
  const firstName = user?.username?.trim().split(/\s+/)[0] || authUser?.given_name || authUser?.name || "there";
  const { month, setMonth } = useSelectedMonth();
  const { transactions, spent, income, loading, error } = useMonthTransactions(month);
  const previous = useMonthTransactions(month.subtract(1, "month"));

  const isCurrentMonth = month.isSame(dayjs(), "month");
  const expenses = expensesOf(transactions);
  const net = income - spent;

  // compare with the same point in the previous month when looking at the current month
  const dayOfMonth = isCurrentMonth ? dayjs().date() : month.daysInMonth();
  const previousSoFar = sumAmounts(
    expensesOf(previous.transactions).filter((t) => dayjs(t.createdAt).date() <= dayOfMonth)
  );
  const change = previousSoFar > 0 ? ((spent - previousSoFar) / previousSoFar) * 100 : null;

  const overCategories = Object.entries(categoryBudgets)
    .filter(([key, budget]) => budget > 0 && sumAmounts(expenses.filter((t) => t.category === key)) >= budget)
    .map(([key]) => findCategory(categories, key).label);

  return (
    <Stack p={{ base: "md", md: "xl" }} gap="lg" maw={1180}>
      <MonthHeader title={`Hello, ${firstName}`} month={month} onMonthChange={setMonth} />

      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : error ? (
        <Text c="red">Couldn&apos;t load your transactions. Check your connection and refresh the page.</Text>
      ) : (
        <>
          <BudgetPace month={month} spent={spent} overCategories={overCategories} />
          <QuickAddBar />

          <Card padding="lg">
            <SimpleGrid cols={3} spacing={{ base: "sm", sm: "xl" }}>
              <Figure
                label="Spent"
                value={formatMoney(spent)}
                note={
                  change !== null ? (
                    <Group gap={2} c={change > 0 ? "red" : "teal"} wrap="nowrap">
                      {change > 0 ? <IconArrowUpRight size={14} /> : <IconArrowDownRight size={14} />}
                      <Text size="xs" c="inherit">
                        {Math.abs(Math.round(change))}% vs last month
                      </Text>
                    </Group>
                  ) : (
                    <Text size="xs" c="dimmed">
                      {expenses.length} expense{expenses.length === 1 ? "" : "s"}
                    </Text>
                  )
                }
              />
              <Figure label="Income" value={`+${formatMoney(income)}`} color="teal" />
              <Figure label="Net" value={`${net < 0 ? "" : "+"}${formatMoney(net)}`} color={net < 0 ? "red" : undefined} />
            </SimpleGrid>
          </Card>

          <CategoryBreakdown transactions={transactions} />

          <TransactionTable transactions={transactions} emptyText={`No transactions in ${month.format("MMMM YYYY")} yet.`} />
        </>
      )}
    </Stack>
  );
};

export default Home;
