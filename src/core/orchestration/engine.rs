"""// src/core/orchestration/engine.rs

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

pub struct Agent {
    id: String,
    receiver: mpsc::Receiver<String>,
}

impl Agent {
    pub fn new(id: String, receiver: mpsc::Receiver<String>) -> Self {
        Agent { id, receiver }
    }

    pub async fn run(&mut self) {
        while let Some(message) = self.receiver.recv().await {
            println!("Agent {} received message: {}", self.id, message);
        }
    }
}

pub struct OrchestrationEngine {
    agents: Arc<Mutex<HashMap<String, mpsc::Sender<String>>>>,
}

impl OrchestrationEngine {
    pub fn new() -> Self {
        OrchestrationEngine {
            agents: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn register_agent(&self, id: String) -> mpsc::Receiver<String> {
        let (sender, receiver) = mpsc::channel(100);
        self.agents.lock().unwrap().insert(id, sender);
        receiver
    }

    pub async fn send_message(&self, agent_id: &str, message: String) {
        if let Some(sender) = self.agents.lock().unwrap().get(agent_id) {
            sender.send(message).await.unwrap();
        }
    }
}
""