# GitHub Actions CI/CD

This repository uses GitHub Actions for automated testing, versioning, and publishing to npm.

## Workflows

### 1. Test (`test.yml`)
- **Triggers**: On every PR and push to main
- **Purpose**: Run tests across multiple OS (Ubuntu, Windows, macOS) and Node versions (18, 20)
- **Actions**: Build, test, type checking

### 2. Publish (`publish.yml`)
- **Triggers**: Automatically on push to main when package.json version changes
- **Purpose**: Publish to npm and create GitHub releases
- **Actions**: 
  - Check if version is new
  - Build and test
  - Publish to npm
  - Create GitHub release with tag

### 3. Release (`release.yml`)
- **Triggers**: Manual workflow dispatch
- **Purpose**: Bump version and create release PR
- **Actions**:
  - Bump version (patch/minor/major)
  - Create PR with version changes
  - Auto-publish when PR is merged

## Setup Requirements

### Required Secrets
Add these secrets to your repository settings (Settings → Secrets and variables → Actions):

1. **NPM_TOKEN** (Required)
   - Get from: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Create a new "Automation" token
   - Add to GitHub secrets

### Usage

#### Automatic Publishing
1. Update version in `easy-obsidian-mcp/package.json`
2. Commit and push to main
3. GitHub Actions will automatically publish to npm

#### Manual Release
1. Go to Actions tab
2. Select "Release" workflow
3. Click "Run workflow"
4. Choose version bump type (patch/minor/major)
5. Review and merge the created PR
6. Package will be published automatically

## Version Management

- **Patch** (0.0.X): Bug fixes, small changes
- **Minor** (0.X.0): New features, backwards compatible
- **Major** (X.0.0): Breaking changes

## Testing

Tests run automatically on:
- Every pull request
- Every push to main
- Three operating systems: Linux, Windows, macOS
- Two Node.js versions: 18, 20

## Monitoring

Check workflow status at:
https://github.com/louis030195/easy-obsidian-mcp/actions