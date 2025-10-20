# Obsidian MCP Server

<img width="1495" height="429" alt="image" src="https://github.com/user-attachments/assets/ed3f9f26-ddbd-4baf-8fce-34b44cc3c30f" />


Connect Claude, ChatGPT, and other AI assistants to your Obsidian vault.

---

<div align="center">

### 💖 Support This Project

**If you find this MCP server useful, please consider supporting its development!**

[![Support via Stripe](https://img.shields.io/badge/Support-Stripe-635bff?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/fZu8wP2n7a34fix2LKgA800)

[**👉 Click here to support this project**](https://buy.stripe.com/fZu8wP2n7a34fix2LKgA800)

*Your support helps maintain and improve this tool. Thank you!* 🙏

</div>

---

## Quick Start

### 1. Install in your AI app

**Claude Desktop:**
Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):
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

**Claude Code:**
```bash
claude mcp add obsidian "npx -y @louis030195/mcp-obsidian" -s user -e OBSIDIAN_API_KEY="your-api-key-here"
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
