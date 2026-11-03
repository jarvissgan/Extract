import { Badge, Table, Text } from "@mantine/core";
import { useNavigate } from "react-router";
import { categoryColor, categoryLabel, formatDateTime, formatMoney } from "../lib/transactions";
import type { Transaction } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";

interface Props {
  transactions: Transaction[];
  emptyText: string;
}

const TransactionTable = ({ transactions, emptyText }: Props) => {
  const navigate = useNavigate();
  const { sqid } = useCurrentUser();

  if (!transactions.length) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        {emptyText}
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={560}>
      <Table striped highlightOnHover withTableBorder verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
            <Table.Th>Date</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {transactions.map((t) => (
            <Table.Tr
              key={t.uuid}
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/transactions/${sqid}/${t.uuid}`)}
            >
              <Table.Td>{t.name}</Table.Td>
              <Table.Td>
                <Badge variant="light" color={categoryColor(t.category)}>
                  {categoryLabel(t.category)}
                </Badge>
              </Table.Td>
              <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatMoney(t.amount)}
              </Table.Td>
              <Table.Td>{formatDateTime(t.createdAt)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
};

export default TransactionTable;
