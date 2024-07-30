import React from "react";
import ReactDOM from "react-dom/client";
import ACAIResourceView from "./ACAIResourceView";
import "../index.css";

import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'

const client = new ApolloClient({
  uri:
    import.meta.env.VITE_APP_ATLAS_GRAPHQL_ENDPOINT ||
    'https://acai-resources-preview---symphony-api-svc-prod-25c5xl4maa-uk.a.run.app/graphql/',
  cache: new InMemoryCache(),
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ApolloProvider client={client}>
    <React.StrictMode>
      <ACAIResourceView />
    </React.StrictMode>
  </ApolloProvider>
);
