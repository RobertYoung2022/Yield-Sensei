/**
 * GraphQL Server Setup
 * Apollo Server configuration with Express integration
 */

import { ApolloServer } from 'apollo-server-express';
import { Express } from 'express';
import { typeDefs, resolvers } from './schema';
import { createDataLoaders } from './dataloaders';
import { createDataSources } from './datasources';
import { createContext } from './context';

export interface GraphQLContext {
  user?: any;
  dataSources: any;
  dataLoaders: any;
  pubsub: any;
}

export async function createGraphQLServer(app: Express): Promise<ApolloServer> {
  // Create data sources
  const dataSources = createDataSources();
  
  // Create data loaders
  const dataLoaders = createDataLoaders(dataSources);
  
  // Create pubsub for subscriptions
  const pubsub = {
    asyncIterator: (eventName: string) => ({
      next: async () => ({ value: null, done: true }),
      return: async () => ({ value: undefined, done: true }),
      throw: async () => ({ value: undefined, done: true }),
    }),
    publish: (eventName: string, payload: any) => {
      // TODO: Implement real-time publishing
      console.log(`Publishing to ${eventName}:`, payload);
    },
  };

  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => createContext(req, dataSources, dataLoaders, pubsub),
    formatError: (error) => {
      // Custom error formatting
      console.error('GraphQL Error:', error);
      
      return {
        message: error.message,
        code: error.extensions?.['code'] || 'INTERNAL_SERVER_ERROR',
        path: error.path || [],
      };
    },
    plugins: [
      // TODO: Add Apollo plugins for monitoring, caching, etc.
    ],
    introspection: process.env['NODE_ENV'] !== 'production',
  });

  // Start the server
  await server.start();

  // Apply middleware to Express app
  server.applyMiddleware({
    app,
    path: '/graphql',
    cors: {
      origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
      credentials: true,
    },
  });

  console.log(`🚀 GraphQL server ready at http://localhost:${process.env['PORT'] || 4000}${server.graphqlPath}`);

  return server;
}

// Export for testing
export { typeDefs, resolvers }; 