/**
 * GraphQL Schema Index
 * Main schema file that stitches together all modular schemas
 */

import { gql } from 'graphql-tag';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';

// Import all schema modules
import { portfolioTypeDefs, portfolioResolvers } from './portfolio';
import { satelliteTypeDefs, satelliteResolvers } from './satellite';
import { riskAssessmentTypeDefs, riskAssessmentResolvers } from './risk-assessment';
import { marketDataTypeDefs, marketDataResolvers } from './market-data';
import { transactionTypeDefs, transactionResolvers } from './transaction';
import { userTypeDefs, userResolvers } from './user';
import { analyticsTypeDefs, analyticsResolvers } from './analytics';

// Base schema with common types and directives
const baseTypeDefs = gql`
  # Common scalar types
  scalar DateTime
  scalar JSON
  scalar Decimal

  # Common interfaces
  interface Node {
    id: ID!
  }

  interface Timestamped {
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Common input types
  input PaginationInput {
    page: Int = 1
    limit: Int = 10
  }

  input SortInput {
    field: String!
    order: SortOrder = DESC
  }

  enum SortOrder {
    ASC
    DESC
  }

  # Common response types
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    totalCount: Int!
  }

  type Connection {
    pageInfo: PageInfo!
    edges: [Edge!]!
  }

  type Edge {
    node: Node!
    cursor: String!
  }

  # Error types
  type GraphQLError {
    message: String!
    code: String!
    path: [String!]
    extensions: JSON
  }

  # Query and Mutation root types
  type Query {
    _: Boolean
  }

  type Mutation {
    _: Boolean
  }

  type Subscription {
    _: Boolean
  }
`;

// Merge all type definitions
export const typeDefs = mergeTypeDefs([
  baseTypeDefs,
  portfolioTypeDefs,
  satelliteTypeDefs,
  riskAssessmentTypeDefs,
  marketDataTypeDefs,
  transactionTypeDefs,
  userTypeDefs,
  analyticsTypeDefs,
]);

// Merge all resolvers
export const resolvers = mergeResolvers([
  portfolioResolvers,
  satelliteResolvers,
  riskAssessmentResolvers,
  marketDataResolvers,
  transactionResolvers,
  userResolvers,
  analyticsResolvers,
]);

// Export individual schemas for modular use
export {
  portfolioTypeDefs,
  portfolioResolvers,
  satelliteTypeDefs,
  satelliteResolvers,
  riskAssessmentTypeDefs,
  riskAssessmentResolvers,
  marketDataTypeDefs,
  marketDataResolvers,
  transactionTypeDefs,
  transactionResolvers,
  userTypeDefs,
  userResolvers,
  analyticsTypeDefs,
  analyticsResolvers,
}; 