// src/core/orchestration/state/lib.rs

pub mod engine;

use crdts::{GCounter, CmRDT, CvRDT};
use wasm_bindgen::prelude::*;
use num_traits::cast::ToPrimitive;

#[wasm_bindgen]
pub struct StateManager {
    counter: GCounter<String>,
}

#[wasm_bindgen]
impl StateManager {
    #[wasm_bindgen(constructor)]
    pub fn new(actor_id: String) -> Self {
        let mut counter = GCounter::new();
        counter.apply(counter.inc(actor_id));
        StateManager { counter }
    }

    pub fn increment(&mut self, actor_id: String) {
        self.counter.apply(self.counter.inc(actor_id));
    }

    pub fn value(&self) -> u64 {
        self.counter.read().to_u64().unwrap_or(0)
    }

    pub fn merge(&mut self, other: StateManager) {
        self.counter.merge(other.counter);
    }

    pub fn reset(&mut self) {
        self.counter = GCounter::new();
    }
}
