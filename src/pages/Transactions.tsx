import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Center,
  Group,
  Loader,
  Menu,
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
import {
  IconBulb,
  IconCalendarStats,
  IconDownload,
  IconReceipt2,
  IconSearch,
  IconTrash,
  IconUpload,
  IconFileSpreadsheet,
  IconFileTypePdf,
} from "@tabler/icons-react";
import api from "../lib/api";
import dayjs from "dayjs";
import StatementImportModal from "../components/StatementImportModal";
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
  const [statementOpened, statementModal] = useDisclosure(false);
  const monthName = month.format("MMMM YYYY");
  // after an import, show the newest imported month if none of it is in the month on screen
  const showImported = (dates: string[]) => {
    if (!dates.length || dates.some((d) => dayjs(d).isSame(month, "month"))) return;
    setMonth(dates.reduce((a, b) => (a > b ? a : b)));
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (!needle || t.name.toLowerCase().includes(needle) || t.note.toLowerCase().includes(needle)) &&
        (!selectedCategories.length || selectedCategories.includes(t.category)) &&
        (typeFilter === "all" || t.type === typeFilter),
    );
  }, [transactions, search, selectedCategories, typeFilter]);

  // only act on rows that are still visible
  const visibleSelected = new Set(filtered.filter((t) => selected.has(t.uuid)).map((t) => t.uuid));

  const isFiltered = filtered.length !== transactions.length;
  const searchOrCategory = !!search.trim() || selectedCategories.length > 0;
  const filteredExpenses = expensesOf(filtered);
  const filteredIncome = incomeOf(filtered);
  const income = sumAmounts(filteredIncome);
  // the Income filter switches the cards from spending to income
  const showIncome = typeFilter === "income";
  const focus = showIncome ? filteredIncome : filteredExpenses;
  const total = sumAmounts(focus);
  const measure = showIncome ? "income" : "spending";

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

  const seriesName = showIncome ? "Received" : "Spent";
  const totals = Array<number>(month.daysInMonth()).fill(0);
  focus.forEach((t) => {
    const d = dayjs(t.createdAt);
    if (d.isSame(month, "month")) totals[d.date() - 1] += t.amount;
  });
  const daily = totals.map((value, i) => ({ day: String(i + 1), [seriesName]: value }));
  const compactMoney = (v: number) =>
    v >= 1000
      ? `${formatMoney(v / 1000)
          .replace(/\.00$/, "")
          .replace(/(\.\d)0$/, "$1")}k`
      : formatMoney(v).replace(/\.00$/, "");

  const largest = focus.reduce<(typeof filtered)[number] | null>(
    (max, t) => (!max || t.amount > max.amount ? t : max),
    null,
  );
  const topCategory = categories
    .map((c) => ({
      label: c.label,
      value: sumAmounts(focus.filter((t) => t.category === c.value)),
    }))
    .sort((a, b) => b.value - a.value)[0];
  const average = focus.length ? total / focus.length : 0;

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
            <StatCard
              label={`${searchOrCategory ? `Filtered ${measure}` : showIncome ? "Income" : "Spending"} for ${monthName}`}
              icon={<IconReceipt2 size={20} />}
              color={showIncome ? "teal" : undefined}
            >
              <Title order={2} c={showIncome ? "teal" : undefined}>
                {formatMoney(total)}
              </Title>
              <Text size="sm" c="dimmed">
                {focus.length} {showIncome ? "payment" : "expense"}
                {focus.length === 1 ? "" : "s"}
                {!showIncome && income > 0 && (
                  <Text span c="teal" size="sm">
                    {" "}
                    · +{formatMoney(income)} income
                  </Text>
                )}
              </Text>
            </StatCard>

            <Box visibleFrom="sm">
              <StatCard
                label={`Daily ${measure}`}
                icon={<IconCalendarStats size={20} />}
                color={showIncome ? "teal" : "blue"}
              >
                <BarChart
                  h={120}
                  data={daily}
                  dataKey="day"
                  series={[{ name: seriesName, color: showIncome ? "teal.6" : "blue.6" }]}
                  gridAxis="x"
                  tickLine="none"
                  yAxisProps={{ width: 44, tickCount: 3, tickFormatter: compactMoney }}
                  xAxisProps={{ interval: "preserveStartEnd", minTickGap: 8 }}
                  valueFormatter={formatMoney}
                />
              </StatCard>
            </Box>
            {/* phones: keep the list near the top; trends live on Reports */}
            <Box visibleFrom="sm">
              <StatCard label="Insights" icon={<IconBulb size={20} />} color="yellow">
                {focus.length ? (
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
            </Box>
          </SimpleGrid>

          <Group justify="space-between" align="flex-end" gap="sm">
            <Group align="flex-end" gap="sm" w={{ base: "100%", md: "auto" }}>
              <SegmentedControl
                aria-label="Type"
                w={{ base: "100%", xs: "auto" }}
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
                w={{ base: "100%", xs: 220 }}
              />
              <MultiSelect
                aria-label="Filter by category"
                placeholder={selectedCategories.length ? undefined : "All categories"}
                data={categories.map(({ value, label }) => ({ value, label }))}
                value={selectedCategories}
                onChange={setSelectedCategories}
                clearable
                w={{ base: "100%", xs: 260 }}
              />
            </Group>
            <Group gap="xs" grow w={{ base: "100%", md: "auto" }}>
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <Button variant="default" leftSection={<IconUpload size={16} />}>
                    Import
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconFileTypePdf size={16} />} onClick={statementModal.open}>
                    DBS/POSB statement (PDF)
                  </Menu.Item>
                  <Menu.Item leftSection={<IconFileSpreadsheet size={16} />} onClick={importModal.open}>
                    CSV file
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
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
              <Group justify="space-between" gap="xs">
                <Text size="sm" fw={500}>
                  {visibleSelected.size} selected
                </Text>
                <Group gap="xs" w={{ base: "100%", xs: "auto" }} wrap="nowrap">
                  <Select
                    aria-label="Move to category"
                    placeholder="Move to category…"
                    data={categories.map(({ value, label }) => ({ value, label }))}
                    value={null}
                    onChange={(value) => value && runBulk({ action: "categorize", category: value })}
                    style={{ flex: 1 }}
                    w={{ base: "auto", xs: 200 }}
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

      <StatementImportModal format="csv" opened={importOpened} onClose={importModal.close} onImported={showImported} />
      <StatementImportModal opened={statementOpened} onClose={statementModal.close} onImported={showImported} />
    </Stack>
  );
};

export default Transactions;
