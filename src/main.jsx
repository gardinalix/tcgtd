import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../web/styles.css";
import "../web/cockpit.css";
import "./react.css";
import { App } from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
