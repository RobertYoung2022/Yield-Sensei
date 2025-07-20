import { WasmIntegration } from '../src/core/orchestration/wasm-integration';
import init from '../src/core/orchestration/state/pkg/state.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to create a mock Response object
const createMockResponse = (url: string, wasmBuffer: Buffer): Response => {
    const mockResponse: Response = {
        arrayBuffer: () => Promise.resolve(wasmBuffer.buffer),
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        url: url,
        type: 'basic',
        redirected: false,
        body: null,
        bodyUsed: false,
        blob: () => Promise.resolve(new Blob([])),
        formData: () => Promise.resolve(new FormData()),
        clone: () => createMockResponse(url, wasmBuffer),
    };
    return mockResponse;
};

describe('WasmIntegration', () => {
    let wasmIntegration: WasmIntegration;

    beforeAll(async () => {
        // Ensure WebAssembly is available in the global scope
        if (typeof WebAssembly === 'undefined') {
            global.WebAssembly = require('node:wasi').WebAssembly; // Or a suitable polyfill
        }
    });

    beforeEach(async () => {
        // Ensure WebAssembly is available in the global scope
        if (typeof WebAssembly === 'undefined') {
            global.WebAssembly = require('node:wasi').WebAssembly; // Or a suitable polyfill
        }

        const wasmPath = join(__dirname, '../src/core/orchestration/state/pkg/state_bg.wasm');
        const wasmBuffer = readFileSync(wasmPath);
        const wasmModule = await WebAssembly.compile(wasmBuffer);

        await init(wasmModule);
        wasmIntegration = new WasmIntegration('test-actor');
        wasmIntegration.reset(); // Call the reset method
    });

    test('should increment the counter', () => {
        wasmIntegration.incrementCounter('test-actor');
        expect(wasmIntegration.getCounterValue()).toBe(1);
    });

    test('should merge state from another instance', () => {
        const otherWasmIntegration = new WasmIntegration('other-actor');
        otherWasmIntegration.incrementCounter('other-actor');
        otherWasmIntegration.incrementCounter('another-actor');

        wasmIntegration.mergeState(otherWasmIntegration);

        expect(wasmIntegration.getCounterValue()).toBe(3);
    });

    test('should handle multiple increments from the same actor', () => {
        wasmIntegration.incrementCounter('test-actor');
        wasmIntegration.incrementCounter('test-actor');
        wasmIntegration.incrementCounter('test-actor');
        expect(wasmIntegration.getCounterValue()).toBe(3);
    });
});
