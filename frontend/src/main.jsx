import React from "react";
import ReactDOM from "react-dom/client";

import "./i18n";
import App from "./App";
import "./index.css";
import { ToastProvider } from "./contexts/ToastContext";
import { initAnalytics } from "./lib/analytics";
import { checkSessionOnStartup } from "./utils/sessionManager";
import { captureUtmFromUrl } from "./utils/utm";

// Proactively check JWT expiry and capture UTM before app mounting
checkSessionOnStartup();
initAnalytics();
captureUtmFromUrl();
ReactDOM.createRoot(
    document.getElementById("root")
).render(
    <React.StrictMode>
        <ToastProvider>
            <App />
        </ToastProvider>
    </React.StrictMode>
);