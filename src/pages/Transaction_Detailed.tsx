import { useEffect, useState } from "react";
import axiosInstance from "../../api/axios";
import { useNavigate, useParams } from "react-router";
import { Box, Button, Divider, Group, NumberInput, Select, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";

const Transaction_Detailed = () => {
  const [transactionAmount, setTransactionAmount] = useState<number | string>(0);
  const [transactionName, setTransactionName] = useState("");
  const [transactionCategory, setTransactionCategory] = useState("other");
  const [editFlag, setEditflag] = useState(false);
  const [transactionNote, setTransactionNote] = useState("");
  const { transaction_uuid } = useParams();

  const navigate = useNavigate();
  const routeToPage = (route: string) => {
    navigate(route, { replace: true });
  };

  useEffect(() => {
    const getTransactionDetail = async () => {
      try {
        const res: any = await axiosInstance.get(`/transaction/${transaction_uuid}`);
        const details = JSON.parse(res.data.transaction_details || "{}");

        setTransactionName(res.data.transaction_name || "");
        setTransactionAmount(res.data.transaction_amount || 0);
        setTransactionCategory(details.category || "other");
        setTransactionNote(details.transaction_note || "");
      } catch (err) {
        console.error(`Issues with retrieving transaction from uuid ${transaction_uuid}`, err);
        routeToPage("/404");
      }
    };

    if (transaction_uuid) {
      getTransactionDetail();
    }
  }, [transaction_uuid]);

  const updateTransaction = async (e: any) => {
    e.preventDefault();

    try {
      const res = await axiosInstance.put(`/transaction/${transaction_uuid}`, {
        transaction_name: transactionName,
        transaction_amount: Number(transactionAmount),
        transaction_details: {
          category: transactionCategory,
          transaction_note: transactionNote,
        },
      });

      if (res.status === 200) {
        notifications.show({
          message: "Transaction updated successfully.",
          color: "green",
        });
      }
    } catch (error: any) {
      if (error.response?.status === 400) {
        notifications.show({
          title: "Bad request",
          message: "Unable to update transaction, please verify inputs.",
          color: "red",
        });
      } else if (error.response?.status === 500) {
        notifications.show({
          title: "Server error",
          message: "Issues contacting server. Please try again later.",
          color: "red",
        });
      } else {
        notifications.show({
          title: "Unexpected error",
          message: "Please try again.",
          color: "red",
        });
      }
    }
  };

  return (
    <Box p="xl">
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <Button onClick={() => navigate(-1)}>Back</Button>
          <Title order={3}>Transaction Details</Title>
        </Group>
        <Button onClick={() => setEditflag(!editFlag)}>{editFlag ? "Stop editing" : "Edit"}</Button>
      </Group>

      <Divider mb="md" />
      <form onSubmit={updateTransaction}>
        <Stack>
          <TextInput
            required
            autoFocus
            withAsterisk
            readOnly={!editFlag}
            label="Transaction Name"
            placeholder="Enter transaction name"
            onChange={(e) => setTransactionName(e.currentTarget.value)}
            value={transactionName}
          />
          <NumberInput
            required
            withAsterisk
            readOnly={!editFlag}
            label="Amount"
            placeholder="Enter transaction amount"
            decimalScale={2}
            allowNegative={false}
            onChange={setTransactionAmount}
            value={transactionAmount}
          />
          <Select
            readOnly={!editFlag}
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
          <Textarea
            readOnly={!editFlag}
            value={transactionNote}
            onChange={(e) => setTransactionNote(e.currentTarget.value)}
            label="Transaction Description"
          />
          <Group justify="flex-end">
            <Button type="submit" disabled={!editFlag}>
              Update Transaction
            </Button>
          </Group>
        </Stack>
      </form>
    </Box>
  );
};

export default Transaction_Detailed;
