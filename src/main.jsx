import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { HeroUIProvider } from "@heroui/react";
import { BrowserRouter, Routes, Route } from "react-router";
import Home from "./pages/Home.jsx";
import Sidebar from "./components/sidebar.jsx";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <HeroUIProvider>
      <div className="pageDiv">
        <div className="sideBarDiv">
          <Sidebar />
        </div>
        <div className="outletDiv">
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="home" element={<Home />} />
          </Routes>
        </div>
      </div>
    </HeroUIProvider>
  </BrowserRouter>
);
