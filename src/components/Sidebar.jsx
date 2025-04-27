import { Button, Card, CardBody } from "@heroui/react";
import { useNavigate } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useTheme } from "@heroui/use-theme";

const Sidebar = () => {
  const { theme, setTheme } = useTheme();

  const navigate = useNavigate();
  const { isAuthenticated } = useAuth0();

  const routeToPage = (route) => {
    navigate(route, { replace: true});
  };
  const { loginWithRedirect, logout } = useAuth0();

  const logoutUser = () => {
    //deletes session storage and redirects user to landing page
    sessionStorage.clear()
    logout({ logoutParams: { returnTo: window.location.origin } })
  };

  return (
    <div className="flex flex-col h-screen bg-gray-700">
      <div className="basis-15"></div>
      <Card className="basis-full rounded-none">
        <CardBody>
          {isAuthenticated && (
            <>
              <Button className="" onPress={() => routeToPage(`/home/${sessionStorage.getItem("sqid")}`)}>
                Home
              </Button>
              <Button className="" onPress={() => routeToPage(`/transactions/${sessionStorage.getItem("sqid")}`)}>
                Transactions
              </Button>
              <Button
                className=""
                onPress={() => console.log("add transaction")}>
                Add Transactions
              </Button>
              <Button
                className=""
                onPress={() =>
                  logoutUser()
                }>
                Logout
              </Button>
              {theme == "light" ? (
                <Button onPress={() => setTheme("dark")}>Dark Mode</Button>
              ) : (
                <Button onPress={() => setTheme("light")}>Light Mode</Button>
              )}
            </>
          )}
          {!isAuthenticated && (
            <>
              <Button
                className=""
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
