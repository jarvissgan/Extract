import { useState, type FormEvent } from "react";
import {
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import dayjs from "dayjs";
import api, { errorStatus } from "../lib/api";
import { useCurrentUser } from "../context/UserContext";
import { fieldErrors, transactionSchema } from "../../shared/schemas.js";

const today = () => dayjs().format("YYYY-MM-DD");

// Combines the picked day with the current time, so same-day entries keep their order.
const toIsoDate = (day: string) => {
  const now = dayjs();
  return dayjs(day).hour(now.hour()).minute(now.minute()).second(now.second()).toISOString();
};

const AddTransactionModal = () => {
  const { sqid, categories, currencySymbol, notifyTransactionsChanged } = useCurrentUser();
  const [opened, { open, close }] = useDisclosure(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [category, setCategory] = useState("other");
  const [note, setNote] = useState("");
  const [date, setDate] = useState<string>(today());
  const [repeat, setRepeat] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setAmount("");
    setCategory("other");
    setNote("");
    setDate(today());
    setRepeat(false);
    setErrors({});
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const parsed = transactionSchema.safeParse({
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
      await api.post("/transaction", { sqid, ...parsed.data });
      if (repeat) {
        // this month's entry was just added, so the rule starts next month
        await api.post("/recurring", {
          name: parsed.data.transaction_name,
          amount: parsed.data.transaction_amount,
          category,
          note,
          day_of_month: dayjs(date).date(),
          start_period: dayjs(date).add(1, "month").format("YYYY-MM"),
        });
      }
      notifications.show({
        title: "Success",
        message: repeat ? "Transaction added and set to repeat monthly." : "Transaction added.",
        color: "green",
      });
      notifyTransactionsChanged();
      reset();
      close();
    } catch (error) {
      notifications.show({
        title: "Unable to add transaction",
        message:
          errorStatus(error) === 500
            ? "Issues contacting server. Try again later."
            : "Unexpected error occurred.",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button leftSection={<IconPlus size={18} />} onClick={open} mt="sm">
        Add transaction
      </Button>

      <Modal opened={opened} onClose={close} title="Add transaction" centered>
        <form onSubmit={onSubmit} noValidate>
          <Stack>
            <TextInput
              label="Name"
              placeholder="e.g. Groceries"
              required
              data-autofocus
              value={name}
              error={errors.transaction_name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <NumberInput
              label="Amount"
              placeholder="0.00"
              required
              prefix={currencySymbol}
              thousandSeparator=","
              decimalScale={2}
              allowNegative={false}
              value={amount}
              error={errors.transaction_amount}
              onChange={setAmount}
            />
            <Group grow align="flex-start">
              <Select
                label="Category"
                value={category}
                onChange={(value) => setCategory(value || "other")}
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
              />
            </Group>
            <Textarea
              label="Note"
              placeholder="Optional"
              autosize
              minRows={2}
              value={note}
              error={errors["transaction_details.transaction_note"]}
              onChange={(event) => setNote(event.currentTarget.value)}
            />
            <Checkbox
              label={`Repeat monthly on day ${dayjs(date).date()}`}
              checked={repeat}
              onChange={(e) => setRepeat(e.currentTarget.checked)}
            />
            <Group justify="flex-end">
              <Button type="button" variant="default" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Add
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
};

export default AddTransactionModal;
