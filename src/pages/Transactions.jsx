import React, { Component, useEffect, useState } from "react";
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
import { Card, CardBody } from "@heroui/react";

const Home = () => {
  // let { sqid } = useParams();
  const sqid = "xiBoCpeN";
  const [userTransactions, setUserTransactions] = useState([]);
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

  useEffect(() => {
    axios
      .get(`http://localhost:3000/api/transaction/user/${sqid}`)
      .then((res) => {
        console.log("res: ", res.data);

        // Parse response data
        const transactions = res.data;

        // Transform data to fit table structure
        const formattedTransactions = transactions.map(
          (transaction, index) => ({
            key: index,
            transaction_name: transaction.transaction_name,
            transaction_amount: transaction.transaction_amount,
            transaction_date: transaction.created_timestamp,
          })
        );

        setUserTransactions(formattedTransactions);
      })
      .catch((err) => {
        console.error(
          `Issues with retrieving transactions from sqid ${sqid}`,
          err
        );
      });
  }, [sqid]); // Only re-run effect when `sqid` changes

  return (
    //routerOutletDiv
    <div>
      <p>TRANSACTIONS</p>
      {/* <Sidebar /> */}
      <div className="homeTransactionTable">
        <Table aria-label="Example table with dynamic content">
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn key={column.key}>{column.label}</TableColumn>
            )}
          </TableHeader>
          <TableBody items={userTransactions}>
            {(item) => (
              <TableRow key={item.key}>
                {(columnKey) => (
                  <TableCell>{getKeyValue(item, columnKey)}</TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Home;
