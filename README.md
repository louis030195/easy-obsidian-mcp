# Obsidian MCP Server

Connect Claude, ChatGPT, and other AI assistants to your Obsidian vault.

[Support this project 🙏](https://buy.stripe.com/fZu8wP2n7a34fix2LKgA800)

## Quick Start

### 1. Install in your AI app

**Claude Desktop:**
Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "@louis030195/mcp-obsidian"]
    }
  }
}
```

**Claude Code (Web):**
```bash
claude mcp add obsidian "npx -y @louis030195/mcp-obsidian" -s user
```

### 2. Enable Obsidian API (Optional - for full features)
- Open Obsidian → Settings → Community plugins
- Turn off Restricted mode → Search "Local REST API" → Install & Enable
- Copy the API key and add to your config:
  ```json
  "env": {
    "OBSIDIAN_API_KEY": "your-api-key-here"
  }
  ```

That's it! Your AI can now search and read your Obsidian notes.

## Other AI Apps

**Cursor:** Add to settings (Cmd+Shift+P → "Preferences: Open User Settings (JSON)"):
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
- [Support this project](https://buy.stripe.com/fZu8wP2n7a34fix2LKgA800)

---

Made with ❤️ for the Obsidian community
