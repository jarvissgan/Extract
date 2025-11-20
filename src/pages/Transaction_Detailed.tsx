import { useEffect, useState } from "react";
import axiosInstance from "../../api/axios";
import { useNavigate, useParams } from "react-router";
import { Button, Divider, Input, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";

const Transaction_Detailed = () => {
  const [transactionAmount, setTransactionAmount] = useState(0);
  const [transactionName, setTransactionName] = useState("");
  const [transactionCategory, setTransactionCategory] = useState("placeholder");
  const [transactionDetails, setTransactionDetails] = useState({});
  const [editFlag, setEditflag] = useState(false);
  const [transactionNote, setTransactionNote] = useState("");
  let { sqid, transaction_uuid } = useParams();

  useEffect(() => {
    getTransactionDetail();
  }, []);

  const navigate = useNavigate();

  const routeToPage = (route: any) => {
    navigate(route, { replace: true });
  };

  const getTransactionDetail = async () => {
    try {
      await axiosInstance
        .get(`/transaction/${transaction_uuid}`)
        .then((res: any) => {
          const transactions = res.data;
          setTransactionName(res.data.transaction_name);
          setTransactionAmount(res.data.transaction_amount);
          setTransactionDetails(JSON.parse(res.data.transaction_details));
          setTransactionNote(
            JSON.parse(res.data.transaction_details).transaction_note
          );
          // setUserTransactions(formattedTransactions);
          // setCurrentMonthlySpending(total);
        })
        .catch((err: any) => {
          console.error(
            `Issues with retrieving transactions from uuid ${transaction_uuid}`,
            err
          );
          //redirect user as uuid is invalid
          routeToPage("/404");
        });
    } catch {
      if (!transaction_uuid) {
        console.log("Transaction not found or uuid missing!");
      }
    }
  };
  const updateTransaction = async (e: any) => {
    e.preventDefault();
    console.log("updating transaction");
    // requires sqid, transactionName, transactionAmount, transactionDetails
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
        console.log(`updated transaction ${transaction_uuid}`);
        notifications.show({
          message: "Successfully Updated Transaction!",
        });
      }
    } catch (error: any) {
      if (error.response?.status === 400) {
        console.log(
          `status ${error.response.status}: ${JSON.stringify(
            error.response.data.error
          )}`
        );
        notifications.show({
          title: "Status 400: Bad Request",
          message: "Unable to update transaction, try again",
        });
      } else if (error.response?.status === 500) {
        notifications.show({
          title: "Status 500: Internal Server Error",
          message: "Issues Contacting Server, Try again later",
        });
      } else {
        notifications.show({
          title: "Unexpected Error Occured",
          message: "Try again now or later",
        });
        console.error("Error:", error);
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
        <Button onClick={() => setEditflag(!editFlag)}>Edit</Button>
      </div>

      <Divider />
      <div className="flex justify-between h-full pt-5 ">
        <form className="w-full h-full space-y-4" onSubmit={updateTransaction}>
          {/* <div className="flex flex-col gap-4 max-w-md"> */}
          <TextInput
            required
            autoFocus
            withAsterisk
            readOnly={!editFlag}
            label="Transaction Name"
            placeholder="Enter your transaction name"
            variant="bordered"
            onChangeCapture={(e) => setTransactionName(e.currentTarget.value)}
            value={transactionName}
          />
          <TextInput
            required
            type="number"
            withAsterisk
            readOnly={!editFlag}
            label="Amount"
            placeholder="Enter your transaction Amount"
            variant="bordered"
            onChange={(e) =>
              setTransactionAmount(e.currentTarget.valueAsNumber)
            }
            value={transactionAmount}
          />
          {/* </div> */}
          <Textarea
            readOnly={!editFlag}
            value={transactionNote}
            onChange={(e) => setTransactionNote(e.currentTarget.value)}
            label="Transaction Description"></Textarea>
          <Button className="justify-end" type="submit">
            Update Transaction
          </Button>
        </form>
      </div>
    </div>
  );
};
