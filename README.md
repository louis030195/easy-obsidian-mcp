# mcp-obsidian

https://github.com/user-attachments/assets/99b16c89-24bf-4991-af65-68d21554b438

MCP server for Obsidian - Connect AI assistants to your Obsidian vault. One-line installation.

[Support the work 🙏](https://store.louis030195.com/l/easy-obsidian-mcp?layout=profile).

## Quick Start

```bash
# Set your API key and run
export OBSIDIAN_API_KEY="your-api-key-here"
npx -y @louis030195/mcp-obsidian
```

## Features

Provides tools to interact with your Obsidian vault, allowing you to:

- **Simple search** - Search notes content across your vault
- **Dataview search** - Search notes using Dataview query language (DQL) for advanced queries
- **Fuzzy search** - Find notes with approximate matching when you're not sure of exact spelling
- **Graph search** - Analyze links and connections between notes, find orphaned notes
- **Filesystem fallback** - New search tools work even when Obsidian REST API is unavailable

## Installation & Setup

### Prerequisites

1.  **Node.js and npm:** Make sure you have Node.js (which includes npm) installed. You can download it from [nodejs.org](https://nodejs.org).
2.  **Obsidian:** You need the Obsidian app installed.
3.  **Obsidian Local REST API Plugin:**
    *   Open Obsidian.
    *   Go to `Settings` -> `Community plugins`.
    *   Make sure `Restricted mode` is **off**.
    *   Click `Browse` and search for `Local REST API`.
    *   Install and **enable** the plugin.
    *   Go to the plugin's settings (Obsidian Settings -> Local REST API).
    *   Copy the `API Key` shown there. You'll need it soon.

### Setting up the Server

```bash
npx create-easy-obsidian-mcp
```

Follow the instructions to setup the server.

#### Optional: Vault Path Configuration

If the Obsidian REST API is unavailable, the server can fall back to filesystem-based search. By default, it looks for your vault in `~/Documents/Obsidian`. You can customize this by:

1. Setting the `OBSIDIAN_VAULT_PATH` environment variable
2. Using the `--vaultPath` command line argument

### Example Prompts

Try prompts like:

- "list the files in my obsidian vault"
- "search my obsidian notes for 'artificial intelligence'"
- "find my last 5 notes"
- "fuzzy search for 'artfcial inteligence'" (works with typos!)
- "show me the link graph starting from my index note"
- "find all orphaned notes with no connections"

### Debugging

Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for easier debugging:

```bash
npx @modelcontextprotocol/inspector node ./dist/index.js --apiKey <your-api-key>
```

