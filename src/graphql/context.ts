/**
 * GraphQL Context
 * Context creation for GraphQL resolvers
 */

import { Request } from 'express';
import { GraphQLContext } from './server';

export function createContext(
  req: Request,
  dataSources: any,
  dataLoaders: any,
  pubsub: any
): GraphQLContext {
  // TODO: Implement authentication and user extraction
  const user = req.user || null;

  return {
    user,
    dataSources,
    dataLoaders,
    pubsub,
  };
} 