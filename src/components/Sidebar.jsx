import { Button, Card, CardBody } from "@heroui/react";
import React from "react";

function Sidebar() {
  return (
    <Card className="sideBarParentContainer">
      <CardBody>
        <div className="buttonContainer">
          <Button className="btnSideNav">Home</Button>
        </div>
        <div className="buttonContainer">
          <Button className="btnSideNav">Transactions</Button>
        </div>
        <div className="buttonContainer">
          <Button className="btnSideNav">Add Transactions</Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default Sidebar;
