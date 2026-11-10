import React from "react";
import ReactDOM from "react-dom/client";

import "./i18n";
import App from "./App";
import "./index.css";
import { ToastProvider } from "./contexts/ToastContext";
import { initAnalytics } from "./lib/analytics";
import { checkSessionOnStartup } from "./utils/sessionManager";

// Proactively check JWT expiry before app mounting
checkSessionOnStartup();
initAnalytics();
ReactDOM.createRoot(
    document.getElementById("root")
).render(
    <React.StrictMode>
        <ToastProvider>
            <App />
        </ToastProvider>
    </React.StrictMode>
);