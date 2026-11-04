import { useMemo, useState } from "react";
import {
  Button,
  Center,
  Group,
  Loader,
  MultiSelect,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { useDisclosure } from "@mantine/hooks";
import { IconDownload, IconSearch, IconUpload } from "@tabler/icons-react";
import dayjs from "dayjs";
import ImportModal from "../components/ImportModal";
import MonthHeader from "../components/MonthHeader";
import StatCard from "../components/StatCard";
import TransactionTable from "../components/TransactionTable";
import { useCurrentUser } from "../context/UserContext";
import { useMonthTransactions, useSelectedMonth } from "../hooks/useMonthTransactions";
import { downloadFile, transactionsToCsv } from "../lib/csv";
import { findCategory } from "../lib/transactions";

const Transactions = () => {
  const { categories, formatMoney } = useCurrentUser();
  const { month, setMonth } = useSelectedMonth();
  const { transactions, loading, error } = useMonthTransactions(month);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [importOpened, importModal] = useDisclosure(false);
  const monthName = month.format("MMMM YYYY");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (!needle || t.name.toLowerCase().includes(needle) || t.note.toLowerCase().includes(needle)) &&
        (!selectedCategories.length || selectedCategories.includes(t.category))
    );
  }, [transactions, search, selectedCategories]);

  const isFiltered = filtered.length !== transactions.length;
  const total = filtered.reduce((sum, t) => sum + t.amount, 0);

  const daily = Array.from({ length: month.daysInMonth() }, (_, i) => ({ day: String(i + 1), Spent: 0 }));
  filtered.forEach((t) => {
    const d = dayjs(t.createdAt);
    if (d.isSame(month, "month")) daily[d.date() - 1].Spent += t.amount;
  });

  const largest = filtered.reduce<(typeof filtered)[number] | null>(
    (max, t) => (!max || t.amount > max.amount ? t : max),
    null
  );
  const topCategory = categories
    .map((c) => ({
      label: c.label,
      value: filtered.filter((t) => t.category === c.value).reduce((s, t) => s + t.amount, 0),
    }))
    .sort((a, b) => b.value - a.value)[0];
  const average = filtered.length ? total / filtered.length : 0;

  const exportCsv = () =>
    downloadFile(`transactions-${month.format("YYYY-MM")}.csv`, transactionsToCsv(filtered, categories));

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
            <StatCard label={`${isFiltered ? "Filtered spending" : "Spending"} for ${monthName}`}>
              <Title order={2}>{formatMoney(total)}</Title>
              <Text size="sm" c="dimmed">
                {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
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
              {filtered.length ? (
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

          <TransactionTable
            transactions={filtered}
            emptyText={
              isFiltered || search || selectedCategories.length
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
