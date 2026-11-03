import React from "react";
import { Button, Checkbox, Group, NumberInput, Stack, TextInput, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router";
import axiosInstance from "../../api/axios";

const UserAccountForm = ({
  firstTime,
  username,
  email,
  accountStatus,
}) => {
  const [isSelected, setIsSelected] = React.useState(false);
  const [monthlyBudget, setMonthlyBudget] = React.useState("");
  const navigate = useNavigate();

  const routeToPage = (route) => {
    navigate(route);
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!firstTime) {
      return;
    }

    try {
      const res = await axiosInstance.post(`/user`, {
        username,
        user_details: "",
        email,
        preference_json: {
          budgets: {
            monthly: monthlyBudget,
          },
          notifications: {
            email: isSelected,
          },
        },
        account_status: {
          status: accountStatus,
        },
      });

      const sqid = res.data.sqid;
      if (res.status === 200) {
        notifications.show({
          title: "Successfully Registered",
          message: `User ${username} created.`,
          color: "green",
        });
        routeToPage(`/home/${sqid}`);
      }
    } catch (error) {
      notifications.show({
        title: "Registration failed",
        message:
          error.response?.status === 500
            ? "Issues contacting server. Try again later."
            : "Unable to register, try again.",
        color: "red",
      });
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <Stack maw={420}>
        <TextInput required label="Username" placeholder="Enter your username" value={username} readOnly />

        <Tooltip label="Unable to change email as you used this during the sign-up process.">
          <TextInput required readOnly label="Email" placeholder="Enter your email" type="email" value={email} />
        </Tooltip>

        <NumberInput
          label="Monthly Budget"
          placeholder="Enter your monthly budget"
          prefix="$"
          decimalScale={2}
          allowNegative={false}
          value={monthlyBudget}
          onChange={setMonthlyBudget}
        />

        <Checkbox
          checked={isSelected}
          onChange={(event) => setIsSelected(event.currentTarget.checked)}
          label="I would like to receive email notifications"
        />

        <Group>
          <Button type="submit">Submit</Button>
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setMonthlyBudget("");
              setIsSelected(false);
            }}
          >
            Reset
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

export default UserAccountForm;
