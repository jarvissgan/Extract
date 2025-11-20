import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "@mantine/core";
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
    <div>
      <p>404 link not found</p>
      {sessionStorage.getItem("sqid") && isAuthenticated ? (
        <Button
          onClick={() =>
            routeToPage(`/home/${sessionStorage.getItem("sqid")}`)
          }>
          Go Back to home
        </Button>
      ) : (
        <div>
          <p>You are no longer authenticated. Please reauthenticate!</p>
          <Button onClick={logoutUser}>
            Go Back to landing page
          </Button>
        </div>
      )}
    </div>
  );
};

export default FourOFour;
