import { BrowserRouter } from "react-router";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import AuthProvider from "./auth/AuthProvider";
import { UserProvider } from "./context/UserContext";
import AppRoutes from "./AppRoutes";

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <MantineProvider defaultColorScheme="dark">
        <ModalsProvider>
          <Notifications />
          <UserProvider>
            <AppRoutes />
          </UserProvider>
        </ModalsProvider>
      </MantineProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
