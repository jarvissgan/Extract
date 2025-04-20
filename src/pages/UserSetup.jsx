import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import { addToast, Button, CircularProgress, Input } from "@heroui/react";
import UserAccountForm from "../components/UserAccountForm";
import { useNavigate } from "react-router";
import axiosInstance from "../../api/axios";

//redirect users here after login.
//if user is already setup, redirect to home page
const UserSetup = () => {
  const { isAuthenticated, user, isLoading } = useAuth0();
  const navigate = useNavigate();
  
  let loading = true;
  const routeToPage = (route) => {
    navigate(route);
  };
  if (isLoading) {
    return <CircularProgress className="w-fit h-fit" aria-label="Loading..." />;
  }

  if (isAuthenticated) {
    //check if user exists in db via email or authentication_id
    axiosInstance
      .get(`/user/?email=${user.email}`)
      .then((res) => {
        switch (res.status) {
          case 202:
            loading = false;
            console.log("status 202 accepted: user not found");
            break;
          case 200:
            loading = true;
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
            break;
          case 401:
            addToast({
              title: "Status 401: Problem with authentication occoured",
              variant: "flat",
              promise: new Promise((resolve) => setTimeout(resolve, 3000)),
            });
            console.error("Error:", error);
            break;
          default:
            loading = true;
            console.log("error la");
            addToast({
              title: "Unexpected Error Occured",
              variant: "flat",
              promise: new Promise((resolve) => setTimeout(resolve, 3000)),
            });
            console.error("Error:", error);
            break;
        }
      })
      .catch((error) => {
        addToast({
          title: "Unexpected Error Occured",
          variant: "flat",
          promise: new Promise((resolve) => setTimeout(resolve, 3000)),
        });
        console.error("Error:", error);
      });
  }
  return (
    <div className="dark">
      {loading ? (
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
