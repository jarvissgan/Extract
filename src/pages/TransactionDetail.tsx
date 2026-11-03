import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Button,
  Center,
  Divider,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconTrash } from "@tabler/icons-react";
import api, { errorStatus } from "../lib/api";
import { CATEGORY_OPTIONS, formatDateTime, toTransaction } from "../lib/transactions";
import type { Category, Transaction, TransactionRow } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";

const errorMessage = (error: unknown) => {
  switch (errorStatus(error)) {
    case 400:
      return "Please check the values and try again.";
    case 404:
      return "This transaction no longer exists.";
    case 500:
      return "Issues contacting server. Please try again later.";
    default:
      return "Unexpected error. Please try again.";
  }
};

const TransactionDetail = () => {
  const { transaction_uuid } = useParams();
  const { sqid, notifyTransactionsChanged } = useCurrentUser();
  const navigate = useNavigate();
  const listPath = `/transactions/${sqid}`;

  const [original, setOriginal] = useState<Transaction | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | string>(0);
  const [category, setCategory] = useState<Category>("other");
  const [note, setNote] = useState("");

  const fillForm = (t: Transaction) => {
    setName(t.name);
    setAmount(t.amount);
    setCategory(t.category);
    setNote(t.note);
  };

  useEffect(() => {
    if (!transaction_uuid) return;
    let cancelled = false;
    api
      .get<TransactionRow>(`/transaction/${transaction_uuid}`)
      .then((res) => {
        if (cancelled) return;
        const t = toTransaction(res.data);
        setOriginal(t);
        fillForm(t);
      })
      .catch((err) => {
        console.error(`Unable to load transaction ${transaction_uuid}`, err);
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [transaction_uuid]);

  const cancelEdit = () => {
    if (original) fillForm(original);
    setEditing(false);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || amount === "" || !Number.isFinite(Number(amount))) {
      notifications.show({ message: "Please enter a name and valid amount.", color: "red" });
      return;
    }

    setSaving(true);
    try {
      await api.put(`/transaction/${transaction_uuid}`, {
        transaction_name: name.trim(),
        transaction_amount: Number(amount),
        transaction_details: { category, transaction_note: note },
      });
      const updated = { ...original!, name: name.trim(), amount: Number(amount), category, note };
      setOriginal(updated);
      setEditing(false);
      notifyTransactionsChanged();
      notifications.show({ message: "Transaction updated.", color: "green" });
    } catch (error) {
      notifications.show({ title: "Unable to update", message: errorMessage(error), color: "red" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: "Delete transaction",
      centered: true,
      children: <Text size="sm">Delete “{original?.name}”? This can&apos;t be undone.</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.delete(`/transaction/${transaction_uuid}`);
          notifyTransactionsChanged();
          notifications.show({ message: "Transaction deleted.", color: "green" });
          navigate(listPath, { replace: true });
        } catch (error) {
          notifications.show({ title: "Unable to delete", message: errorMessage(error), color: "red" });
        }
      },
    });

  if (loadFailed) {
    return (
      <Center h="60vh" px="md">
        <Stack align="center" gap="sm">
          <Title order={3}>Transaction not found</Title>
          <Button onClick={() => navigate(listPath)}>Back to transactions</Button>
        </Stack>
      </Center>
    );
  }

  if (!original) {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack p={{ base: "md", md: "xl" }} maw={720}>
      <Group justify="space-between">
        <Group gap="sm">
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(listPath)}>
            Back
          </Button>
          <Title order={3}>Transaction details</Title>
        </Group>
        {!editing && (
          <Group gap="xs">
            <Button onClick={() => setEditing(true)}>Edit</Button>
            <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={confirmDelete}>
              Delete
            </Button>
          </Group>
        )}
      </Group>

      <Divider />

      <form onSubmit={save}>
        <Stack>
          <TextInput
            required
            readOnly={!editing}
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <NumberInput
            required
            readOnly={!editing}
            label="Amount"
            prefix="$"
            thousandSeparator=","
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
            value={amount}
            onChange={setAmount}
          />
          <Select
            readOnly={!editing}
            label="Category"
            value={category}
            onChange={(value) => setCategory((value as Category) || "other")}
            data={CATEGORY_OPTIONS}
            allowDeselect={false}
          />
          <Textarea
            readOnly={!editing}
            label="Note"
            autosize
            minRows={3}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <Text size="sm" c="dimmed">
            Created {formatDateTime(original.createdAt)}
            {original.updatedAt ? ` · Updated ${formatDateTime(original.updatedAt)}` : ""}
          </Text>
          {editing && (
            <Group justify="flex-end">
              <Button variant="default" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </Group>
          )}
        </Stack>
      </form>
    </Stack>
  );
};

export default TransactionDetail;
