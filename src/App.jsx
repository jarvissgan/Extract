import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { NextUIProvider } from "@nextui-org/react";
import Home from "./pages/Home";
// import { Home } from

function App() {
  const [count, setCount] = useState(0);

  return <Home />;
}

export default App;
