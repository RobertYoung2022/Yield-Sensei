/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ["<rootDir>/tests/**/*.mts", "<rootDir>/tests/**/*.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node", "mts"],
  moduleDirectories: ["node_modules", "src"],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/core/(.*)$': '<rootDir>/src/core/$1',
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    '^@qdrant/js-client-rest$': '<rootDir>/__mocks__/@qdrant/js-client-rest.ts',
  },
};