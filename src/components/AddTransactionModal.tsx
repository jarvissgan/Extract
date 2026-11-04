import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Autocomplete,
  Button,
  Checkbox,
  Group,
  Kbd,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import api, { errorStatus } from "../lib/api";
import type { TransactionType } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";
import { useTransactionEntry, type EntryPrefill } from "../context/TransactionEntry";
import { useIsMobile } from "../hooks/useIsMobile";
import { categoryFromRules, fieldErrors, transactionSchema } from "../../shared/schemas.js";

const today = () => dayjs().format("YYYY-MM-DD");

// Combines the picked day with the current time, so same-day entries keep their order.
const toIsoDate = (day: string) => {
  const now = dayjs();
  return dayjs(day).hour(now.hour()).minute(now.minute()).second(now.second()).toISOString();
};

interface Props {
  opened: boolean;
  onClose: () => void;
  prefill?: EntryPrefill;
}

const AddTransactionModal = ({ opened, onClose, prefill }: Props) => {
  const { sqid, categories, rules, currencySymbol, formatMoney, notifyTransactionsChanged } = useCurrentUser();
  const { suggestions, confirmAdded } = useTransactionEntry();
  const [type, setType] = useState<TransactionType>("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [category, setCategory] = useState("other");
  // once the user picks a category themselves, rules and suggestions stop changing it
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState<string>(today());
  const [repeat, setRepeat] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  // which button submitted the form
  const keepOpenRef = useRef(false);

  const defaultCategory = (t: TransactionType) => (t === "income" ? "income" : "other");

  const resetFields = (next?: EntryPrefill) => {
    const t = next?.type ?? "expense";
    setType(t);
    setName(next?.name ?? "");
    setAmount(typeof next?.amount === "number" ? next.amount.toFixed(2) : (next?.amount ?? ""));
    setCategory(next?.category ?? defaultCategory(t));
    setCategoryTouched(!!next?.category);
    setNote(next?.note ?? "");
    setRepeat(false);
    setErrors({});
  };

  useEffect(() => {
    if (opened) {
      resetFields(prefill);
      setDate(today());
    }
    // reset only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const matchingSuggestion = (value: string, t: TransactionType) =>
    suggestions.find((s) => s.type === t && s.name.toLowerCase() === value.trim().toLowerCase());

  const onNameChange = (value: string) => {
    setName(value);
    const suggestion = matchingSuggestion(value, type);
    if (suggestion) {
      // picked (or typed) a name used before: fill in what it was last time
      setAmount((prev) => (prev === "" ? suggestion.amount.toFixed(2) : prev));
      if (!categoryTouched) setCategory(categoryFromRules(value, rules) ?? suggestion.category);
    } else if (!categoryTouched) {
      setCategory(categoryFromRules(value, rules) ?? defaultCategory(type));
    }
  };

  const onTypeChange = (value: string) => {
    const next = value as TransactionType;
    setType(next);
    if (!categoryTouched) setCategory(categoryFromRules(name, rules) ?? defaultCategory(next));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const keepOpen = keepOpenRef.current;
    keepOpenRef.current = false;

    const parsed = transactionSchema.safeParse({
      transaction_type: type,
      transaction_name: name,
      transaction_amount: amount,
      transaction_details: { category, transaction_note: note },
      transaction_date: toIsoDate(date),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const res = await api.post<{ transaction_uuid: string }>("/transaction", { sqid, ...parsed.data });
      if (repeat) {
        // this month's entry was just added, so the rule starts next month
        await api.post("/recurring", {
          transaction_type: type,
          name: parsed.data.transaction_name,
          amount: parsed.data.transaction_amount,
          category,
          note,
          day_of_month: dayjs(date).date(),
          start_period: dayjs(date).add(1, "month").format("YYYY-MM"),
        });
        notifications.show({ message: `${parsed.data.transaction_name} added and set to repeat monthly.`, color: "green" });
      } else {
        confirmAdded(res.data.transaction_uuid, `${parsed.data.transaction_name} · ${formatMoney(parsed.data.transaction_amount)}`);
      }
      notifyTransactionsChanged();

      if (keepOpen) {
        // keep the date for entering a batch, clear the rest
        resetFields({ type });
        nameRef.current?.focus();
      } else {
        onClose();
      }
    } catch (error) {
      notifications.show({
        title: "Unable to add transaction",
        message: errorStatus(error) === 500 ? "Issues contacting server. Try again later." : "Unexpected error occurred.",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // unique names for this type, most used first
  const nameOptions = [...new Set(suggestions.filter((s) => s.type === type).map((s) => s.name))];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add transaction"
      centered
      fullScreen={isMobile}
      transitionProps={{ transition: isMobile ? "slide-up" : "pop" }}
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack>
          <SegmentedControl
            aria-label="Type"
            value={type}
            onChange={onTypeChange}
            data={[
              { value: "expense", label: "Expense" },
              { value: "income", label: "Income" },
            ]}
          />
          <Autocomplete
            ref={nameRef}
            label="Name"
            placeholder={type === "income" ? "e.g. Salary" : "e.g. Groceries"}
            required
            data-autofocus
            data={nameOptions}
            limit={6}
            value={name}
            error={errors.transaction_name}
            onChange={onNameChange}
          />
          <NumberInput
            label="Amount"
            placeholder="0.00"
            required
            prefix={currencySymbol}
            thousandSeparator=","
            decimalScale={2}
            allowNegative={false}
            inputMode="decimal"
            hideControls={isMobile}
            value={amount}
            error={errors.transaction_amount}
            onChange={setAmount}
          />
          <Group grow align="flex-start">
            <Select
              label="Category"
              value={category}
              onChange={(value) => {
                setCategory(value || "other");
                setCategoryTouched(true);
              }}
              data={categories.map(({ value, label }) => ({ value, label }))}
              allowDeselect={false}
              error={errors["transaction_details.category"]}
            />
            <DatePickerInput
              label="Date"
              value={date}
              onChange={(value) => setDate(value || today())}
              maxDate={today()}
              valueFormat="D MMM YYYY"
              dropdownType={isMobile ? "modal" : "popover"}
            />
          </Group>
          <Textarea
            label="Note"
            placeholder="Optional"
            autosize
            minRows={1}
            value={note}
            error={errors["transaction_details.transaction_note"]}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          <Checkbox
            label={`Repeat monthly on day ${dayjs(date).date()}`}
            checked={repeat}
            onChange={(e) => setRepeat(e.currentTarget.checked)}
          />
          <Group justify="space-between">
            <Text size="xs" c="dimmed" visibleFrom="sm">
              <Kbd size="xs">Enter</Kbd> to add
            </Text>
            <Group gap="xs" grow={isMobile} style={isMobile ? { flex: 1 } : undefined}>
              <Button
                type="submit"
                variant="default"
                loading={submitting && keepOpenRef.current}
                onClick={() => (keepOpenRef.current = true)}
              >
                Add another
              </Button>
              <Button type="submit" loading={submitting}>
                Add
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default AddTransactionModal;
