import { useRef, useState, type FormEvent } from "react";
import { ActionIcon, Badge, Card, Group, Kbd, Text, TextInput } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconArrowRight, IconBolt } from "@tabler/icons-react";
import dayjs from "dayjs";
import api from "../lib/api";
import { findCategory } from "../lib/transactions";
import { useCurrentUser } from "../context/UserContext";
import { useTransactionEntry } from "../context/TransactionEntry";
import { categoryFromRules, describeError, transactionSchema } from "../../shared/schemas.js";
import { matchCategory, parseQuickAdd } from "../../shared/quickAdd.js";

const EXAMPLES = ["coffee 4.50", "+3200 salary", "lunch 12 yesterday", "grab 15 #transport"];

// One-line entry: type "coffee 4.50" and press Enter. See shared/quickAdd.js for the syntax.
const QuickAddBar = () => {
  const { sqid, categories, rules, formatMoney, notifyTransactionsChanged } = useCurrentUser();
  const { suggestions, confirmAdded } = useTransactionEntry();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" jumps here from anywhere
  useHotkeys([["/", () => inputRef.current?.focus()]]);

  const parsed = parseQuickAdd(value);
  const explicitIncome = parsed.type === "income";
  // a name used before fills in the type, amount and category it had last time
  const suggestion = parsed.name
    ? suggestions.find(
        (s) => s.name.toLowerCase() === parsed.name.toLowerCase() && (!explicitIncome || s.type === "income")
      )
    : undefined;
  const type = explicitIncome ? "income" : (suggestion?.type ?? "expense");
  const amount = parsed.amount ?? suggestion?.amount ?? null;
  const hinted = matchCategory(parsed.categoryHint, categories);
  const category =
    hinted ??
    categoryFromRules(parsed.name, rules) ??
    suggestion?.category ??
    (type === "income" ? "income" : "other");
  const name = suggestion?.name ?? parsed.name;
  const date = dayjs().subtract(parsed.daysAgo, "day");

  const problem = !value.trim()
    ? null
    : parsed.categoryHint && !hinted
      ? `No category called #${parsed.categoryHint}`
      : !name
        ? "Add a name, e.g. coffee 4.50"
        : amount === null
          ? "Add an amount, e.g. coffee 4.50"
          : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || problem) {
      setError(problem ?? "Type something like: coffee 4.50");
      return;
    }
    const body = transactionSchema.safeParse({
      transaction_type: type,
      transaction_name: name,
      transaction_amount: amount,
      transaction_details: { category, transaction_note: "" },
      transaction_date: date.toISOString(),
    });
    if (!body.success) {
      setError(describeError(body.error));
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<{ transaction_uuid: string }>("/transaction", { sqid, ...body.data });
      confirmAdded(res.data.transaction_uuid, `${name} · ${type === "income" ? "+" : ""}${formatMoney(amount!)}`);
      notifyTransactionsChanged();
      setValue("");
      setError(null);
    } catch {
      notifications.show({ message: "Couldn't add that. Try again later.", color: "red" });
    } finally {
      setSaving(false);
    }
  };

  const cat = findCategory(categories, category);
  const showPreview = value.trim() && !problem;

  return (
    <Card padding="sm" shadow="xs">
      <form onSubmit={submit}>
        <TextInput
          ref={inputRef}
          aria-label="Quick add"
          placeholder={`Quick add: "${EXAMPLES[0]}"`}
          size="md"
          variant="unstyled"
          leftSection={<IconBolt size={20} />}
          rightSectionWidth={showPreview ? 44 : 60}
          rightSection={
            showPreview ? (
              <ActionIcon type="submit" variant="filled" size="lg" radius="md" loading={saving} aria-label="Add">
                <IconArrowRight size={18} />
              </ActionIcon>
            ) : (
              <Kbd visibleFrom="sm">/</Kbd>
            )
          }
          value={value}
          onChange={(e) => {
            setValue(e.currentTarget.value);
            setError(null);
          }}
          autoComplete="off"
        />
      </form>
      <Group gap={6} px={4} mih={24} wrap="wrap">
        {showPreview ? (
          <>
            <Text size="xs" c="dimmed">
              Enter to add:
            </Text>
            <Badge variant="light" color={type === "income" ? "teal" : "gray"} tt="none">
              {type === "income" ? "Income" : "Expense"}
            </Badge>
            <Text size="sm" fw={600}>
              {name}
            </Text>
            <Text size="sm" fw={600} c={type === "income" ? "teal" : undefined} className="tabular">
              {type === "income" ? "+" : ""}
              {formatMoney(amount!)}
            </Text>
            <Badge variant="light" color={cat.color}>
              {cat.label}
            </Badge>
            <Text size="xs" c="dimmed">
              {parsed.daysAgo === 0 ? "today" : parsed.daysAgo === 1 ? "yesterday" : date.format("ddd D MMM")}
              {suggestion && parsed.amount === null ? " · same as last time" : ""}
            </Text>
          </>
        ) : (
          <Text size="xs" c={error || problem ? "red" : "dimmed"}>
            {error ?? problem ?? `Try "${EXAMPLES[1]}", "${EXAMPLES[2]}", "${EXAMPLES[3]}", or a name you've used before.`}
            {!error && !problem && (
              <Text span inherit visibleFrom="sm">
                {" "}
                Press N for the full form.
              </Text>
            )}
          </Text>
        )}
      </Group>
    </Card>
  );
};

export default QuickAddBar;
