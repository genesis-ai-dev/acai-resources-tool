import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider, ApolloClient, InMemoryCache } from "@apollo/client";
import ACAIResourceView from "./ACAIResourceView";
import "../index.css";

// Create an Apollo Client instance
const client = new ApolloClient({
  uri: "YOUR_ATLAS_API_ENDPOINT", // Replace with the actual ATLAS API endpoint
  cache: new InMemoryCache(),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <ACAIResourceView />
    </ApolloProvider>
  </React.StrictMode>
);
