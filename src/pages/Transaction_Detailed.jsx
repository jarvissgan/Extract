import {
  addToast,
  Button,
  Checkbox,
  Divider,
  Form,
  Input,
  Textarea,
  Tooltip,
  user,
} from "@heroui/react";
import React, { useEffect, useState } from "react";
import axiosInstance from "../../api/axios";
import { useNavigate, useParams } from "react-router";

const Transaction_Detailed = () => {
  const [transactionAmount, setTransactionAmount] = useState(0);
  const [transactionName, setTransactionName] = useState("");
  const [transactionCategory, setTransactionCategory] = useState("placeholder");
  const [transactionDetails, setTransactionDetails] = useState({});
  const [editFlag, setEditflag] = useState(false);
  const [transactionNote, setTransactionNote] = useState()
  let { sqid, transaction_uuid } = useParams();

  useEffect(() => {
    getTransactionDetail();
  }, []);

  const navigate = useNavigate();

  const routeToPage = (route) => {
    navigate(route, { replace: true });
  };

  const getTransactionDetail = async (e) => {
    try {
      await axiosInstance
        .get(`/transaction/${transaction_uuid}`)
        .then((res) => {
          const transactions = res.data;
          setTransactionName(res.data.transaction_name);
          setTransactionAmount(res.data.transaction_amount);
          setTransactionDetails(JSON.parse(res.data.transaction_details));
          setTransactionNote(JSON.parse(res.data.transaction_details).transaction_note);
          // setUserTransactions(formattedTransactions);
          // setCurrentMonthlySpending(total);
        })
        .catch((err) => {
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
  const updateTransaction = async (e) => {
    e.preventDefault();
    console.log("updating transaction");
    // requires sqid, transactionName, transactionAmount, transactionDetails
    try {
      const res = await axiosInstance.put(`/transaction/${transaction_uuid}`, {
        transaction_name: transactionName,
        transaction_amount: transactionAmount,
        transaction_details: {
          category: transactionCategory,
          transaction_note: transactionNote
        },
      });

      if (res.status === 200) {
        console.log(`updated transaction ${transaction_uuid}`);
        addToast({
          title: "Successfully updated transaction!",
          variant: "flat",
          promise: new Promise((resolve) => setTimeout(resolve, 3000)),
          color: "success",
        });
      }
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(
          `status ${error.response.status}: ${JSON.stringify(
            error.response.data.error
          )}`
        );
        addToast({
          title: "Unable to update transaction, try again",
          variant: "flat",
          promise: new Promise((resolve) => setTimeout(resolve, 3000)),
          color: "danger",
        });
      } else if (error.response?.status === 500) {
        addToast({
          title: "Issues Contacting Server, Try again later",
          variant: "flat",
          promise: new Promise((resolve) => setTimeout(resolve, 3000)),
          color: "danger",
        });
      } else {
        addToast({
          title: "Unexpected Error Occured",
          variant: "flat",
          promise: new Promise((resolve) => setTimeout(resolve, 3000)),
          color: "danger",
        });
        console.error("Error:", error);
      }
    }
  };

  return (
    <div className="flex flex-col w-full h-full p-10">
      <div className="flex flex-row w-full justify-between items-center">
        <div className="flex flex-row items-center gap-2">
          <Button onPress={()=> navigate(-1)}>Back</Button>
          <p>Transaction Details</p>
        </div>
        <Button onPress={() => setEditflag(!editFlag)}>Edit</Button>
      </div>

      <Divider />
      <div className="flex justify-between h-full pt-5 ">
        <Form className="w-full h-full space-y-4" onSubmit={updateTransaction}>
          {/* <div className="flex flex-col gap-4 max-w-md"> */}
          <Input
            autoFocus
            isRequired
            isReadOnly={!editFlag}
            label="Transaction Name"
            placeholder="Enter your transaction name"
            variant="bordered"
            onValueChange={setTransactionName}
            value={transactionName}
          />
          <Input
            isRequired
            isReadOnly={!editFlag}
            label="Amount"
            placeholder="Enter your transaction Amount"
            variant="bordered"
            onValueChange={setTransactionAmount}
            value={transactionAmount}
          />
          {/* </div> */}
          <Textarea
            isReadOnly={!editFlag}
            value={transactionNote}
            onChange={(e)=> setTransactionNote(e.target.value)}
            label="Transaction Description"></Textarea>
          <Button className="justify-end" type="submit">
            Update Transaction
          </Button>
        </Form>
      </div>
    </div>
  );
};

export default Transaction_Detailed;
