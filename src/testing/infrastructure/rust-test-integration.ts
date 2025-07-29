/**
 * Rust Test Integration
 * Bridge between TypeScript and Rust testing environments
 */

import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { TestResult } from './core-testing-infrastructure';

export interface RustTestConfig {
  cargoPath: string;
  features?: string[];
  release?: boolean;
  nocapture?: boolean;
  testThreads?: number;
}

export interface CargoTestOutput {
  test: string;
  status: 'ok' | 'FAILED' | 'ignored';
  duration?: string;
  stdout?: string;
  stderr?: string;
}

export class RustTestRunner {
  private config: RustTestConfig;

  constructor(config: RustTestConfig) {
    this.config = config;
  }

  async runTests(testPattern?: string): Promise<TestResult[]> {
    const args = ['test'];
    
    if (testPattern) {
      args.push(testPattern);
    }

    if (this.config.release) {
      args.push('--release');
    }

    if (this.config.features?.length) {
      args.push('--features', this.config.features.join(','));
    }

    args.push('--', '--format', 'json');

    if (this.config.nocapture) {
      args.push('--nocapture');
    }

    if (this.config.testThreads) {
      args.push('--test-threads', this.config.testThreads.toString());
    }

    return new Promise((resolve, reject) => {
      const process = spawn('cargo', args, {
        cwd: this.config.cargoPath,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      const results: TestResult[] = [];

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
        this.parseCargoOutput(data.toString(), results);
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 || results.length > 0) {
          resolve(results);
        } else {
          reject(new Error(`Cargo test failed with code ${code}\nstderr: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  private parseCargoOutput(output: string, results: TestResult[]): void {
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as any;
        
        if (parsed.type === 'test' && parsed.event === 'ok') {
          results.push({
            name: parsed.name,
            status: 'passed',
            duration: this.parseDuration(parsed.exec_time || 0),
          });
        } else if (parsed.type === 'test' && parsed.event === 'failed') {
          results.push({
            name: parsed.name,
            status: 'failed',
            duration: this.parseDuration(parsed.exec_time || 0),
            error: new Error(parsed.stdout || 'Test failed'),
          });
        }
      } catch {
        // Ignore non-JSON lines
      }
    }
  }

  private parseDuration(nanos: number): number {
    return nanos / 1_000_000; // Convert nanoseconds to milliseconds
  }

  async runBenchmarks(): Promise<TestResult[]> {
    const args = ['bench', '--', '--format', 'json'];

    return new Promise((resolve, reject) => {
      const process = spawn('cargo', args, {
        cwd: this.config.cargoPath,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      let stdout = '';
      const results: TestResult[] = [];

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
        this.parseBenchOutput(data.toString(), results);
      });

      process.on('close', (code) => {
        if (code === 0 || results.length > 0) {
          resolve(results);
        } else {
          reject(new Error(`Cargo bench failed with code ${code}`));
        }
      });
    });
  }

  private parseBenchOutput(output: string, results: TestResult[]): void {
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as any;
        
        if (parsed.type === 'bench' && parsed.event === 'ok') {
          results.push({
            name: parsed.name,
            status: 'passed',
            duration: parsed.typical || 0,
            metadata: {
              type: 'benchmark',
              typical: parsed.typical,
              deviation: parsed.deviation,
              throughput: parsed.throughput,
            },
          });
        }
      } catch {
        // Ignore non-JSON lines
      }
    }
  }
}

export class UnifiedTestRunner {
  private rustRunners: Map<string, RustTestRunner> = new Map();

  addRustProject(name: string, config: RustTestConfig): void {
    this.rustRunners.set(name, new RustTestRunner(config));
  }

  async runAllRustTests(): Promise<Map<string, TestResult[]>> {
    const results = new Map<string, TestResult[]>();
    
    for (const [name, runner] of Array.from(this.rustRunners)) {
      try {
        const testResults = await runner.runTests();
        results.set(name, testResults);
      } catch (error) {
        console.error(`Failed to run Rust tests for ${name}:`, error);
        results.set(name, []);
      }
    }

    return results;
  }

  async runRustTestsForProject(projectName: string, testPattern?: string): Promise<TestResult[]> {
    const runner = this.rustRunners.get(projectName);
    if (!runner) {
      throw new Error(`No Rust test runner configured for project: ${projectName}`);
    }

    return runner.runTests(testPattern);
  }
}