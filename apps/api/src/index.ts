import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { useServer } from "graphql-ws/lib/use/ws";
import { WebSocketServer } from "ws";
import { schema } from "./schema";
import { createContext, GraphQLContext } from "./middleware/auth";

async function main() {
  const app = express();
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });

  const serverCleanup = useServer({ schema }, wsServer);

  const apolloServer = new ApolloServer<GraphQLContext>({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await apolloServer.start();

  app.use(
    "/graphql",
    cors<cors.CorsRequest>({
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    }),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => createContext(req),
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const PORT = parseInt(process.env.PORT || "4000", 10);
  httpServer.listen(PORT, () => {
    console.log(`🚀 API ready at http://localhost:${PORT}/graphql`);
    console.log(`🔌 Subscriptions at ws://localhost:${PORT}/graphql`);
  });
}

main().catch(console.error);
