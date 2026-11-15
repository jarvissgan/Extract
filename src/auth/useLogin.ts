import { useAuth0 } from "@auth0/auth0-react";
import { getRemember, setRemember } from "./remember";

// Starts a login, recording whether to stay logged in after the browser closes.
// Without a choice, the one made last time on this device is kept.
export const useLogin = () => {
  const { loginWithRedirect } = useAuth0();
  return (returnTo = "/setup", remember = getRemember()) => {
    setRemember(remember);
    return loginWithRedirect({ appState: { returnTo } });
  };
};
