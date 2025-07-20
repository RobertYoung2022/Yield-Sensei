import * as wasm from '../state/pkg/state.js';

/**
 * Provides a type-safe and idiomatic TypeScript interface for the Rust WebAssembly StateManager.
 * This class abstracts away the direct WebAssembly interactions, offering a clean API
 * for managing distributed state.
 */
export class WasmIntegration {
    private stateManager: wasm.StateManager;

    /**
     * Creates a new instance of WasmIntegration, initializing the underlying Rust StateManager.
     * @param actorId A unique identifier for the actor associated with this StateManager instance.
     */
    constructor(actorId: string) {
        this.stateManager = new wasm.StateManager(actorId);
    }

    /**
     * Increments the counter associated with a specific actor ID in the Rust StateManager.
     * @param actorId The ID of the actor whose counter should be incremented.
     */
    incrementCounter(actorId: string) {
        this.stateManager.increment(actorId);
    }

    /**
     * Retrieves the current value of the counter from the Rust StateManager.
     * @returns The current counter value as a number.
     */
    getCounterValue(): number {
        return Number(this.stateManager.value());
    }

    /**
     * Merges the state from another WasmIntegration instance into this instance's StateManager.
     * This operation is typically used to synchronize state between different replicas or instances.
     * @param otherStateManager The other WasmIntegration instance whose state should be merged into this one.
     */
    mergeState(otherStateManager: WasmIntegration) {
        this.stateManager.merge(otherStateManager.stateManager);
    }

    /**
     * Resets the counter in the underlying Rust StateManager to its initial state.
     */
    reset() {
        this.stateManager.reset();
    }
}