import { useMemo, useState } from "react";
import { Anchor, Badge, Checkbox, Group, Table, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconRepeat, IconSelector } from "@tabler/icons-react";
import { Link, useNavigate } from "react-router";
import { findCategory, formatDateTime } from "../lib/transactions";
import type { Transaction } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";

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
      <Text c="dimmed" ta="center" py="xl">
        {emptyText}
      </Text>
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

  return (
    <Table.ScrollContainer minWidth={560}>
      <Table striped highlightOnHover withTableBorder verticalSpacing="sm">
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
                <Table.Td>{formatDateTime(t.createdAt)}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
};

export default TransactionTable;
