#!/bin/bash

# Update Public View Branch Script
# This script safely updates the public-view branch from develop

set -e  # Exit on any error

echo "🔄 Updating public-view branch from develop..."

# Check if we're on develop branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
    echo "❌ Error: You must be on the develop branch to run this script"
    echo "Current branch: $CURRENT_BRANCH"
    echo "Please run: git checkout develop"
    exit 1
fi

# Ensure develop is up to date
echo "📥 Pulling latest changes from develop..."
git pull origin develop

# Switch to public-view branch
echo "🔄 Switching to public-view branch..."
git checkout public-view

# Merge develop into public-view (personal files will be ignored)
echo "🔀 Merging develop into public-view..."
git merge develop --no-edit

# Push the updated public-view branch
echo "📤 Pushing updated public-view branch..."
git push origin public-view

# Switch back to develop
echo "🔄 Switching back to develop branch..."
git checkout develop

echo "✅ Public view updated successfully!"
echo ""
echo "🌐 Public view available at:"
echo "https://github.com/RobertYoung2022/Yield-Sensei/tree/public-view"
echo ""
echo "📝 Note: Personal files (AI tools, configs, etc.) are automatically excluded"
echo "   thanks to the .gitignore patterns we set up."
