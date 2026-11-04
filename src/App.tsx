import { BrowserRouter } from "react-router";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import AuthProvider from "./auth/AuthProvider";
import { UserProvider } from "./context/UserContext";
import AppRoutes from "./AppRoutes";
import { AppearanceProvider } from "./theme/Appearance";

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppearanceProvider>
        <ModalsProvider>
          <Notifications />
          <UserProvider>
            <AppRoutes />
          </UserProvider>
        </ModalsProvider>
      </AppearanceProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
