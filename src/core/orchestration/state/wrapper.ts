// src/core/orchestration/state/wrapper.ts

import { StateManager as WasmStateManager } from './pkg/state';

export class DistributedState {
    private manager: WasmStateManager;

    constructor(actorId: string) {
        this.manager = new WasmStateManager(actorId);
    }

    increment(actorId: string): void {
        this.manager.increment(actorId);
    }

    getValue(): bigint {
        return this.manager.value();
    }

    merge(other: DistributedState): void {
        this.manager.merge(other.manager);
    }
} 