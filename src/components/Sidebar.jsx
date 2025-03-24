import { Button, Card, CardBody } from "@heroui/react";
import React from "react";
import Home from "../pages/Home.jsx";
import Transactions from "../pages/Transactions.jsx";
import { Navigate, useNavigate } from "react-router";

function Sidebar() {

  function navigateToRoute(route) {
    useNavigate(route);
  }

  return (
    <div className="flex flex-col h-screen bg-gray-700">
      <div className="basis-15"></div>
      <Card className="basis-full">
        <div className="grid grid-flow-row row-span-3 pt-6">
          <CardBody>
            <Button className="row-span-1 pt-6" onPress={useNavigate('/home')}>Home</Button>
            <Button className="row-span-1 pt-6" onPress={useNavigate('/transactions')}>Transactions</Button>
            <Button className="row-span-1 pt-6">Add Transactions</Button>
          </CardBody>
        </div>
      </Card>
    </div>
  );
}

export default Sidebar;
