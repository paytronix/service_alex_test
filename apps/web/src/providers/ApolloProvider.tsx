import React from "react";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink,
  ApolloLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL || "/graphql",
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem("accessToken");
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

function websocketUrl(): string {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured;
  const httpUrl = import.meta.env.VITE_API_URL || "/graphql";
  const absolute = httpUrl.startsWith("http")
    ? httpUrl
    : `${window.location.origin}${httpUrl}`;
  return absolute.replace(/^http/, "ws");
}

const wsLink = new GraphQLWsLink(
  createClient({
    url: websocketUrl(),
    lazy: true,
    retryAttempts: 5,
    connectionParams: () => {
      const token = localStorage.getItem("accessToken");
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  }),
);

const splitLink = ApolloLink.split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" && definition.operation === "subscription"
    );
  },
  wsLink,
  ApolloLink.from([authLink, httpLink]),
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: "cache-and-network" },
  },
});

export function ApolloProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}
