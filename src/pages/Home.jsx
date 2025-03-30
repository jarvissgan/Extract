import React, { Component, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Sidebar from "../components/sidebar";
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
import { Card, CardBody, CircularProgress } from "@heroui/react";

const Home = () => {
  const { isAuthenticated, user, isLoading } = useAuth0();

  // let { sqid } = useParams();
  const sqid = "xiBoCpeN";
  const [userTransactions, setUserTransactions] = useState([]);
  const [currentMonthlySpending, setCurrentMonthlySpending] = useState(0);
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
      axios
        .get(
          `http://localhost:3000/api/transaction/user/${sqid}?startDate=${firstDate} 00:00:00&endDate=${lastDate} 00:00:00`
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
  }, [firstDate, lastDate, sqid]);

  if (isLoading) {
    return (
      <div className="w-fit h-fit">
        <CircularProgress aria-label="Loading..." size="sm" />
      </div>
    );
  } else {
    return (
      //routerOutletDiv

      <div className="w-full h-full p-5 sm:p-10">
        <p className="text-left pb-1">Hello, {user.name}</p>
        <div className="grid grid-flow-row sm:grid-flow-col grid-rows-1 grid-cols-1 sm:grid-cols-3 sm:grid-rows-4 gap-4 sm:gap-6 h-1/4 sm:h-1/6">
          <Card className="row-span-4 col-span-1 bg-amber-500">
            <CardBody>
              Spending For {currentMonth}
              <p>${currentMonthlySpending}</p>
            </CardBody>
          </Card>
          <Card className="row-span-4 col-span-1 bg-amber-500">
            <CardBody>
              <p>test2</p>
            </CardBody>
          </Card>
          <Card className="row-span-4 col-span-1 bg-amber-500">
            <CardBody>
              <p>test3</p>
            </CardBody>
          </Card>
        </div>
        {userTransactions.length != 0 ? (
          <Table className="pt-5 sm:pt-5 align-text-top">
            <TableHeader columns={columns} className="row-span-4 col-span-1">
              {(column) => (
                <TableColumn key={column.key}>{column.label}</TableColumn>
              )}
            </TableHeader>
            <TableBody items={userTransactions}>
              {(item) => (
                <TableRow key={item.key} className="row-span-4 col-span-1">
                  {(columnKey) => (
                    <TableCell className="w-32 ">
                      {getKeyValue(item, columnKey)}
                    </TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <p> no data avail </p>
        )}
      </div>
    );
  }
};

export default Home;
