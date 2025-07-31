export interface PerformanceSLA {
  id: string;
  name: string;
  description: string;
  category: 'response_time' | 'throughput' | 'availability' | 'error_rate' | 'resource_usage';
  metrics: SLAMetric[];
  measurement: SLAMeasurement;
  compliance: SLACompliance;
  alerts: SLAAlert[];
  businessImpact: BusinessImpact;
}

export interface SLAMetric {
  name: string;
  target: number;
  unit: string;
  aggregation: 'avg' | 'p50' | 'p95' | 'p99' | 'max' | 'min';
  timeWindow: number; // in seconds
  threshold: {
    warning: number;
    critical: number;
  };
}

export interface SLAMeasurement {
  method: 'continuous' | 'periodic' | 'synthetic';
  frequency: number; // in seconds
  dataSource: string;
  retentionPeriod: number; // in days
}

export interface SLACompliance {
  target: number; // percentage (e.g., 99.9)
  violationTolerance: number; // allowed violations per time period
  measurementPeriod: 'hour' | 'day' | 'week' | 'month';
  penaltyThreshold?: number; // percentage below which penalties apply
}

export interface SLAAlert {
  severity: 'info' | 'warning' | 'critical';
  condition: string;
  recipients: string[];
  escalation: EscalationRule[];
}

export interface EscalationRule {
  delayMinutes: number;
  recipients: string[];
  action?: string;
}

export interface BusinessImpact {
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  costOfDowntime: number; // per hour
  affectedUsers: number;
  businessFunction: string;
}

export interface BenchmarkTarget {
  id: string;
  name: string;
  service: string;
  environment: 'development' | 'staging' | 'production';
  baselines: PerformanceBaseline[];
  targets: PerformanceTarget[];
  testScenarios: string[];
  lastUpdated: number;
}

export interface PerformanceBaseline {
  metric: string;
  value: number;
  unit: string;
  confidence: number; // percentage
  sampleSize: number;
  measuredAt: number;
  conditions: TestConditions;
}

export interface PerformanceTarget {
  metric: string;
  target: number;
  unit: string;
  percentile?: number;
  rationale: string;
  derivedFrom: 'baseline' | 'business_requirement' | 'industry_standard';
}

export interface TestConditions {
  concurrentUsers: number;
  duration: number;
  networkCondition: 'fast' | 'slow' | 'mobile';
  dataSize: string;
  cacheState: 'cold' | 'warm' | 'hot';
}

export class PerformanceSLAManager {
  private slas: Map<string, PerformanceSLA> = new Map();
  private benchmarks: Map<string, BenchmarkTarget> = new Map();
  private violations: SLAViolation[] = [];

  constructor() {
    this.initializeDefaultSLAs();
    this.initializeDefaultBenchmarks();
  }

  private initializeDefaultSLAs(): void {
    // API Response Time SLA
    this.addSLA({
      id: 'api-response-time',
      name: 'API Response Time',
      description: 'Maximum acceptable response time for API endpoints',
      category: 'response_time',
      metrics: [
        {
          name: 'response_time_p95',
          target: 500,
          unit: 'ms',
          aggregation: 'p95',
          timeWindow: 300,
          threshold: { warning: 400, critical: 800 }
        },
        {
          name: 'response_time_p99',
          target: 1000,
          unit: 'ms',
          aggregation: 'p99',
          timeWindow: 300,
          threshold: { warning: 800, critical: 1500 }
        }
      ],
      measurement: {
        method: 'continuous',
        frequency: 60,
        dataSource: 'application_metrics',
        retentionPeriod: 30
      },
      compliance: {
        target: 99.5,
        violationTolerance: 5,
        measurementPeriod: 'hour'
      },
      alerts: [
        {
          severity: 'warning',
          condition: 'response_time_p95 > 400ms for 5 minutes',
          recipients: ['dev-team@company.com'],
          escalation: [
            { delayMinutes: 15, recipients: ['lead-dev@company.com'] }
          ]
        }
      ],
      businessImpact: {
        priority: 'P1',
        costOfDowntime: 5000,
        affectedUsers: 10000,
        businessFunction: 'Core API Services'
      }
    });

    // System Availability SLA
    this.addSLA({
      id: 'system-availability',
      name: 'System Availability',
      description: 'System uptime and availability requirements',
      category: 'availability',
      metrics: [
        {
          name: 'uptime',
          target: 99.9,
          unit: '%',
          aggregation: 'avg',
          timeWindow: 3600,
          threshold: { warning: 99.5, critical: 99.0 }
        }
      ],
      measurement: {
        method: 'synthetic',
        frequency: 30,
        dataSource: 'health_checks',
        retentionPeriod: 90
      },
      compliance: {
        target: 99.9,
        violationTolerance: 0,
        measurementPeriod: 'month',
        penaltyThreshold: 99.5
      },
      alerts: [
        {
          severity: 'critical',
          condition: 'system_down for 2 minutes',
          recipients: ['oncall@company.com', 'management@company.com'],
          escalation: [
            { delayMinutes: 5, recipients: ['cto@company.com'], action: 'emergency_response' }
          ]
        }
      ],
      businessImpact: {
        priority: 'P0',
        costOfDowntime: 50000,
        affectedUsers: 100000,
        businessFunction: 'Entire Platform'
      }
    });

    // Error Rate SLA
    this.addSLA({
      id: 'error-rate',
      name: 'Error Rate',
      description: 'Maximum acceptable error rate for requests',
      category: 'error_rate',
      metrics: [
        {
          name: 'error_rate',
          target: 0.1,
          unit: '%',
          aggregation: 'avg',
          timeWindow: 300,
          threshold: { warning: 0.5, critical: 1.0 }
        }
      ],
      measurement: {
        method: 'continuous',
        frequency: 60,
        dataSource: 'application_logs',
        retentionPeriod: 30
      },
      compliance: {
        target: 99.9,
        violationTolerance: 3,
        measurementPeriod: 'day'
      },
      alerts: [
        {
          severity: 'warning',
          condition: 'error_rate > 0.5% for 3 minutes',
          recipients: ['dev-team@company.com'],
          escalation: [
            { delayMinutes: 10, recipients: ['ops-team@company.com'] }
          ]
        }
      ],
      businessImpact: {
        priority: 'P1',
        costOfDowntime: 2000,
        affectedUsers: 5000,
        businessFunction: 'User Experience'
      }
    });

    // Throughput SLA
    this.addSLA({
      id: 'throughput',
      name: 'System Throughput',
      description: 'Minimum required system throughput',
      category: 'throughput',
      metrics: [
        {
          name: 'requests_per_second',
          target: 1000,
          unit: 'rps',
          aggregation: 'avg',
          timeWindow: 300,
          threshold: { warning: 800, critical: 500 }
        }
      ],
      measurement: {
        method: 'continuous',
        frequency: 60,
        dataSource: 'load_balancer_metrics',
        retentionPeriod: 30
      },
      compliance: {
        target: 95.0,
        violationTolerance: 10,
        measurementPeriod: 'hour'
      },
      alerts: [
        {
          severity: 'warning',
          condition: 'throughput < 800 rps for 5 minutes',
          recipients: ['ops-team@company.com'],
          escalation: [
            { delayMinutes: 15, recipients: ['infrastructure-team@company.com'] }
          ]
        }
      ],
      businessImpact: {
        priority: 'P2',
        costOfDowntime: 1000,
        affectedUsers: 2000,
        businessFunction: 'System Capacity'
      }
    });

    // Resource Usage SLA
    this.addSLA({
      id: 'resource-usage',
      name: 'Resource Usage',
      description: 'System resource usage limits',
      category: 'resource_usage',
      metrics: [
        {
          name: 'cpu_usage',
          target: 70,
          unit: '%',
          aggregation: 'avg',
          timeWindow: 300,
          threshold: { warning: 80, critical: 90 }
        },
        {
          name: 'memory_usage',
          target: 75,
          unit: '%',
          aggregation: 'avg',
          timeWindow: 300,
          threshold: { warning: 85, critical: 95 }
        }
      ],
      measurement: {
        method: 'continuous',
        frequency: 60,
        dataSource: 'system_metrics',
        retentionPeriod: 7
      },
      compliance: {
        target: 95.0,
        violationTolerance: 5,
        measurementPeriod: 'day'
      },
      alerts: [
        {
          severity: 'warning',
          condition: 'cpu_usage > 80% for 10 minutes',
          recipients: ['ops-team@company.com'],
          escalation: [
            { delayMinutes: 20, recipients: ['infrastructure-team@company.com'] }
          ]
        }
      ],
      businessImpact: {
        priority: 'P2',
        costOfDowntime: 500,
        affectedUsers: 1000,
        businessFunction: 'System Stability'
      }
    });
  }

  private initializeDefaultBenchmarks(): void {
    // API Service Benchmarks
    this.addBenchmark({
      id: 'api-service-benchmark',
      name: 'API Service Performance',
      service: 'api-gateway',
      environment: 'production',
      baselines: [
        {
          metric: 'response_time_p95',
          value: 250,
          unit: 'ms',
          confidence: 95,
          sampleSize: 10000,
          measuredAt: Date.now() - 86400000, // 24 hours ago
          conditions: {
            concurrentUsers: 100,
            duration: 3600,
            networkCondition: 'fast',
            dataSize: '1KB',
            cacheState: 'warm'
          }
        },
        {
          metric: 'throughput',
          value: 1500,
          unit: 'rps',
          confidence: 98,
          sampleSize: 5000,
          measuredAt: Date.now() - 86400000,
          conditions: {
            concurrentUsers: 500,
            duration: 1800,
            networkCondition: 'fast',
            dataSize: '2KB',
            cacheState: 'warm'
          }
        }
      ],
      targets: [
        {
          metric: 'response_time_p95',
          target: 300,
          unit: 'ms',
          percentile: 95,
          rationale: 'User experience requirement for interactive responses',
          derivedFrom: 'business_requirement'
        },
        {
          metric: 'response_time_p99',
          target: 500,
          unit: 'ms',
          percentile: 99,
          rationale: 'Acceptable for worst-case scenarios',
          derivedFrom: 'industry_standard'
        },
        {
          metric: 'throughput',
          target: 2000,
          unit: 'rps',
          rationale: 'Peak traffic capacity requirement',
          derivedFrom: 'business_requirement'
        },
        {
          metric: 'error_rate',
          target: 0.1,
          unit: '%',
          rationale: 'High reliability requirement',
          derivedFrom: 'business_requirement'
        }
      ],
      testScenarios: ['user-registration', 'data-retrieval', 'transaction-processing'],
      lastUpdated: Date.now()
    });

    // Database Performance Benchmarks
    this.addBenchmark({
      id: 'database-benchmark',
      name: 'Database Performance',
      service: 'primary-database',
      environment: 'production',
      baselines: [
        {
          metric: 'query_time_p95',
          value: 50,
          unit: 'ms',
          confidence: 99,
          sampleSize: 50000,
          measuredAt: Date.now() - 86400000,
          conditions: {
            concurrentUsers: 200,
            duration: 3600,
            networkCondition: 'fast',
            dataSize: '10MB',
            cacheState: 'hot'
          }
        }
      ],
      targets: [
        {
          metric: 'query_time_p95',
          target: 100,
          unit: 'ms',
          percentile: 95,
          rationale: 'Database performance requirement for application responsiveness',
          derivedFrom: 'baseline'
        },
        {
          metric: 'connection_pool_usage',
          target: 80,
          unit: '%',
          rationale: 'Maintain connection availability',
          derivedFrom: 'industry_standard'
        }
      ],
      testScenarios: ['read-heavy', 'write-heavy', 'mixed-workload'],
      lastUpdated: Date.now()
    });

    // Frontend Performance Benchmarks
    this.addBenchmark({
      id: 'frontend-benchmark',
      name: 'Frontend Performance',
      service: 'web-application',
      environment: 'production',
      baselines: [
        {
          metric: 'first_contentful_paint',
          value: 1200,
          unit: 'ms',
          confidence: 90,
          sampleSize: 1000,
          measuredAt: Date.now() - 86400000,
          conditions: {
            concurrentUsers: 50,
            duration: 1800,
            networkCondition: 'slow',
            dataSize: '500KB',
            cacheState: 'cold'
          }
        }
      ],
      targets: [
        {
          metric: 'first_contentful_paint',
          target: 1500,
          unit: 'ms',
          rationale: 'Good user experience on slow networks',
          derivedFrom: 'industry_standard'
        },
        {
          metric: 'largest_contentful_paint',
          target: 2500,
          unit: 'ms',
          rationale: 'Core Web Vitals requirement',
          derivedFrom: 'industry_standard'
        },
        {
          metric: 'cumulative_layout_shift',
          target: 0.1,
          unit: 'score',
          rationale: 'Visual stability requirement',
          derivedFrom: 'industry_standard'
        }
      ],
      testScenarios: ['page-load', 'navigation', 'form-submission'],
      lastUpdated: Date.now()
    });
  }

  addSLA(sla: PerformanceSLA): void {
    this.slas.set(sla.id, sla);
  }

  getSLA(id: string): PerformanceSLA | undefined {
    return this.slas.get(id);
  }

  getAllSLAs(): PerformanceSLA[] {
    return Array.from(this.slas.values());
  }

  addBenchmark(benchmark: BenchmarkTarget): void {
    this.benchmarks.set(benchmark.id, benchmark);
  }

  getBenchmark(id: string): BenchmarkTarget | undefined {
    return this.benchmarks.get(id);
  }

  getAllBenchmarks(): BenchmarkTarget[] {
    return Array.from(this.benchmarks.values());
  }

  checkSLACompliance(slaId: string, metrics: MetricValue[]): ComplianceResult {
    const sla = this.getSLA(slaId);
    if (!sla) {
      throw new Error(`SLA not found: ${slaId}`);
    }

    const results: MetricComplianceResult[] = [];
    let overallCompliant = true;

    for (const slaMetric of sla.metrics) {
      const metricValues = metrics.filter(m => m.name === slaMetric.name);
      if (metricValues.length === 0) {
        results.push({
          metric: slaMetric.name,
          compliant: false,
          reason: 'No data available',
          actualValue: null,
          targetValue: slaMetric.target,
          severity: 'critical'
        });
        overallCompliant = false;
        continue;
      }

      const latestValue = metricValues[metricValues.length - 1];
      const compliant = this.evaluateMetricCompliance(slaMetric, latestValue.value);
      
      if (!compliant.passed) {
        overallCompliant = false;
        
        // Record violation
        this.recordViolation({
          slaId,
          metricName: slaMetric.name,
          timestamp: Date.now(),
          actualValue: latestValue.value,
          targetValue: slaMetric.target,
          severity: compliant.severity,
          duration: 0 // Will be calculated elsewhere
        });
      }

      results.push({
        metric: slaMetric.name,
        compliant: compliant.passed,
        reason: compliant.reason,
        actualValue: latestValue.value,
        targetValue: slaMetric.target,
        severity: compliant.severity
      });
    }

    return {
      slaId,
      compliant: overallCompliant,
      checkedAt: Date.now(),
      results
    };
  }

  private evaluateMetricCompliance(metric: SLAMetric, actualValue: number): {
    passed: boolean;
    severity: 'info' | 'warning' | 'critical';
    reason: string;
  } {
    if (actualValue <= metric.target) {
      return {
        passed: true,
        severity: 'info',
        reason: 'Within target'
      };
    }

    if (actualValue <= metric.threshold.warning) {
      return {
        passed: false,
        severity: 'warning',
        reason: `Exceeds target (${metric.target}${metric.unit}) but within warning threshold`
      };
    }

    if (actualValue <= metric.threshold.critical) {
      return {
        passed: false,
        severity: 'critical',
        reason: `Exceeds warning threshold (${metric.threshold.warning}${metric.unit})`
      };
    }

    return {
      passed: false,
      severity: 'critical',
      reason: `Critical threshold exceeded (${metric.threshold.critical}${metric.unit})`
    };
  }

  private recordViolation(violation: SLAViolation): void {
    this.violations.push(violation);
  }

  getViolations(slaId?: string, since?: number): SLAViolation[] {
    let filtered = this.violations;
    
    if (slaId) {
      filtered = filtered.filter(v => v.slaId === slaId);
    }
    
    if (since) {
      filtered = filtered.filter(v => v.timestamp >= since);
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  generateComplianceReport(period: 'day' | 'week' | 'month' = 'day'): ComplianceReport {
    const now = Date.now();
    const periodMs = period === 'day' ? 86400000 : period === 'week' ? 604800000 : 2592000000;
    const since = now - periodMs;

    const slaReports: SLAComplianceReport[] = [];
    
    for (const sla of this.getAllSLAs()) {
      const violations = this.getViolations(sla.id, since);
      const totalViolations = violations.length;
      const criticalViolations = violations.filter(v => v.severity === 'critical').length;
      
      // Calculate compliance percentage (simplified)
      const complianceRate = Math.max(0, 100 - (totalViolations * 2)); // 2% penalty per violation
      
      slaReports.push({
        slaId: sla.id,
        slaName: sla.name,
        complianceRate,
        targetRate: sla.compliance.target,
        violations: totalViolations,
        criticalViolations,
        status: complianceRate >= sla.compliance.target ? 'compliant' : 'violated'
      });
    }

    const overallCompliance = slaReports.reduce((sum, report) => sum + report.complianceRate, 0) / slaReports.length;

    return {
      period,
      generatedAt: now,
      overallCompliance,
      slaReports,
      summary: {
        totalSLAs: slaReports.length,
        compliantSLAs: slaReports.filter(r => r.status === 'compliant').length,
        violatedSLAs: slaReports.filter(r => r.status === 'violated').length,
        totalViolations: slaReports.reduce((sum, r) => sum + r.violations, 0)
      }
    };
  }

  updateBaseline(benchmarkId: string, metric: string, newValue: number, conditions: TestConditions): void {
    const benchmark = this.getBenchmark(benchmarkId);
    if (!benchmark) {
      throw new Error(`Benchmark not found: ${benchmarkId}`);
    }

    const existingBaseline = benchmark.baselines.find(b => b.metric === metric);
    if (existingBaseline) {
      existingBaseline.value = newValue;
      existingBaseline.measuredAt = Date.now();
      existingBaseline.conditions = conditions;
    } else {
      benchmark.baselines.push({
        metric,
        value: newValue,
        unit: 'ms', // Default unit, should be configurable
        confidence: 95,
        sampleSize: 1000,
        measuredAt: Date.now(),
        conditions
      });
    }

    benchmark.lastUpdated = Date.now();
  }

  compareWithBaseline(benchmarkId: string, actualMetrics: MetricValue[]): BaselineComparison {
    const benchmark = this.getBenchmark(benchmarkId);
    if (!benchmark) {
      throw new Error(`Benchmark not found: ${benchmarkId}`);
    }

    const comparisons: MetricComparison[] = [];

    for (const actualMetric of actualMetrics) {
      const baseline = benchmark.baselines.find(b => b.metric === actualMetric.name);
      if (!baseline) {
        continue;
      }

      const percentageDiff = ((actualMetric.value - baseline.value) / baseline.value) * 100;
      const status = Math.abs(percentageDiff) <= 10 ? 'within_range' : 
                   percentageDiff > 10 ? 'degraded' : 'improved';

      comparisons.push({
        metric: actualMetric.name,
        baselineValue: baseline.value,
        actualValue: actualMetric.value,
        percentageDiff,
        status,
        unit: baseline.unit
      });
    }

    return {
      benchmarkId,
      comparedAt: Date.now(),
      comparisons
    };
  }
}

export interface MetricValue {
  name: string;
  value: number;
  timestamp: number;
  unit?: string;
}

export interface ComplianceResult {
  slaId: string;
  compliant: boolean;
  checkedAt: number;
  results: MetricComplianceResult[];
}

export interface MetricComplianceResult {
  metric: string;
  compliant: boolean;
  reason: string;
  actualValue: number | null;
  targetValue: number;
  severity: 'info' | 'warning' | 'critical';
}

export interface SLAViolation {
  slaId: string;
  metricName: string;
  timestamp: number;
  actualValue: number;
  targetValue: number;
  severity: 'warning' | 'critical';
  duration: number;
}

export interface ComplianceReport {
  period: 'day' | 'week' | 'month';
  generatedAt: number;
  overallCompliance: number;
  slaReports: SLAComplianceReport[];
  summary: {
    totalSLAs: number;
    compliantSLAs: number;
    violatedSLAs: number;
    totalViolations: number;
  };
}

export interface SLAComplianceReport {
  slaId: string;
  slaName: string;
  complianceRate: number;
  targetRate: number;
  violations: number;
  criticalViolations: number;
  status: 'compliant' | 'violated';
}

export interface BaselineComparison {
  benchmarkId: string;
  comparedAt: number;
  comparisons: MetricComparison[];
}

export interface MetricComparison {
  metric: string;
  baselineValue: number;
  actualValue: number;
  percentageDiff: number;
  status: 'improved' | 'within_range' | 'degraded';
  unit: string;
}