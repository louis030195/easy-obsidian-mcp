# easy-obsidian-mcp

[![npm version](https://badge.fury.io/js/easy-obsidian-mcp.svg)](https://badge.fury.io/js/easy-obsidian-mcp)

A simple MCP server to interact with Obsidian via its Local REST API plugin. Install in one line, even for non-technical users.

![Demo](https://github.com/user-attachments/assets/99b16c89-24bf-4991-af65-68d21554b438)

[Support the work 🙏](https://store.louis030195.com/l/easy-obsidian-mcp?layout=profile)

## ⚡ Quick Install

### One-Line Installation

```bash
npx easy-obsidian-mcp@latest
```

That's it! The installer will:
- ✅ Ask for your Obsidian API key
- ✅ Automatically configure Cursor
- ✅ Automatically configure Claude Desktop
- ✅ Prepare VS Code for future MCP support

### Manual Installation Buttons

<div align="center">

| IDE | Install | Status |
|-----|---------|--------|
| **Cursor** | [📥 Add to Cursor](https://cursor.sh/settings) | ✅ Supported |
| **Claude Desktop** | [📥 Add to Claude](https://claude.ai/desktop) | ✅ Supported |
| **VS Code** | [📥 Add to VS Code](https://code.visualstudio.com/) | 🔄 Coming Soon |
| **Anthropic Console** | [📥 Add to Console](https://console.anthropic.com/) | 🔄 Coming Soon |

</div>

## 🔧 Manual Configuration

If the automatic setup doesn't work, you can manually add the server to your MCP configuration:

### Cursor

Add to `~/.cursor/mcp.json`:

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

### Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

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

## 📋 Prerequisites

1. **Node.js**: Download from [nodejs.org](https://nodejs.org)
2. **Obsidian**: Download from [obsidian.md](https://obsidian.md)
3. **Obsidian Local REST API Plugin**:
   - Open Obsidian → Settings → Community plugins
   - Turn off "Restricted mode"
   - Browse and install "Local REST API"
   - Enable the plugin
   - Copy the API key from plugin settings

## ✨ Features

- 🔍 **Search notes** - Find content across your vault
- 📊 **Dataview queries** - Use Obsidian's powerful query language
- 📝 **List files** - Browse your vault structure
- ⚡ **Fast setup** - One command installation
- 🔧 **Auto-configuration** - Works with Cursor and Claude Desktop

## 🚀 Usage Examples

Once installed, try these prompts in your AI assistant:

- "Search my obsidian notes for 'artificial intelligence'"
- "List the files in my obsidian vault"
- "Find my last 5 notes"
- "Show me notes tagged with #project"
- "Find notes modified today"

## 🛠 Development

For development or custom installations:

```bash
git clone https://github.com/your-username/easy-obsidian-mcp
cd easy-obsidian-mcp
npm install
npm run build
```

## 🐛 Debugging

Use the MCP Inspector for troubleshooting:

```bash
npx @modelcontextprotocol/inspector npx easy-obsidian-mcp@latest --apiKey YOUR_API_KEY
```

## 📄 License

ISC License

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests to our repository.

---

<div align="center">
Made with ❤️ for the Obsidian and MCP community
</div>

