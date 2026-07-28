import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../web/styles.css";
import "../web/cockpit.css";
import "./react.css";
import { App } from "./App";
import { LocaleProvider } from "./i18n/LocaleProvider";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
);
