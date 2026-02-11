import { Button, Card, Stack, Text } from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import { useNavigate } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import AddTransaction_ButtonModal from "./AddTransaction_ButtonModal.jsx";

const Sidebar = () => {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const navigate = useNavigate();
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();

  const routeToPage = (route) => navigate(route, { replace: true });

  const logoutUser = () => {
    sessionStorage.clear();
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  return (
    <div className="flex flex-col bg-gray-700 text-white p-3 gap-3 min-w-52">
      <Text fw={700}>LOGO</Text>
      <Card shadow="sm" radius="md" withBorder>
        <Stack>
          {isAuthenticated ? (
            <>
              <Button onClick={() => routeToPage(`/home/${sessionStorage.getItem("sqid")}`)}>Home</Button>
              <Button onClick={() => routeToPage(`/transactions/${sessionStorage.getItem("sqid")}`)}>
                Transactions
              </Button>
              <AddTransaction_ButtonModal />
              <Button variant="default" onClick={logoutUser}>
                Logout
              </Button>
              <Button
                variant="outline"
                onClick={() => setColorScheme(colorScheme === "light" ? "dark" : "light")}
              >
                {colorScheme === "light" ? "Dark Mode" : "Light Mode"}
              </Button>
            </>
          ) : (
            <Button
              onClick={async () =>
                loginWithRedirect({
                  appState: { targetUrl: window.location.pathname },
                })
              }
            >
              Login
            </Button>
          )}
        </Stack>
      </Card>
    </div>
  );
};

export default Sidebar;
