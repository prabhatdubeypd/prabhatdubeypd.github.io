import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";
import { DataProvider } from "./context/DataContext.jsx";

import { initAnalytics } from "./lib/analytics";
import { initCal } from "./lib/cal";
initAnalytics();
initCal();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SettingsProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </SettingsProvider>
  </StrictMode>
);