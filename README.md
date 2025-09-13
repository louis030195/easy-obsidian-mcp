# @louis030195/mcp-obsidian

https://github.com/user-attachments/assets/99b16c89-24bf-4991-af65-68d21554b438

MCP server for Obsidian - Connect Claude, ChatGPT, and other AI assistants to your Obsidian vault. One-line installation.

[Support the work 🙏](https://store.louis030195.com/l/easy-obsidian-mcp?layout=profile)

## ✨ Quick Start

```bash
# 1. Set your Obsidian REST API key
export OBSIDIAN_API_KEY="your-api-key-here"

# 2. Run the server
npx -y @louis030195/mcp-obsidian
```

That's it! The server auto-detects your Obsidian vault and starts serving.

## 🚀 Features

- **🔍 Smart Search** - Natural language search across your entire vault
- **🧠 AI-Powered** - Works with Claude Desktop, ChatGPT, and any MCP-compatible AI
- **🎯 Fuzzy Search** - Find notes even with typos and spelling mistakes
- **🕸️ Graph Analysis** - Explore note connections, find orphaned notes
- **📊 Dataview Queries** - Execute complex queries if you have Dataview plugin
- **🔄 Auto-Detection** - Automatically finds your Obsidian vault location
- **💨 Fast Fallback** - Works even when Obsidian REST API is unavailable
- **🖥️ Cross-Platform** - Windows, macOS, and Linux support

## 📋 Prerequisites

1. **Obsidian** with the **Local REST API** plugin:
   - Open Obsidian → Settings → Community plugins
   - Turn off Restricted mode
   - Browse and install "Local REST API"
   - Enable the plugin and copy the API key

2. **Node.js** (for npx to work)
   - Download from [nodejs.org](https://nodejs.org) if you don't have it

## 🔧 Configuration

### Required Environment Variable

```bash
export OBSIDIAN_API_KEY="your-api-key-here"  # Get from Local REST API plugin settings
```

### Optional Environment Variables

```bash
export OBSIDIAN_PORT="27123"                 # Default: 27123
export OBSIDIAN_HOST="127.0.0.1"            # Default: 127.0.0.1  
export OBSIDIAN_VAULT_PATH="/path/to/vault" # Auto-detected if not set
```

## 🤖 Using with AI Assistants

### Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "@louis030195/mcp-obsidian"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Then restart Claude Desktop.

### Other MCP Clients

Any MCP-compatible client can use this server. Just run:
```bash
npx -y @louis030195/mcp-obsidian
```

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `obsidian_simple_search` | Search notes by content |
| `obsidian_fuzzy_search` | Find notes with typo tolerance |
| `obsidian_graph_search` | Analyze note connections and links |
| `obsidian_dataview_search` | Execute Dataview queries (requires plugin) |
| `obsidian_get_file_content` | Read a specific note |
| `obsidian_list_files` | List files and folders in vault |

## 💬 Example Prompts

- "Search my notes for machine learning"
- "Find all notes I created this week"
- "Show me orphaned notes with no links"
- "What meetings did I have last month?"
- "Find notes about project alpha"
- "List all my daily notes"

## 🔍 Troubleshooting

### API Key Issues
```bash
# Make sure the key is set
echo $OBSIDIAN_API_KEY

# Should show your key, not empty
```

### Connection Issues
- Ensure Obsidian is running
- Check Local REST API plugin is enabled
- Try accessing `http://127.0.0.1:27123` in browser (should show an error, confirming API is running)

### Vault Not Found
```bash
# Manually specify your vault path
export OBSIDIAN_VAULT_PATH="/Users/you/Documents/MyVault"
```

### Permission Denied
```bash
# On macOS/Linux, you might need to make it executable
chmod +x $(npm root -g)/@louis030195/mcp-obsidian/dist/cli.js
```

## 🏗️ Development

```bash
# Clone and setup
git clone https://github.com/louis030195/easy-obsidian-mcp
cd easy-obsidian-mcp
npm install
npm run build

# Run locally
export OBSIDIAN_API_KEY="your-key"
npm start

# Or use ts-node for development
npm run dev
```

## 📦 Publishing (Maintainers)

```bash
npm version patch  # or minor/major
npm run build
npm publish --access public
git push --tags
```

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT - See [LICENSE](LICENSE) file

## 🆘 Support

- [GitHub Issues](https://github.com/louis030195/easy-obsidian-mcp/issues)
- [Support the work](https://store.louis030195.com/l/easy-obsidian-mcp?layout=profile)

---

Made with ❤️ for the Obsidian community