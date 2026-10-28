import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../web/styles.css";
import "../web/cockpit.css";
import "./react.css";
import "./launch.css";
import "./tactical-system.css";
import "./hud-system-v2.css";
import "./ops-hud.css";
import "./alpha.css";
import "./navigation.css";
import "./military-hud.css";
import "./cockpit-bridge.css";
import "./wing-zero-cockpit.css";
import "./epyon-cockpit.css";
import "./unicorn-cockpit.css";
import "./barbatos-cockpit.css";
import "./kshatriya-cockpit.css";
import "./gquuuuuux-cockpit.css";
import { App } from "./App";
import { LocaleProvider } from "./i18n/LocaleProvider";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
);
