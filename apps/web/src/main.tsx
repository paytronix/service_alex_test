import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ApolloProviderWrapper } from "./providers/ApolloProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ApolloProviderWrapper>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ApolloProviderWrapper>
    </BrowserRouter>
  </React.StrictMode>,
);
