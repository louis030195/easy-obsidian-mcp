# Obsidian MCP Server

https://github.com/user-attachments/assets/99b16c89-24bf-4991-af65-68d21554b438

Connect Claude, ChatGPT, and other AI assistants to your Obsidian vault.

[Support this project 🙏](https://buy.stripe.com/fZu8wP2n7a34fix2LK)

## Quick Start

1. **Install Obsidian Plugin**
   - Open Obsidian → Settings → Community plugins
   - Turn off Restricted mode
   - Search and install "Local REST API"
   - Enable it and copy the API key

2. **Set your API key**
   ```bash
   export OBSIDIAN_API_KEY="your-api-key-here"
   ```

3. **Run the server**
   ```bash
   npx -y @louis030195/mcp-obsidian
   ```

That's it! Your AI can now search and read your Obsidian notes.

## Setup with AI Apps

### Claude Desktop

Add to config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

Restart Claude Desktop.

### Claude Code (Web)

```bash
claude mcp add obsidian "npx -y @louis030195/mcp-obsidian" -s user -e OBSIDIAN_API_KEY="your-api-key-here"
```

### Cursor

Add to settings:
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

## What It Can Do

- Search all your notes
- Find notes even with typos
- Analyze connections between notes
- Execute Dataview queries
- Read specific notes
- List files and folders

## Example Questions

- "Search my notes for machine learning"
- "Find all notes I created this week" 
- "What meetings did I have last month?"
- "Show me orphaned notes"

## Troubleshooting

**Obsidian not connecting?**
- Make sure Obsidian is running
- Check Local REST API plugin is enabled
- Verify your API key is correct

**Need help?**
- [GitHub Issues](https://github.com/louis030195/easy-obsidian-mcp/issues)
- [Support this project](https://buy.stripe.com/fZu8wP2n7a34fix2LK)

---

Made with ❤️ for the Obsidian community