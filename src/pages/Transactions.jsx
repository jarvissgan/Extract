import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Card, Divider, Loader, Table, Text } from "@mantine/core";
import { useNavigate, useParams } from "react-router";
import axiosInstance from "../../api/axios";

const Transactions = () => {
  const { isAuthenticated, isLoading } = useAuth0();
  const { sqid } = useParams();
  const navigate = useNavigate();

  if (!sessionStorage.getItem("sqid") && sqid) {
    sessionStorage.setItem("sqid", sqid);
  }

  const [userTransactions, setUserTransactions] = useState([]);
  const [currentMonthlySpending, setCurrentMonthlySpending] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(0);
  const [firstDate, setFirstDate] = useState("");
  const [lastDate, setLastDate] = useState("");

  useEffect(() => {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const formattedMonth = month.toString().padStart(2, "0");

    setCurrentMonth(new Date(year, month - 1).toLocaleString("en-us", { month: "long" }));
    setFirstDate(`${year}-${formattedMonth}-01`);
    setLastDate(`${year}-${formattedMonth}-${new Date(year, month, 0).getDate()}`);
  }, [sqid]);

  useEffect(() => {
    if (firstDate && lastDate && sqid) {
      axiosInstance
        .get(`/transaction/user/${sqid}?startDate=${firstDate} 00:00:00&endDate=${lastDate} 00:00:00`)
        .then((res) => {
          const transactions = res.data;
          let total = 0;
          transactions.forEach((transaction) => {
            total += transaction.transaction_amount;
          });

          setUserTransactions(transactions);
          setCurrentMonthlySpending(total);
        })
        .catch((err) => {
          console.error(`Issues with retrieving transactions from sqid ${sqid}`, err);
        });
    }
  }, [firstDate, lastDate, sqid]);

  if (!isAuthenticated) {
    return <p>not authenticated</p>;
  }

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="w-full h-full p-5 sm:p-10">
      <Text>Transactions</Text>
      <div className="grid grid-flow-row sm:grid-flow-col grid-rows-1 grid-cols-1 sm:grid-cols-3 sm:grid-rows-4 gap-4 sm:gap-6 h-1/4 sm:h-1/6">
        <Card withBorder>
          <Text>Spending For {currentMonth}</Text>
          <Text>${currentMonthlySpending}</Text>
        </Card>
        <Card withBorder>
          <Text>Overview</Text>
        </Card>
        <Card withBorder>
          <Text>Insights</Text>
        </Card>
      </div>
      <Divider my="md" />
      {userTransactions.length ? (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Transaction Name</Table.Th>
              <Table.Th>Transaction Amount</Table.Th>
              <Table.Th>Transaction Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {userTransactions.map((item) => (
              <Table.Tr
                key={item.transaction_uuid}
                className="cursor-pointer"
                onClick={() =>
                  navigate(`/transactions/${sessionStorage.getItem("sqid")}/${item.transaction_uuid}`)
                }
              >
                <Table.Td>{item.transaction_name}</Table.Td>
                <Table.Td>{item.transaction_amount}</Table.Td>
                <Table.Td>{item.created_timestamp}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text>No data available.</Text>
      )}
    </div>
  );
};

export default Transactions;
