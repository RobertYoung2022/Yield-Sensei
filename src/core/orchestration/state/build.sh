#!/bin/bash
set -e

# Navigate to the state crate directory
cd "$(dirname "$0")"

# Build the WebAssembly package
wasm-pack build --target web

echo "WebAssembly package built successfully!" 