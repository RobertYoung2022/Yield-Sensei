/**
 * Request Logger Middleware
 * Logs all incoming requests with relevant details
 */

import { Request, Response, NextFunction } from 'express';
import { getLogger } from "../../shared/utils/logger";

const logger = getLogger('request-logger');

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const requestIdHeader = req.headers['x-request-id'];
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : (requestIdHeader || generateRequestId());
  
  // Ensure requestId is always a string
  const finalRequestId = requestId || generateRequestId();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', finalRequestId);

  // Log request details
  const requestLog = {
    requestId: finalRequestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    headers: {
      'content-type': req.get('Content-Type'),
      'authorization': req.get('Authorization') ? '[REDACTED]' : undefined,
      'x-api-key': req.get('X-API-Key') ? '[REDACTED]' : undefined,
    },
  };

  logger.info('Incoming request:', requestLog);

  // Log response details
  const originalSend = res.send;
  res.send = function(data: any): Response {
    const responseTime = Date.now() - startTime;
    const responseLog = {
      requestId: finalRequestId,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: data ? data.length : 0,
      timestamp: new Date().toISOString(),
    };

    // Log based on status code
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error:', responseLog);
    } else {
      logger.info('Request completed successfully:', responseLog);
    }

    return originalSend.call(this, data);
  };

  next();
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
} 