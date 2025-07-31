const { parentPort, workerData } = require('worker_threads');
const { performance } = require('perf_hooks');

class ScenarioExecutor {
  constructor(userId, scenario, thinkTime) {
    this.userId = userId;
    this.scenario = scenario;
    this.thinkTime = thinkTime;
    this.stepResults = [];
  }

  async execute() {
    try {
      for (const step of this.scenario.steps) {
        const stepResult = await this.executeStep(step);
        this.stepResults.push(stepResult);
        
        parentPort.postMessage({
          type: 'step-completed',
          data: stepResult
        });

        if (!stepResult.success) {
          throw new Error(`Step ${step.name} failed: ${stepResult.error}`);
        }

        // Apply think time between steps
        if (this.thinkTime > 0) {
          await this.wait(this.thinkTime);
        }
      }

      parentPort.postMessage({
        type: 'scenario-completed',
        data: {
          success: true,
          steps: this.stepResults
        }
      });
    } catch (error) {
      parentPort.postMessage({
        type: 'scenario-completed',
        data: {
          success: false,
          error: error.message,
          steps: this.stepResults
        }
      });
    }
  }

  async executeStep(step) {
    const startTime = Date.now();
    let success = false;
    let error = null;
    let retries = 0;
    const maxRetries = step.retries || 0;

    while (retries <= maxRetries && !success) {
      try {
        await this.performAction(step);
        success = true;
      } catch (err) {
        error = err.message;
        retries++;
        
        if (retries <= maxRetries) {
          await this.wait(Math.min(1000 * Math.pow(2, retries), 5000)); // Exponential backoff
        }
      }
    }

    const endTime = Date.now();

    return {
      name: step.name,
      startTime,
      endTime,
      duration: endTime - startTime,
      success,
      error,
      retries
    };
  }

  async performAction(step) {
    const timeout = step.timeout || 30000;
    
    switch (step.action) {
      case 'request':
        return await this.performRequest(step.params, timeout);
      
      case 'wait':
        return await this.wait(step.params.duration);
      
      case 'compute':
        return await this.performComputation(step.params);
      
      case 'database':
        return await this.performDatabaseOperation(step.params, timeout);
      
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  async performRequest(params, timeout) {
    const { url, method = 'GET', headers = {}, body } = params;
    const http = require(url.startsWith('https') ? 'https' : 'http');
    
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const options = {
        method,
        headers,
        timeout
      };

      const req = http.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const latency = endTime - startTime;
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data, latency });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.abort();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }

  async performComputation(params) {
    const { complexity = 1000000 } = params;
    let result = 0;
    
    // Simulate CPU-intensive work
    for (let i = 0; i < complexity; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    
    return { result };
  }

  async performDatabaseOperation(params, timeout) {
    const { operation, data } = params;
    
    // Simulate database contention
    const waitTime = Math.random() * 100;
    
    parentPort.postMessage({
      type: 'contention',
      data: {
        resource: 'database',
        timestamp: Date.now(),
        waitTime
      }
    });
    
    await this.wait(waitTime);
    
    // Simulate database operation
    switch (operation) {
      case 'read':
        return { data: `mock-data-${Date.now()}` };
      
      case 'write':
        return { id: `mock-id-${Date.now()}` };
      
      case 'update':
        return { updated: true };
      
      case 'delete':
        return { deleted: true };
      
      default:
        throw new Error(`Unknown database operation: ${operation}`);
    }
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
(async () => {
  const { userId, scenario, thinkTime } = workerData;
  const executor = new ScenarioExecutor(userId, scenario, thinkTime);
  
  try {
    await executor.execute();
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      data: {
        step: 'execution',
        error: error.message,
        stack: error.stack
      }
    });
  }
})();