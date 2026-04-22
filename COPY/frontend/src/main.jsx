import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { LanguageProvider } from "./i18n/LanguageContext";
import AuthGate from "./components/AuthGate.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </LanguageProvider>
  </React.StrictMode>
);

if (import.meta.env.DEV) {
  const observer = new MutationObserver(() => {
    document.querySelectorAll("*").forEach((el) => {
      if (
        el.childNodes.length === 1 &&
        el.childNodes[0].nodeType === 3
      ) {
        const text = el.textContent.trim();

        if (
          text &&
          !text.startsWith("⚠️") &&
          text.length > 2 &&
          /^[A-Za-z ]+$/.test(text)
        ) {
          console.warn("⚠️ Raw text found:", text, el);
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
