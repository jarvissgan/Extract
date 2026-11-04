import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Badge,
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
import { DateTimePicker } from "@mantine/dates";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconRepeat, IconTrash } from "@tabler/icons-react";
import dayjs from "dayjs";
import api, { errorStatus } from "../lib/api";
import { formatDateTime, toTransaction } from "../lib/transactions";
import type { Transaction, TransactionRow } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";
import { fieldErrors, transactionSchema } from "../../shared/schemas.js";

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
  const { sqid, categories, currencySymbol, notifyTransactionsChanged } = useCurrentUser();
  const navigate = useNavigate();
  const listPath = `/transactions/${sqid}`;

  const [original, setOriginal] = useState<Transaction | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | string>(0);
  const [category, setCategory] = useState("other");
  const [note, setNote] = useState("");
  const [date, setDate] = useState<string | null>(null);

  const fillForm = (t: Transaction) => {
    setName(t.name);
    setAmount(t.amount);
    setCategory(t.category);
    setNote(t.note);
    setDate(dayjs(t.createdAt).format("YYYY-MM-DD HH:mm:ss"));
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
    setErrors({});
    setEditing(false);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = transactionSchema.safeParse({
      transaction_name: name,
      transaction_amount: amount,
      transaction_details: { category, transaction_note: note },
      transaction_date: date ? dayjs(date).toISOString() : undefined,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      await api.put(`/transaction/${transaction_uuid}`, parsed.data);
      const updated: Transaction = {
        ...original!,
        name: parsed.data.transaction_name,
        amount: parsed.data.transaction_amount,
        category,
        note,
        createdAt: parsed.data.transaction_date ?? original!.createdAt,
        updatedAt: new Date().toISOString(),
      };
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
          {original.recurring && (
            <Badge variant="light" leftSection={<IconRepeat size={12} />}>
              Recurring
            </Badge>
          )}
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

      <form onSubmit={save} noValidate>
        <Stack>
          <TextInput
            required
            readOnly={!editing}
            label="Name"
            value={name}
            error={errors.transaction_name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <NumberInput
            required
            readOnly={!editing}
            label="Amount"
            prefix={currencySymbol}
            thousandSeparator=","
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
            value={amount}
            error={errors.transaction_amount}
            onChange={setAmount}
          />
          <Group grow align="flex-start">
            <Select
              readOnly={!editing}
              label="Category"
              value={category}
              onChange={(value) => setCategory(value || "other")}
              data={categories.map(({ value, label }) => ({ value, label }))}
              allowDeselect={false}
              error={errors["transaction_details.category"]}
            />
            <DateTimePicker
              readOnly={!editing}
              label="Date"
              value={date}
              onChange={setDate}
              valueFormat="D MMM YYYY, h:mm A"
              maxDate={new Date()}
            />
          </Group>
          <Textarea
            readOnly={!editing}
            label="Note"
            autosize
            minRows={3}
            value={note}
            error={errors["transaction_details.transaction_note"]}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          {original.updatedAt && (
            <Text size="sm" c="dimmed">
              Last updated {formatDateTime(original.updatedAt)}
            </Text>
          )}
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
