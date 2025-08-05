# Easy Installation Guide

## 🚀 Quick Start (Recommended)

```bash
npx easy-obsidian-mcp@latest
```

This single command will:
1. Install the MCP server
2. Ask for your Obsidian API key
3. Automatically configure your IDE(s)

## 📋 Step-by-Step Setup

### 1. Prerequisites

Before running the installer, make sure you have:

#### Node.js
- Download and install from [nodejs.org](https://nodejs.org)
- Verify installation: `node --version`

#### Obsidian with Local REST API Plugin
1. Open Obsidian
2. Go to **Settings** → **Community plugins**
3. Turn off **"Restricted mode"**
4. Click **"Browse"** and search for **"Local REST API"**
5. **Install** and **enable** the plugin
6. Go to **Settings** → **Local REST API**
7. **Copy the API Key** (you'll need this for the installer)

### 2. Run the Installer

```bash
npx easy-obsidian-mcp@latest
```

The installer will guide you through:
- ✅ Entering your Obsidian API key
- ✅ Configuring Cursor (if installed)
- ✅ Configuring Claude Desktop (if installed)
- ✅ Preparing VS Code for future MCP support

### 3. Restart Your Applications

After installation, restart:
- Cursor
- Claude Desktop
- Any other MCP-enabled applications

### 4. Test the Connection

Try these prompts in your AI assistant:
- "List files in my Obsidian vault"
- "Search my notes for 'project'"
- "Show me my recent notes"

## 🔧 Manual Configuration

If automatic setup fails, you can manually add the configuration:

### Cursor Configuration

File: `~/.cursor/mcp.json` (create if it doesn't exist)

```json
{
  "mcpServers": {
    "easy-obsidian-mcp": {
      "command": "npx",
      "args": ["easy-obsidian-mcp@latest", "--apiKey", "YOUR_API_KEY_HERE"]
    }
  }
}
```

### Claude Desktop Configuration

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "easy-obsidian-mcp": {
      "command": "npx",
      "args": ["easy-obsidian-mcp@latest", "--apiKey", "YOUR_API_KEY_HERE"]
    }
  }
}
```

## 🐛 Troubleshooting

### Common Issues

1. **"Command not found"**
   - Make sure Node.js is installed
   - Restart your terminal

2. **"API key invalid"**
   - Check the API key from Obsidian Settings → Local REST API
   - Make sure the Local REST API plugin is enabled

3. **"Configuration file not found"**
   - Create the directory manually if it doesn't exist
   - Check the file paths for your operating system

### Debug Mode

For detailed debugging, use the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx easy-obsidian-mcp@latest --apiKey YOUR_API_KEY
```

### Getting Help

- Check the [GitHub Issues](https://github.com/your-username/easy-obsidian-mcp/issues)
- Review the [MCP Documentation](https://modelcontextprotocol.io/)
- Join the community discussions

## 🔄 Updating

To update to the latest version, simply run the installer again:

```bash
npx easy-obsidian-mcp@latest
```

Since we use `@latest`, you'll always get the newest version automatically.