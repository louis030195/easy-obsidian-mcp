# easy-obsidian-mcp

A simple MCP server to interact with Obsidian via its Local REST API plugin.
and can be installed in one line, even for non technical users.

## Features

Provides tools to interact with your Obsidian vault, allowing you to:

- Search notes
- Search notes using Dataview query language (DQL)

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

### Example Prompts

Try prompts like:

- "list the files in my obsidian vault"
- "search my obsidian notes for 'artificial intelligence'"
- find my last 5 notes

### Debugging

Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for easier debugging:

```bash
npx @modelcontextprotocol/inspector node ./dist/index.js --apiKey <your-api-key>
```

