import { useEffect, useState } from "react";
import axiosInstance from "../../api/axios";
import { useNavigate, useParams } from "react-router";
import { Button, Divider, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";

const Transaction_Detailed = () => {
  const [transactionAmount, setTransactionAmount] = useState(0);
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
        transaction_amount: transactionAmount,
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
    <div className="flex flex-col w-full h-full p-10">
      <div className="flex flex-row w-full justify-between items-center">
        <div className="flex flex-row items-center gap-2">
          <Button onClick={() => navigate(-1)}>Back</Button>
          <p>Transaction Details</p>
        </div>
        <Button onClick={() => setEditflag(!editFlag)}>{editFlag ? "Stop editing" : "Edit"}</Button>
      </div>

      <Divider />
      <div className="flex justify-between h-full pt-5 ">
        <form className="w-full h-full space-y-4" onSubmit={updateTransaction}>
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
          <TextInput
            required
            type="number"
            withAsterisk
            readOnly={!editFlag}
            label="Amount"
            placeholder="Enter transaction amount"
            onChange={(e) => setTransactionAmount(e.currentTarget.valueAsNumber)}
            value={transactionAmount}
          />
          <Textarea
            readOnly={!editFlag}
            value={transactionNote}
            onChange={(e) => setTransactionNote(e.currentTarget.value)}
            label="Transaction Description"
          />
          <Button className="justify-end" type="submit" disabled={!editFlag}>
            Update Transaction
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Transaction_Detailed;
