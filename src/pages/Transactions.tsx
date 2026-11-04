import { useMemo, useState } from "react";
import {
  Button,
  Center,
  Group,
  Loader,
  MultiSelect,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconBulb, IconCalendarStats, IconDownload, IconReceipt2, IconSearch, IconTrash, IconUpload } from "@tabler/icons-react";
import api from "../lib/api";
import dayjs from "dayjs";
import ImportModal from "../components/ImportModal";
import MonthHeader from "../components/MonthHeader";
import QuickAddBar from "../components/QuickAddBar";
import StatCard from "../components/StatCard";
import TransactionTable from "../components/TransactionTable";
import { useCurrentUser } from "../context/UserContext";
import { useMonthTransactions, useSelectedMonth } from "../hooks/useMonthTransactions";
import { downloadFile, transactionsToCsv } from "../lib/csv";
import { expensesOf, findCategory, incomeOf, sumAmounts } from "../lib/transactions";

const Transactions = () => {
  const { categories, formatMoney, notifyTransactionsChanged } = useCurrentUser();
  const { month, setMonth } = useSelectedMonth();
  const { transactions, loading, error } = useMonthTransactions(month);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpened, importModal] = useDisclosure(false);
  const monthName = month.format("MMMM YYYY");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (!needle || t.name.toLowerCase().includes(needle) || t.note.toLowerCase().includes(needle)) &&
        (!selectedCategories.length || selectedCategories.includes(t.category)) &&
        (typeFilter === "all" || t.type === typeFilter)
    );
  }, [transactions, search, selectedCategories, typeFilter]);

  // only act on rows that are still visible
  const visibleSelected = new Set(filtered.filter((t) => selected.has(t.uuid)).map((t) => t.uuid));

  const isFiltered = filtered.length !== transactions.length;
  const filteredExpenses = expensesOf(filtered);
  const total = sumAmounts(filteredExpenses);
  const income = sumAmounts(incomeOf(filtered));

  const runBulk = async (body: { action: "delete" } | { action: "categorize"; category: string }) => {
    try {
      const res = await api.post<{ affected: number }>("/transaction/bulk", { ...body, uuids: [...visibleSelected] });
      notifications.show({
        message: `${body.action === "delete" ? "Deleted" : "Updated"} ${res.data.affected} transaction${res.data.affected === 1 ? "" : "s"}.`,
        color: "green",
      });
      setSelected(new Set());
      notifyTransactionsChanged();
    } catch {
      notifications.show({ message: "Couldn't update those transactions. Try again later.", color: "red" });
    }
  };

  const confirmBulkDelete = () =>
    modals.openConfirmModal({
      title: "Delete transactions",
      centered: true,
      children: <Text size="sm">Delete {visibleSelected.size} selected transactions? This can&apos;t be undone.</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => runBulk({ action: "delete" }),
    });

  const daily = Array.from({ length: month.daysInMonth() }, (_, i) => ({ day: String(i + 1), Spent: 0 }));
  filteredExpenses.forEach((t) => {
    const d = dayjs(t.createdAt);
    if (d.isSame(month, "month")) daily[d.date() - 1].Spent += t.amount;
  });

  const largest = filteredExpenses.reduce<(typeof filtered)[number] | null>(
    (max, t) => (!max || t.amount > max.amount ? t : max),
    null
  );
  const topCategory = categories
    .map((c) => ({
      label: c.label,
      value: sumAmounts(filteredExpenses.filter((t) => t.category === c.value)),
    }))
    .sort((a, b) => b.value - a.value)[0];
  const average = filteredExpenses.length ? total / filteredExpenses.length : 0;

  const exportCsv = () =>
    downloadFile(`transactions-${month.format("YYYY-MM")}.csv`, transactionsToCsv(filtered, categories));

  return (
    <Stack p={{ base: "md", md: "xl" }} gap="lg">
      <MonthHeader title="Transactions" month={month} onMonthChange={setMonth} />
      <QuickAddBar />

      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : error ? (
        <Text c="red">Unable to load transactions. Please try again later.</Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <StatCard label={`${isFiltered ? "Filtered spending" : "Spending"} for ${monthName}`} icon={<IconReceipt2 size={20} />}>
              <Title order={2}>{formatMoney(total)}</Title>
              <Text size="sm" c="dimmed">
                {filteredExpenses.length} expense{filteredExpenses.length === 1 ? "" : "s"}
                {income > 0 && (
                  <Text span c="teal" size="sm">
                    {" "}· +{formatMoney(income)} income
                  </Text>
                )}
              </Text>
            </StatCard>

            <StatCard label="Daily spending" icon={<IconCalendarStats size={20} />} color="blue">
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

            <StatCard label="Insights" icon={<IconBulb size={20} />} color="yellow">
              {filteredExpenses.length ? (
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

          <Group justify="space-between" align="flex-end">
            <Group align="flex-end" gap="sm">
              <SegmentedControl
                aria-label="Type"
                value={typeFilter}
                onChange={setTypeFilter}
                data={[
                  { value: "all", label: "All" },
                  { value: "expense", label: "Expenses" },
                  { value: "income", label: "Income" },
                ]}
              />
              <TextInput
                aria-label="Search transactions"
                placeholder="Search name or note"
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                w={220}
              />
              <MultiSelect
                aria-label="Filter by category"
                placeholder={selectedCategories.length ? undefined : "All categories"}
                data={categories.map(({ value, label }) => ({ value, label }))}
                value={selectedCategories}
                onChange={setSelectedCategories}
                clearable
                w={260}
              />
            </Group>
            <Group gap="xs">
              <Button variant="default" leftSection={<IconUpload size={16} />} onClick={importModal.open}>
                Import CSV
              </Button>
              <Button
                variant="default"
                leftSection={<IconDownload size={16} />}
                onClick={exportCsv}
                disabled={!filtered.length}
              >
                Export CSV
              </Button>
            </Group>
          </Group>

          {visibleSelected.size > 0 && (
            <Paper withBorder p="sm" shadow="sm">
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  {visibleSelected.size} selected
                </Text>
                <Group gap="xs">
                  <Select
                    aria-label="Move to category"
                    placeholder="Move to category…"
                    data={categories.map(({ value, label }) => ({ value, label }))}
                    value={null}
                    onChange={(value) => value && runBulk({ action: "categorize", category: value })}
                    w={200}
                  />
                  <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={confirmBulkDelete}>
                    Delete
                  </Button>
                  <Button variant="subtle" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </Group>
              </Group>
            </Paper>
          )}

          <TransactionTable
            selected={visibleSelected}
            onSelectedChange={setSelected}
            transactions={filtered}
            emptyText={
              isFiltered || search || selectedCategories.length || typeFilter !== "all"
                ? "No transactions match your filters."
                : `No transactions for ${monthName}.`
            }
          />
          {selectedCategories.length > 0 && (
            <Text size="xs" c="dimmed">
              Showing {selectedCategories.map((c) => findCategory(categories, c).label).join(", ")}
            </Text>
          )}
        </>
      )}

      <ImportModal opened={importOpened} onClose={importModal.close} />
    </Stack>
  );
};

export default Transactions;
