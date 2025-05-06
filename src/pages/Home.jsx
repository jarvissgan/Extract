import React, { Component, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  getKeyValue,
} from "@heroui/table";
import axios from "axios";
import { useParams } from "react-router";
import {
  Card,
  CardBody,
  CircularProgress,
  Divider,
  table,
} from "@heroui/react";
import axiosInstance from "../../api/axios";

const Home = () => {
  const { isAuthenticated, user, isLoading } = useAuth0();
  let { sqid } = useParams();
  if (!sessionStorage.getItem("sqid")) {
    sessionStorage.setItem("sqid", sqid);
  }
  // const sqid = "xiBoCpeN";
  const [userTransactions, setUserTransactions] = useState([]);
  const [currentMonthlySpending, setCurrentMonthlySpending] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [currentMonth, setCurrentMonth] = useState("");
  const [firstDate, setFirstDate] = useState("");
  const [lastDate, setLastDate] = useState("");
  var currentYear;

  const columns = [
    {
      key: "transaction_name",
      label: "Transaction Name",
    },
    {
      key: "transaction_amount",
      label: "Transaction Amount",
    },
    {
      key: "transaction_date",
      label: "Transaction Date",
    },
  ];

  if (!isAuthenticated) {
    return <p> not authenticated</p>;
  }

  useEffect(() => {
    const getFirstAndLastDate = (
      month = new Date().getMonth() + 1,
      year = new Date().getFullYear()
    ) => {
      const formattedMonth = month.toString().padStart(2, "0");
      setCurrentMonth(
        new Date(year, month - 1).toLocaleString("en-us", { month: "long" })
      );

      // calculate the first and last date of the month
      const firstDateFormatted = `${year}-${formattedMonth}-01`;
      const lastDateFormatted = new Date(year, month, 0); // Last day of the given month
      const lastDateString = `${year}-${formattedMonth}-${lastDateFormatted.getDate()}`;

      setFirstDate(firstDateFormatted);
      setLastDate(lastDateString);
    };

    getFirstAndLastDate();
  }, [sqid]); // re-run when `sqid` changes

  useEffect(() => {
    if (firstDate && lastDate) {
      axiosInstance
        .get(
          `/transaction/user/${sqid}?startDate=${firstDate} 00:00:00&endDate=${lastDate} 00:00:00`
        )
        .then((res) => {
          console.log("res: ", res.data);

          const transactions = res.data;

          let total = 0;
          const formattedTransactions = transactions.map(
            (transaction, index) => {
              total += transaction.transaction_amount;

              return {
                key: index,
                transaction_name: transaction.transaction_name,
                transaction_amount: transaction.transaction_amount,
                transaction_date: transaction.created_timestamp,
              };
            }
          );

          setUserTransactions(formattedTransactions);
          setCurrentMonthlySpending(total);
        })
        .catch((err) => {
          console.error(
            `Issues with retrieving transactions from sqid ${sqid}`,
            err
          );
        });
    }
    //retreive user preference via get /user
    if (sqid) {
      axiosInstance
        .get(`/user/${sqid}`)
        .then((res) => {
          console.log("res: ", res.data);

          const userPreferences = JSON.parse(res.data.preference_json);
          setMonthlyBudget(userPreferences.budgets.monthly);
        })
        .catch((err) => {
          console.error(
            `Issues with retrieving user data from sqid ${sqid}`,
            err
          );
        });
    }
  }, [firstDate, lastDate, sqid]);

  if (isLoading) {
    return (
      <>
        <CircularProgress
          className=" flex w-fit h-fit"
          label={"PLEASE WORK"}
          aria-label="Loading..."
          size="lg"
        />
      </>
    );
  } else {
    return (
      //routerOutletDiv

      <div className="w-full h-full flex flex-col p-5 md:p-10">
        <p className="text-black dark:text-white text-left pb-1">
          Hello, {user.name}
        </p>
        <div className="grid grid-flow-row md:grid-flow-col grid-rows-2 grid-cols-1 md:grid-cols-3 md:grid-rows-4 gap-4 md:gap-6">
          <Card className="md:row-span-4 md:col-span-1 col-span-3 row-span-2">
            <CardBody>
              Spending For {currentMonth}
              <p>${currentMonthlySpending}</p>
            </CardBody>
          </Card>
          <Card className=" md:row-span-4 md:col-span-1 col-span-3 row-span-2">
            <CardBody>
              <p>Monthly Budget Remaining</p>
              <p>
                ${monthlyBudget - currentMonthlySpending} / ${monthlyBudget}
              </p>
            </CardBody>
          </Card>
          <Card className="md:row-span-4 md:col-span-1 col-span-3 row-span-2">
            <CardBody>
              <p>test3</p>
            </CardBody>
          </Card>
        </div>
        <div className="flex-1 pt-5 md:pt-10 h-full">
          {userTransactions.length != 0 ? (
            <div className="grid grid-flow-row md:grid-flow-col grid-rows-1 md:grid-cols-2 gap-4 h-full">
              <div className="">
                <Table
                  isStriped
                  classNames={{ wrapper: "h-full", base: "h-full" }}>
                  <TableHeader columns={columns} className="">
                    {(column) => (
                      <TableColumn key={column.key}>{column.label}</TableColumn>
                    )}
                  </TableHeader>
                  <TableBody items={userTransactions}>
                    {(item) => (
                      <TableRow key={item.key} className="">
                        {(columnKey) => (
                          <TableCell className="">
                            {getKeyValue(item, columnKey)}
                          </TableCell>
                        )}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="col-span-1 align-text-top">
                <Card className="h-full">
                  <CardBody>
                    <p>Lorem Ipsum Dolor Something</p>
                    <p>Lorem Ipsum Dolor Something</p>
                    <p>Lorem Ipsum Dolor Something</p>
                    <p>Lorem Ipsum Dolor Something</p>
                    <p>Lorem Ipsum Dolor Something</p>
                    <p>Lorem Ipsum Dolor Something</p>
                    <p>Lorem Ipsum Dolor Something</p>
                    <p>Lorem Ipsum Dolor Something</p>
                    <p>Lorem Ipsum Dolor Something</p>
                    <p>Lorem Ipsum Dolor Something</p>
                    <p>Lorem Ipsum Dolor Something</p>
                  </CardBody>
                </Card>
              </div>
            </div>
          ) : (
            <Table classNames={{ wrapper: "h-full", base: "h-full" }}>
              <TableHeader columns={columns} className="">
                {(column) => (
                  <TableColumn key={column.key}>{column.label}</TableColumn>
                )}
              </TableHeader>
              <TableBody
                emptyContent={"No data to display for the month."}></TableBody>
            </Table>
          )}
        </div>
      </div>
    );
  }
};

export default Home;
