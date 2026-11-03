import { useState, type FormEvent } from "react";
import { Button, Group, Modal, NumberInput, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import api, { errorStatus } from "../lib/api";
import { CATEGORY_OPTIONS } from "../lib/transactions";
import type { Category } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";

const AddTransactionModal = () => {
  const { sqid, notifyTransactionsChanged } = useCurrentUser();
  const [opened, { open, close }] = useDisclosure(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [category, setCategory] = useState<Category>("other");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amountInvalid = amount === "" || !Number.isFinite(Number(amount));

  const reset = () => {
    setName("");
    setAmount("");
    setCategory("other");
    setNote("");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim() || amountInvalid) {
      notifications.show({
        title: "Validation error",
        message: "Please enter a transaction name and valid amount.",
        color: "red",
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/transaction", {
        sqid,
        transaction_name: name.trim(),
        transaction_amount: Number(amount),
        transaction_details: { category, transaction_note: note },
      });
      notifications.show({ title: "Success", message: "Transaction added.", color: "green" });
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
        <form onSubmit={onSubmit}>
          <Stack>
            <TextInput
              label="Name"
              placeholder="e.g. Groceries"
              required
              data-autofocus
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <NumberInput
              label="Amount"
              placeholder="0.00"
              required
              prefix="$"
              thousandSeparator=","
              decimalScale={2}
              allowNegative={false}
              value={amount}
              onChange={setAmount}
            />
            <Select
              label="Category"
              value={category}
              onChange={(value) => setCategory((value as Category) || "other")}
              data={CATEGORY_OPTIONS}
              allowDeselect={false}
            />
            <Textarea
              label="Note"
              placeholder="Optional"
              autosize
              minRows={2}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
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
