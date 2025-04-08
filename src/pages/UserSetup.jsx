import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import { Button, CircularProgress, Input } from "@heroui/react";
import UserAccountForm from "../components/UserAccountForm";
import { useNavigate } from "react-router";

//redirect users here after login.
//if user is already setup, redirect to home page
const UserSetup = () => {
  const { isAuthenticated, user, isLoading } = useAuth0();
  const navigate = useNavigate();

  let loading = false;
  const routeToPage = (route) => {
    navigate(route);
  };
  if (isLoading) {
    return <CircularProgress className="w-fit h-fit" aria-label="Loading..." />;
  }

  if (isAuthenticated) {
    loading = true;
    //check if user exists in db via email or authentication_id
    axios
      .get(`http://localhost:3000/api/user/?email=${user.email}`)
      .then((res) => {
        if (res.status == 202) {
          console.log("status 202 accepted: user not found");
          loading = false;
        }
        if (res.status === 200) {
          const result = res.data;
          console.log("result: ", result);

          const sqid = result.user_sqid;
          if (typeof sqid !== "string" || sqid.trim() === "") {
            console.log(`sqid is invalid or missing. Problem with database.`);
            addToast({
              title: "Issues with authentication... try again later",
              variant: "flat",
              promise: new Promise((resolve) => setTimeout(resolve, 3000)),
            });
          } else {
            console.log("sqid:", sqid);
            routeToPage(`/home/${sqid}`);
          }
        }
      })
      .catch((error) => {
        if (error.response.status === 404) {
          addToast({
            title: "Issues with authentication server... try again later",
            variant: "flat",
            promise: new Promise((resolve) => setTimeout(resolve, 3000)),
          });
          // return user flow to sign-up
        } else if (error.response.status === 500) {
          console.log("error.response.status: ", error.response.status);
          console.log(
            `status ${error.response.status}: ${JSON.stringify(
              error.response.data.error
            )}`
          );
          addToast({
            title: "Issues with contacting the server... try again later",
            variant: "flat",
            promise: new Promise((resolve) => setTimeout(resolve, 3000)),
          });
        } else {
          console.error("Error fetching user:", error);
        }
      });
  }
  return (
    <div className="dark">
      {!loading ? (
        <>
          <div className="flex justify-center">
            <CircularProgress
              className="text-blue-500"
              color="default"
              label="Loading..."
            />
            {/* <div class  ="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div> */}
          </div>
        </>
      ) : (
        <>
          <p>setup</p>
          <UserAccountForm
            authentication_id={user.sub}
            email={user.email}
            username={user.name}
            accountStatus={"active"}
            firstTime={true}
          />
        </>
      )}
    </div>
  );
};

export default UserSetup;
