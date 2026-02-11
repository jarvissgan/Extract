import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import axiosInstance from "../../api/axios";

const AddTransaction_ButtonModal = () => {
  const [opened, { open, close }] = useDisclosure(false);
  const [expanded, setExpanded] = useState(false);
  const [transactionAmount, setTransactionAmount] = useState(0);
  const [transactionName, setTransactionName] = useState("");
  const [transactionCategory, setTransactionCategory] = useState("other");

  const navigate = useNavigate();
  const sqid = sessionStorage.getItem("sqid");

  if (!sqid) {
    navigate("/setup", { replace: true });
  }

  const isInvalidAmount = useMemo(
    () => transactionAmount === "" || Number.isNaN(Number(transactionAmount)),
    [transactionAmount]
  );

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!transactionName || isInvalidAmount) {
      notifications.show({
        title: "Validation error",
        message: "Please enter a transaction name and valid amount.",
        color: "red",
      });
      return;
    }

    try {
      const res = await axiosInstance.post(`/transaction`, {
        sqid,
        transaction_name: transactionName,
        transaction_amount: Number(transactionAmount),
        transaction_details: {
          category: transactionCategory,
        },
      });

      if (res.status === 200) {
        notifications.show({
          title: "Success",
          message: "Successfully created transaction.",
          color: "green",
        });
        close();
      }
    } catch (error) {
      const status = error.response?.status;

      notifications.show({
        title: "Unable to create transaction",
        message:
          status === 500
            ? "Issues contacting server. Try again later."
            : "Unexpected error occurred.",
        color: "red",
      });
    }
  };

  return (
    <>
      <Button onClick={open}>Add Transaction</Button>

      <Modal
        opened={opened}
        onClose={close}
        size={expanded ? "xl" : "md"}
        title="Add Transaction"
        centered
      >
        <form onSubmit={onSubmit}>
          <Stack>
            <TextInput
              label="Transaction Name"
              placeholder="Enter your transaction name"
              required
              value={transactionName}
              onChange={(event) => setTransactionName(event.currentTarget.value)}
            />
            <NumberInput
              label="Amount"
              placeholder="Enter your transaction amount"
              required
              value={transactionAmount}
              onChange={setTransactionAmount}
              error={isInvalidAmount ? "Enter a valid amount" : null}
              decimalScale={2}
              allowNegative={false}
            />
            <Select
              label="Category"
              value={transactionCategory}
              onChange={(value) => setTransactionCategory(value || "other")}
              data={[
                { value: "other", label: "Other" },
                { value: "food", label: "Food" },
                { value: "housing", label: "Housing" },
                { value: "transport", label: "Transport" },
              ]}
            />
            <Group justify="space-between">
              <Button type="button" variant="outline" onClick={() => setExpanded((prev) => !prev)}>
                {expanded ? "Compact" : "Expand"}
              </Button>
              <Group>
                <Button type="button" variant="default" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit">Submit</Button>
              </Group>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
};

export default AddTransaction_ButtonModal;
