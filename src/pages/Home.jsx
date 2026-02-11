import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Card, Loader, Table, Text } from "@mantine/core";
import { useParams } from "react-router";
import axiosInstance from "../../api/axios";

const Home = () => {
  const { isAuthenticated, user, isLoading } = useAuth0();
  const { sqid } = useParams();

  if (!sessionStorage.getItem("sqid") && sqid) {
    sessionStorage.setItem("sqid", sqid);
  }

  const [userTransactions, setUserTransactions] = useState([]);
  const [currentMonthlySpending, setCurrentMonthlySpending] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [currentMonth, setCurrentMonth] = useState("");
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

          const formattedTransactions = transactions.map((transaction, index) => {
            total += transaction.transaction_amount;
            return {
              key: index,
              transaction_name: transaction.transaction_name,
              transaction_amount: transaction.transaction_amount,
              transaction_date: transaction.created_timestamp,
            };
          });

          setUserTransactions(formattedTransactions);
          setCurrentMonthlySpending(total);
        })
        .catch((err) => {
          console.error(`Issues with retrieving transactions from sqid ${sqid}`, err);
        });

      axiosInstance
        .get(`/user/${sqid}`)
        .then((res) => {
          const userPreferences = JSON.parse(res.data.preference_json);
          setMonthlyBudget(userPreferences.budgets.monthly);
        })
        .catch((err) => {
          console.error(`Issues with retrieving user data from sqid ${sqid}`, err);
        });
    }
  }, [firstDate, lastDate, sqid]);

  if (!isAuthenticated) {
    return <p>not authenticated</p>;
  }

  if (isLoading) {
    return <Loader />;
  }

  const rows = userTransactions.map((item) => (
    <Table.Tr key={item.key}>
      <Table.Td>{item.transaction_name}</Table.Td>
      <Table.Td>{item.transaction_amount}</Table.Td>
      <Table.Td>{item.transaction_date}</Table.Td>
    </Table.Tr>
  ));

  return (
    <div className="w-full h-full flex flex-col p-5 md:p-10">
      <Text>Hello, {user?.name}</Text>
      <div className="grid grid-flow-row md:grid-flow-col grid-rows-2 grid-cols-1 md:grid-cols-3 md:grid-rows-4 gap-4 md:gap-6">
        <Card withBorder>
          <Text>Spending For {currentMonth}</Text>
          <Text>${currentMonthlySpending}</Text>
        </Card>
        <Card withBorder>
          <Text>Monthly Budget Remaining</Text>
          <Text>
            ${monthlyBudget - currentMonthlySpending} / ${monthlyBudget}
          </Text>
        </Card>
        <Card withBorder>
          <Text>Summary</Text>
        </Card>
      </div>
      <div className="flex-1 pt-5 md:pt-10 h-full">
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Transaction Name</Table.Th>
              <Table.Th>Transaction Amount</Table.Th>
              <Table.Th>Transaction Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows.length ? rows : <Table.Tr><Table.Td colSpan={3}>No data to display for the month.</Table.Td></Table.Tr>}</Table.Tbody>
        </Table>
      </div>
    </div>
  );
};

export default Home;
