import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "@/app/App";
import { ensureAppSettings } from "@/lib/db";

import "@/styles.css";

import { registerSW } from "virtual:pwa-register";

ensureAppSettings().catch(() => undefined);
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
