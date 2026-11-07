import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Center,
  Divider,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
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
import { IconArrowLeft, IconCopy, IconRepeat, IconTrash } from "@tabler/icons-react";
import { useTransactionEntry } from "../context/TransactionEntry";
import { useIsMobile } from "../hooks/useIsMobile";
import dayjs from "dayjs";
import api, { errorStatus } from "../lib/api";
import { findCategory, formatDateTime, toTransaction } from "../lib/transactions";
import { useRangeTransactions } from "../hooks/useMonthTransactions";
import type { Transaction, TransactionRow, TransactionType } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";
import { categoryFromRules, fieldErrors, transactionSchema, userSchema } from "../../shared/schemas.js";
import { parseJson } from "../lib/types";

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

// Summary of the transaction, and others with the same name over the past year.
const SidePanel = ({ transaction }: { transaction: Transaction }) => {
  const { sqid, categories, formatMoney } = useCurrentUser();
  // stable for the day, so the list doesn't refetch on every render
  const start = useMemo(() => dayjs().subtract(12, "month").startOf("month"), []);
  const end = useMemo(() => dayjs().endOf("day"), []);
  const { transactions, loading } = useRangeTransactions(start, end);
  const category = findCategory(categories, transaction.category);
  const income = transaction.type === "income";

  const same = transactions.filter(
    (t) => t.name.trim().toLowerCase() === transaction.name.trim().toLowerCase() && t.type === transaction.type,
  );
  const others = same.filter((t) => t.uuid !== transaction.uuid);
  const total = same.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Stack gap="lg">
      {/* only beside the form on wide screens; narrower screens already show it in the form */}
      <Card padding="lg" shadow="xs" visibleFrom="lg">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.4} mb={6}>
          Summary
        </Text>
        <Title order={2} c={income ? "teal" : undefined} className="tabular">
          {income ? "+" : ""}
          {formatMoney(transaction.amount)}
        </Title>
        <Text fw={600} mt={4} truncate>
          {transaction.name}
        </Text>
        <Group gap={6} mt="xs">
          <Badge variant="light" color={income ? "teal" : "gray"}>
            {income ? "Income" : "Expense"}
          </Badge>
          <Badge variant="light" color={category.color}>
            {category.label}
          </Badge>
          {transaction.recurring && (
            <Badge variant="light" leftSection={<IconRepeat size={12} />}>
              Recurring
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed" mt="sm">
          {dayjs(transaction.createdAt).format(
            transaction.dateOnly ? "dddd, D MMMM YYYY" : "dddd, D MMMM YYYY · h:mm A",
          )}
        </Text>
        {transaction.updatedAt && (
          <Text size="xs" c="dimmed" mt={4}>
            Last updated {formatDateTime(transaction.updatedAt)}
          </Text>
        )}
      </Card>

      <Card padding="lg" shadow="xs">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.4} mb={6}>
          “{transaction.name}” in the past year
        </Text>
        {loading ? (
          <Loader size="sm" />
        ) : others.length === 0 ? (
          <Text size="sm" c="dimmed">
            This is the only one in the past 12 months.
          </Text>
        ) : (
          <Stack gap="xs">
            <Text size="sm">
              <b>{same.length}</b> times · {income ? "received" : "spent"}{" "}
              <b className="tabular">{formatMoney(total)}</b> · about {formatMoney(total / 12)} a month
            </Text>
            <Stack gap={0}>
              {others.slice(0, 6).map((t, i) => (
                <div key={t.uuid}>
                  {i > 0 && <Divider />}
                  <Group justify="space-between" py={6} wrap="nowrap">
                    <Anchor component={Link} to={`/transactions/${sqid}/${t.uuid}`} size="sm">
                      {dayjs(t.createdAt).format("D MMM YYYY")}
                    </Anchor>
                    <Text size="sm" className="tabular">
                      {formatMoney(t.amount)}
                    </Text>
                  </Group>
                </div>
              ))}
            </Stack>
            {others.length > 6 && (
              <Text size="xs" c="dimmed">
                and {others.length - 6} more
              </Text>
            )}
          </Stack>
        )}
      </Card>
    </Stack>
  );
};

const TransactionDetail = () => {
  const { transaction_uuid } = useParams();
  const { sqid, user, preferences, rules, categories, currencySymbol, notifyTransactionsChanged, refreshUser } =
    useCurrentUser();
  const navigate = useNavigate();
  const { openAdd } = useTransactionEntry();
  const isMobile = useIsMobile();
  const listPath = `/transactions/${sqid}`;

  const [original, setOriginal] = useState<Transaction | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [type, setType] = useState<TransactionType>("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | string>(0);
  const [category, setCategory] = useState("other");
  const [note, setNote] = useState("");
  const [date, setDate] = useState<string | null>(null);

  const fillForm = (t: Transaction) => {
    setType(t.type);
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
    // still "date only" unless the time was changed
    const dateOnly =
      !!original?.dateOnly && (!date || dayjs(date).format("HH:mm") === dayjs(original.createdAt).format("HH:mm"));
    const parsed = transactionSchema.safeParse({
      transaction_type: type,
      transaction_name: name,
      transaction_amount: amount,
      transaction_details: { category, transaction_note: note, ...(dateOnly ? { date_only: true } : {}) },
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
        type,
        name: parsed.data.transaction_name,
        amount: parsed.data.transaction_amount,
        category,
        note,
        createdAt: parsed.data.transaction_date ?? original!.createdAt,
        updatedAt: new Date().toISOString(),
        dateOnly,
      };
      setOriginal(updated);
      setEditing(false);
      notifyTransactionsChanged();
      notifications.show({ message: "Transaction updated.", color: "green" });
      if (category !== original!.category && categoryFromRules(parsed.data.transaction_name, rules) !== category) {
        offerRule(parsed.data.transaction_name, category);
      }
    } catch (error) {
      notifications.show({ title: "Unable to update", message: errorMessage(error), color: "red" });
    } finally {
      setSaving(false);
    }
  };

  // After a category change, offer to categorize similar names the same way from now on.
  const offerRule = (transactionName: string, newCategory: string) => {
    const pattern = transactionName.trim().toLowerCase().slice(0, 60);
    if (pattern.length < 2) return;
    const label = categories.find((c) => c.value === newCategory)?.label ?? newCategory;
    const id = notifications.show({
      autoClose: 10000,
      title: "Remember this?",
      message: (
        <Stack gap={6}>
          <Text size="sm">
            Always put names containing “{pattern}” in {label}?
          </Text>
          <Group gap="xs">
            <Button
              size="xs"
              onClick={async () => {
                notifications.hide(id);
                const body = userSchema.safeParse({
                  username: user?.username,
                  account_status: parseJson(user?.account_status, { status: "active" }),
                  preference_json: {
                    ...preferences,
                    rules: [{ pattern, category: newCategory }, ...rules.filter((r) => r.pattern !== pattern)],
                  },
                });
                if (!body.success) return;
                await api.put(`/user/${sqid}`, body.data);
                await refreshUser();
                notifications.show({ message: "Rule saved. Manage rules in Settings.", color: "green" });
              }}
            >
              Yes, remember
            </Button>
            <Button size="xs" variant="subtle" onClick={() => notifications.hide(id)}>
              No
            </Button>
          </Group>
        </Stack>
      ),
    });
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
    <Stack p={{ base: "md", md: "xl" }} maw={1240}>
      <Group justify="space-between" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Button
            variant="subtle"
            px="xs"
            style={{ flexShrink: 0 }}
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(listPath)}
          >
            Back
          </Button>
          <Title order={3} style={{ minWidth: 0 }}>
            Transaction details
          </Title>
          {original.recurring && (
            <Badge variant="light" leftSection={<IconRepeat size={12} />}>
              Recurring
            </Badge>
          )}
        </Group>
        {!editing && (
          <Group gap="xs" grow={isMobile} w={{ base: "100%", sm: "auto" }}>
            <Button
              variant="default"
              leftSection={isMobile ? undefined : <IconCopy size={16} />}
              onClick={() =>
                openAdd({
                  type: original.type,
                  name: original.name,
                  amount: original.amount,
                  category: original.category,
                  note: original.note,
                })
              }
            >
              Add again
            </Button>
            <Button onClick={() => setEditing(true)}>Edit</Button>
            <Button
              color="red"
              variant="light"
              leftSection={isMobile ? undefined : <IconTrash size={16} />}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </Group>
        )}
      </Group>

      <Divider />

      {/* wide screens: the form on the left, a summary and related transactions on the right */}
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card padding="lg" shadow="xs">
            <form onSubmit={save} noValidate>
              <Stack>
                <SegmentedControl
                  aria-label="Type"
                  readOnly={!editing}
                  value={type}
                  onChange={(v) => setType(v as TransactionType)}
                  data={[
                    { value: "expense", label: "Expense" },
                    { value: "income", label: "Income" },
                  ]}
                  w="fit-content"
                />
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
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
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
                    dropdownType={isMobile ? "modal" : "popover"}
                    maxDate={new Date()}
                  />
                </SimpleGrid>
                <Textarea
                  readOnly={!editing}
                  label="Note"
                  autosize
                  minRows={3}
                  value={note}
                  error={errors["transaction_details.transaction_note"]}
                  onChange={(e) => setNote(e.currentTarget.value)}
                />
                {editing && (
                  <Group justify="flex-end" grow={isMobile}>
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
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <SidePanel transaction={original} />
        </Grid.Col>
      </Grid>
    </Stack>
  );
};

export default TransactionDetail;
