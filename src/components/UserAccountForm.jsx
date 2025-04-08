import {
  addToast,
  Button,
  Checkbox,
  Form,
  Input,
  Tooltip,
  user,
} from "@heroui/react";
import axios from "axios";
import React from "react";
import { useNavigate } from "react-router";

const UserAccountForm = ({
  authentication_id,
  firstTime,
  username,
  email,
  accountStatus,
}) => {
  console.log(`First Time Setup: ${firstTime}`);
  const [isSelected, setIsSelected] = React.useState(false);
  const navigate = useNavigate();

  const routeToPage = (route) => {
    navigate(route);
  };

  let tooltip =
    "Unable to change email as you used this during the sign-up process.";

  const onSubmit = async (e) => {
    console.log(accountStatus);
    e.preventDefault();
    if (firstTime) {
      try {
        const res = await axios.post(`http://localhost:3000/api/user`, {
          username: username,
          user_details: "placeholder",
          email: email,
          preference_json: {
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
          console.log(`user ${username} created with sqid ${sqid}`);
          addToast({
            title: "Successfully Registered",
            variant: "flat",
            promise: new Promise((resolve) => setTimeout(resolve, 3000)),
          });
          routeToPage(`/home/${sqid}`);
        }
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`status ${error.response.status}: ${JSON.stringify(error.response.data.error)}`);
          addToast({
            title: "Unable to register, try again",
            variant: "flat",
            promise: new Promise((resolve) => setTimeout(resolve, 3000)),
          });
        } else if (error.response?.status === 500) {
          addToast({
            title: "Issues Contacting Server, Try again later",
            variant: "flat",
            promise: new Promise((resolve) => setTimeout(resolve, 3000)),
          });
        } else {
          console.error("Unexpected Error:", error);
        }
      }
    } else {
      //for modifying user
    }
  };

  return (
    <div>
      <Form
        className="w-full justify-center items-center space-y-4"
        onSubmit={onSubmit}>
        <div className="flex flex-col gap-4 max-w-md">
          <Input
            isRequired
            label="Username"
            name="username"
            placeholder="Enter your username"
            value={username}
          />
          <Tooltip content={tooltip}>
            <Input
              isRequired
              isReadOnly
              errorMessage={({ validationDetails }) => {
                if (validationDetails.valueMissing) {
                  return "Please enter your email";
                }
                if (validationDetails.typeMismatch) {
                  return "Please enter a valid email address";
                }
              }}
              label="Email"
              labelPlacement="inside"
              name="email"
              placeholder="Enter your email"
              type="email"
              value={email}
            />
          </Tooltip>

          <Checkbox isSelected={isSelected} onValueChange={setIsSelected}>
            I would like to receive email notifications
          </Checkbox>

          <div className="flex gap-4">
            <Button className="w-full" color="primary" type="submit">
              Submit
            </Button>
            <Button type="reset" variant="bordered">
              Reset
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
};

export default UserAccountForm;
