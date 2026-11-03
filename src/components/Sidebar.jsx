import { Button, Stack, Text, useMantineColorScheme } from "@mantine/core";
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
    <Stack gap="md">
      <Text fw={700}>LOGO</Text>
      <Stack gap="sm">
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
    </Stack>
  );
};

export default Sidebar;
