import { collectDefaultMetrics } from 'prom-client';

export function startMetricsServer() {
    collectDefaultMetrics();
}