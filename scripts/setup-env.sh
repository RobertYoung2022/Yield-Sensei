#!/bin/bash

# Setup script for YieldSensei environment configuration

echo "🚀 Setting up YieldSensei environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created!"
    echo "⚠️  Please edit .env file with your actual API keys"
else
    echo "✅ .env file already exists"
fi

# Check if Taskmaster is configured
if [ ! -f .taskmaster/config.json ]; then
    echo "📝 Setting up Taskmaster configuration..."
    npx task-master-ai models --setup
    echo "✅ Taskmaster configured!"
else
    echo "✅ Taskmaster configuration exists"
fi

# Check if Cursor MCP is configured
if [ ! -f .cursor/mcp.json ]; then
    echo "📝 Setting up Cursor MCP configuration..."
    echo "⚠️  Please manually configure .cursor/mcp.json with your API keys"
else
    echo "✅ Cursor MCP configuration exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your actual API keys"
echo "2. Restart Cursor IDE to load new MCP configuration"
echo "3. Run 'npm install' if you haven't already"
echo ""
echo "For help with API keys, visit:"
echo "- Anthropic: https://console.anthropic.com/"
echo "- Perplexity: https://www.perplexity.ai/settings/api"
echo "- OpenAI: https://platform.openai.com/api-keys"
echo "- Google: https://makersuite.google.com/app/apikey"
