import { useState, type FormEvent } from "react";
import { Button, Checkbox, Group, NumberInput, Stack, TextInput, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import api, { errorStatus } from "../lib/api";

interface Props {
  username: string;
  email: string;
  onCreated: () => void | Promise<void>;
}

const UserAccountForm = ({ username, email, onCreated }: Props) => {
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState<number | string>("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await api.post("/user", {
        username,
        user_details: {},
        preference_json: {
          budgets: { monthly: monthlyBudget === "" ? "" : Number(monthlyBudget) },
          notifications: { email: emailNotifications },
        },
        account_status: { status: "active" },
      });
      notifications.show({
        title: "Account created",
        message: `Welcome, ${username}!`,
        color: "green",
      });
      await onCreated();
    } catch (error) {
      notifications.show({
        title: "Registration failed",
        message:
          errorStatus(error) === 500
            ? "Issues contacting server. Try again later."
            : "Unable to register, try again.",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <Stack>
        <TextInput label="Username" value={username} readOnly />

        <Tooltip label="This is the email you signed up with and can't be changed.">
          <TextInput label="Email" type="email" value={email} readOnly />
        </Tooltip>

        <NumberInput
          label="Monthly budget"
          placeholder="e.g. 1,500"
          prefix="$"
          thousandSeparator=","
          decimalScale={2}
          allowNegative={false}
          value={monthlyBudget}
          onChange={setMonthlyBudget}
        />

        <Checkbox
          checked={emailNotifications}
          onChange={(event) => setEmailNotifications(event.currentTarget.checked)}
          label="I would like to receive email notifications"
        />

        <Group justify="flex-end">
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setMonthlyBudget("");
              setEmailNotifications(false);
            }}
          >
            Reset
          </Button>
          <Button type="submit" loading={submitting}>
            Create account
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

export default UserAccountForm;
