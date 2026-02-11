import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router";
import UserAccountForm from "../components/UserAccountForm";
import axiosInstance from "../../api/axios";

const UserSetup = () => {
  const { isAuthenticated, user, isLoading } = useAuth0();
  const navigate = useNavigate();
  const [checkingUser, setCheckingUser] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      setCheckingUser(false);
      return;
    }

    axiosInstance
      .get(`/user/?email=${user.email}`)
      .then((res) => {
        if (res.status === 200) {
          const sqid = res.data.user_sqid;
          if (typeof sqid === "string" && sqid.trim()) {
            navigate(`/home/${sqid}`);
            return;
          }
        }

        if (res.status === 202) {
          setNeedsSetup(true);
          return;
        }

        notifications.show({
          title: "Authentication issue",
          message: "Problem with authentication, please try again.",
          color: "red",
        });
      })
      .catch(() => {
        notifications.show({
          title: "Unexpected error",
          message: "Unable to check account state.",
          color: "red",
        });
      })
      .finally(() => setCheckingUser(false));
  }, [isAuthenticated, navigate, user?.email]);

  if (isLoading || checkingUser) {
    return <Loader />;
  }

  if (!needsSetup) {
    return <Text>Preparing your account...</Text>;
  }

  return (
    <div>
      <Text fw={600} mb="sm">
        Finish your account setup
      </Text>
      <UserAccountForm
        authentication_id={user.sub}
        email={user.email}
        username={user.name}
        accountStatus="active"
        firstTime
      />
    </div>
  );
};

export default UserSetup;
