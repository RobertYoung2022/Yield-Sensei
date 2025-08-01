# Public View Management

## Quick Update Process

### Update Public View from Develop Branch:
```bash
./scripts/update-public-view.sh
```

### Manual Process (if needed):
```bash
# 1. Ensure you're on develop and it's up to date
git checkout develop
git pull origin develop

# 2. Switch to public-view and merge develop
git checkout public-view
git merge develop --no-edit

# 3. Push the updated public-view
git push origin public-view

# 4. Switch back to develop
git checkout develop
```

## What Gets Updated

### ✅ Included in Public View:
- Core source code (`src/`)
- Project configuration (`package.json`, `tsconfig.json`)
- Documentation (`README.md`, `ARCHITECTURE.md`)
- Infrastructure (`deployments/`, `docker-compose.yml`)
- Development tools (`.gitignore`, `.eslintrc.js`)

### ❌ Excluded from Public View:
- Personal AI tools (`.claude/`, `.cursor/`, `.serena/`, `.taskmaster/`, `.gemini/`)
- Personal documentation (`CLAUDE.md`, `GEMINI.md`, `yield_sensei_PRD.txt`)
- Personal reports (`security-assessment-report.md`, etc.)
- Personal configs (`.mcp.json`, `env.template`)
- Backup files (`*.backup`)

## Workflow

### 1. Make Changes on Develop:
```bash
# Work normally on develop branch
git add .
git commit -m "feat: your changes"
git push origin develop
```

### 2. Update Public View:
```bash
# Run the update script
./scripts/update-public-view.sh
```

### 3. Share Public View:
- URL: https://github.com/RobertYoung2022/Yield-Sensei/tree/public-view
- Clean, professional presentation
- No personal files visible

## Safety Features

- ✅ Checks you're on the correct branch
- ✅ Handles errors gracefully
- ✅ Automatically switches back to develop
- ✅ Personal files are protected by .gitignore
- ✅ Clear feedback and status messages

## Troubleshooting

### If script fails:
1. Ensure you're on develop branch: `git checkout develop`
2. Ensure develop is up to date: `git pull origin develop`
3. Try manual process above

### If merge conflicts occur:
1. Resolve conflicts in public-view branch
2. Commit the resolution
3. Push: `git push origin public-view`
4. Switch back: `git checkout develop`
