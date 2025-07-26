/**
 * API Response Utilities
 * Provides consistent response formatting and pagination helpers
 */

import { Response } from 'express';
import { ApiResponse, PaginationQuery } from '../types/schemas';

/**
 * Send a successful API response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: ApiResponse<T>['meta']
): void {
  const response: ApiResponse<T> = {
    data,
    ...(meta && { meta }),
  };

  res.status(statusCode).json(response);
}

/**
 * Send a paginated API response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  query: PaginationQuery,
  baseUrl: string
): void {
  const { page = 1, limit = 10 } = query;
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const meta = {
    total,
    page,
    limit,
    totalPages,
    hasNext,
    hasPrev,
  };

  const links = {
    self: `${baseUrl}?page=${page}&limit=${limit}`,
    ...(hasNext && { next: `${baseUrl}?page=${page + 1}&limit=${limit}` }),
    ...(hasPrev && { prev: `${baseUrl}?page=${page - 1}&limit=${limit}` }),
    first: `${baseUrl}?page=1&limit=${limit}`,
    last: `${baseUrl}?page=${totalPages}&limit=${limit}`,
  };

  const response: ApiResponse<T[]> = {
    data,
    meta,
    links,
  };

  res.status(200).json(response);
}

/**
 * Send a created response (201)
 */
export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

/**
 * Send a no content response (204)
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): void {
  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Build pagination metadata from query parameters
 */
export function buildPaginationMeta(
  total: number,
  query: PaginationQuery
): ApiResponse['meta'] {
  const { page = 1, limit = 10 } = query;
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNext,
    hasPrev,
  };
}

/**
 * Build pagination links
 */
export function buildPaginationLinks(
  query: PaginationQuery,
  baseUrl: string,
  total: number
): ApiResponse['links'] {
  const { page = 1, limit = 10 } = query;
  const totalPages = Math.ceil(total / limit);

  return {
    self: `${baseUrl}?page=${page}&limit=${limit}`,
    ...(page < totalPages && { next: `${baseUrl}?page=${page + 1}&limit=${limit}` }),
    ...(page > 1 && { prev: `${baseUrl}?page=${page - 1}&limit=${limit}` }),
    first: `${baseUrl}?page=1&limit=${limit}`,
    last: `${baseUrl}?page=${totalPages}&limit=${limit}`,
  };
}

/**
 * Add cache headers to response
 */
export function addCacheHeaders(
  res: Response,
  maxAge: number = 300,
  etag?: string
): void {
  res.set({
    'Cache-Control': `public, max-age=${maxAge}`,
    ...(etag && { 'ETag': etag }),
  });
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(res: Response): void {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  });
} 