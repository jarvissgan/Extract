import { Button, Card, CardBody } from "@heroui/react";
import React from "react";
import { useNavigate } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";

const Sidebar = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();

  const routeToPage = (route) => {
    navigate(route);
  };
  const { loginWithRedirect, logout } = useAuth0();

  return (
    <div className="flex flex-col h-screen bg-gray-700">
      <div className="basis-15"></div>
      <Card className="basis-full">
        <CardBody>
          {isAuthenticated && (
            <>
              <Button className="pt-6" onPress={() => routeToPage("/home")}>
                Home
              </Button>
              <Button
                className="pt-6"
                onPress={() => routeToPage("/transactions")}>
                Transactions
              </Button>
              <Button
                className="pt-6"
                onPress={() => console.log("add transaction")}>
                Add Transactions
              </Button>
              <Button
                className="pt-6"
                onPress={() =>
                  logout({ logoutParams: { returnTo: window.location.origin } })
                }>
                Logout
              </Button>
            </>
          )}
          {!isAuthenticated && (
            <>
              <Button
                className="pt-6"
                onPress={async () =>
                  await loginWithRedirect({
                    appState: { targetUrl: window.location.pathname },
                  })
                }>
                Login
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default Sidebar;
