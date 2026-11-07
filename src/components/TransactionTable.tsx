import { useMemo, useState } from "react";
import { Anchor, Badge, Box, Card, Checkbox, ColorSwatch, Divider, Group, NativeSelect, Stack, Table, Text, ThemeIcon, Tooltip, UnstyledButton, useMantineTheme } from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconReceipt, IconRepeat, IconSelector } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router";
import { findCategory, formatWhen } from "../lib/transactions";
import type { Transaction } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";
import { useAppearance } from "../theme/Appearance";
import { useIsMobile } from "../hooks/useIsMobile";
import { HoneyPot } from "./Pooh";

type SortKey = "name" | "category" | "amount" | "date";

interface Props {
  transactions: Transaction[];
  emptyText: string;
  // pass both to show checkboxes for bulk actions
  selected?: Set<string>;
  onSelectedChange?: (selected: Set<string>) => void;
}

const SortHeader = ({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
  align?: "right";
}) => {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.desc ? IconChevronDown : IconChevronUp) : IconSelector;
  return (
    <Table.Th
      ta={align}
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
    >
      <UnstyledButton onClick={() => onSort(sortKey)} fw={700} fz="sm">
        <Group gap={4} justify={align === "right" ? "flex-end" : "flex-start"} wrap="nowrap">
          {label}
          <Icon size={14} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
};

const TransactionTable = ({ transactions, emptyText, selected, onSelectedChange }: Props) => {
  const selectable = !!selected && !!onSelectedChange;
  const navigate = useNavigate();
  const { sqid, categories, formatMoney } = useCurrentUser();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "date", desc: true });
  const { appearance } = useAppearance();
  const isMobile = useIsMobile();
  const theme = useMantineTheme();

  const onSort = (key: SortKey) =>
    setSort((s) => ({ key, desc: s.key === key ? !s.desc : key === "date" || key === "amount" }));

  const sorted = useMemo(() => {
    const value = (t: Transaction) =>
      sort.key === "amount"
        ? t.amount
        : sort.key === "date"
          ? t.createdAt
          : sort.key === "category"
            ? findCategory(categories, t.category).label.toLowerCase()
            : t.name.toLowerCase();
    return [...transactions].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -cmp : cmp;
    });
  }, [transactions, sort, categories]);

  if (!transactions.length) {
    return (
      <Card padding="xl">
        <Stack align="center" gap="xs" py="lg">
          {appearance === "a" ? (
            <HoneyPot size={64} fill={0} title="An empty honey pot" />
          ) : (
            <ThemeIcon size={52} radius="xl" variant="light">
              <IconReceipt size={28} />
            </ThemeIcon>
          )}
          <Text c="dimmed" ta="center">
            {emptyText}
          </Text>
        </Stack>
      </Card>
    );
  }

  const headerProps = { sort, onSort };
  const allSelected = selectable && sorted.every((t) => selected!.has(t.uuid));
  const someSelected = selectable && sorted.some((t) => selected!.has(t.uuid));
  const toggle = (uuid: string) => {
    const next = new Set(selected);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    onSelectedChange!(next);
  };

  // phones: a tappable list instead of a table that would scroll sideways
  if (isMobile) {
    const swatch = (color: string) => {
      const [name, shade] = color.split(".");
      return theme.colors[name]?.[Number(shade ?? 6)] ?? theme.colors.gray[6];
    };
    const SORTS = [
      { value: "date-desc", label: "Newest first" },
      { value: "date-asc", label: "Oldest first" },
      { value: "amount-desc", label: "Largest first" },
      { value: "name-asc", label: "Name A–Z" },
    ];
    return (
      <Card padding={0} shadow="xs">
        <Group justify="space-between" px="md" py="xs" wrap="nowrap">
          {selectable ? (
            <Checkbox
              label="Select all"
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onChange={() => onSelectedChange!(allSelected ? new Set() : new Set(sorted.map((t) => t.uuid)))}
            />
          ) : (
            <Text size="sm" c="dimmed">
              {transactions.length} transaction{transactions.length === 1 ? "" : "s"}
            </Text>
          )}
          <NativeSelect
            aria-label="Sort"
            size="xs"
            variant="unstyled"
            data={SORTS}
            value={`${sort.key}-${sort.desc ? "desc" : "asc"}`}
            onChange={(e) => {
              const [key, dir] = e.currentTarget.value.split("-");
              setSort({ key: key as SortKey, desc: dir === "desc" });
            }}
          />
        </Group>
        <Divider />
        {sorted.map((t, i) => {
          const to = `/transactions/${sqid}/${t.uuid}`;
          const category = findCategory(categories, t.category);
          const isSelected = selectable && selected!.has(t.uuid);
          return (
            <Box key={t.uuid} bg={isSelected ? "var(--mantine-primary-color-light)" : undefined}>
              {i > 0 && <Divider />}
              <Group gap={0} wrap="nowrap" pl={selectable ? "md" : 0}>
                {selectable && (
                  <Checkbox aria-label={`Select ${t.name}`} checked={isSelected} onChange={() => toggle(t.uuid)} />
                )}
                <UnstyledButton
                  component={Link}
                  to={to}
                  data-testid="transaction-item"
                  px="md"
                  py={10}
                  mih={60}
                  style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={6} wrap="nowrap">
                      <Text fw={600} truncate>
                        {t.name}
                      </Text>
                      {t.recurring && <IconRepeat size={14} aria-label="Recurring" style={{ flexShrink: 0 }} />}
                    </Group>
                    <Group gap={6} wrap="nowrap">
                      <ColorSwatch color={swatch(category.color)} size={8} withShadow={false} />
                      <Text size="xs" c="dimmed" truncate>
                        {category.label} · {formatWhen(t, false)}
                      </Text>
                    </Group>
                  </div>
                  <Text fw={700} c={t.type === "income" ? "teal" : undefined} className="tabular" style={{ flexShrink: 0 }}>
                    {t.type === "income" ? "+" : ""}
                    {formatMoney(t.amount)}
                  </Text>
                </UnstyledButton>
              </Group>
            </Box>
          );
        })}
      </Card>
    );
  }

  return (
    <Card padding={0} shadow="xs">
    <Table.ScrollContainer minWidth={560}>
      <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            {selectable && (
              <Table.Th w={40}>
                <Checkbox
                  aria-label="Select all"
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={() => onSelectedChange!(allSelected ? new Set() : new Set(sorted.map((t) => t.uuid)))}
                />
              </Table.Th>
            )}
            <SortHeader label="Name" sortKey="name" {...headerProps} />
            <SortHeader label="Category" sortKey="category" {...headerProps} />
            <SortHeader label="Amount" sortKey="amount" align="right" {...headerProps} />
            <SortHeader label="Date" sortKey="date" {...headerProps} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.map((t) => {
            const to = `/transactions/${sqid}/${t.uuid}`;
            const category = findCategory(categories, t.category);
            return (
              // the row is clickable with a mouse; the name link makes it reachable by keyboard
              <Table.Tr
                key={t.uuid}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(to)}
                bg={selectable && selected!.has(t.uuid) ? "var(--mantine-primary-color-light)" : undefined}
              >
                {selectable && (
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label={`Select ${t.name}`} checked={selected!.has(t.uuid)} onChange={() => toggle(t.uuid)} />
                  </Table.Td>
                )}
                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    <Anchor component={Link} to={to} c="inherit" fz="sm" onClick={(e) => e.stopPropagation()}>
                      {t.name}
                    </Anchor>
                    {t.recurring && (
                      <Tooltip label="Recurring">
                        <IconRepeat size={14} aria-label="Recurring" />
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={category.color}>
                    {category.label}
                  </Badge>
                </Table.Td>
                <Table.Td
                  ta="right"
                  c={t.type === "income" ? "teal" : undefined}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {t.type === "income" ? "+" : ""}
                  {formatMoney(t.amount)}
                </Table.Td>
                <Table.Td>{formatWhen(t)}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
    </Card>
  );
};

export default TransactionTable;
