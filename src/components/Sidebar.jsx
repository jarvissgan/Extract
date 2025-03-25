import { Button, Card, CardBody } from "@heroui/react";
import React from "react";
import { useNavigate } from "react-router";

function Sidebar() {
  const navigate = useNavigate();

  const routeToPage = (route) => {
    navigate(route);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-700">
      <div className="basis-15"></div>
      <Card className="basis-full">
        <CardBody>
          <Button className="pt-6" onPress={() => routeToPage("/home")}>
            Home
          </Button>
          <Button className="pt-6" onPress={() => routeToPage("/transactions")}>
            Transactions
          </Button>
          <Button className="pt-6" onPress={() => console.log("add transaction")}>
            Add Transactions
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

export default Sidebar;
