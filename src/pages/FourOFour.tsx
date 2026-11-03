import { useAuth0 } from "@auth0/auth0-react";
import { Button, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "react-router";

//404 not found
const FourOFour = () => {
  const { isAuthenticated, logout } = useAuth0();
  const navigate = useNavigate();

  const routeToPage = (route: any) => {
    navigate(route, { replace: true });
  };

  const logoutUser = () => {
    //deletes session storage and redirects user to landing page
    sessionStorage.clear()
    logout({ logoutParams: { returnTo: window.location.origin } })
  };

  return (
    <Stack p="xl" align="flex-start">
      <Title order={3}>404 link not found</Title>
      {sessionStorage.getItem("sqid") && isAuthenticated ? (
        <Button
          onClick={() =>
            routeToPage(`/home/${sessionStorage.getItem("sqid")}`)
          }>
          Go Back to home
        </Button>
      ) : (
        <Stack align="flex-start">
          <Text>You are no longer authenticated. Please reauthenticate!</Text>
          <Button onClick={logoutUser}>
            Go Back to landing page
          </Button>
        </Stack>
      )}
    </Stack>
  );
};

export default FourOFour;
