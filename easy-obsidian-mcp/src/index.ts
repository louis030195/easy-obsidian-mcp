import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { Obsidian } from "./obsidian";

// --- Argument Parsing ---
async function parseArgs() {
  try {
    const argv = await yargs(hideBin(process.argv))
      .options({
        apiKey: {
          type: "string",
          demandOption: true,
          description: "obsidian local rest api key",
        },
        // Add other potential arguments here (e.g., port)
      })
      .strict() // Ensure only defined options are accepted
      .help()
      .alias("help", "h")
      .parseAsync();

    return { apiKey: argv.apiKey };
  } catch (error: any) {
    console.error("\nerror parsing arguments:", error.message);
    console.error(
      "please provide the required --apiKey argument.\nrun with --help for details."
    );
    process.exit(1);
  }
}

// --- MCP Server Setup ---
const server = new McpServer(
  {
    name: "easy-obsidian-mcp",
    version: "0.1.0",
    // Optional: Add description, icon, etc.
    description: "interact with your obsidian vault",
    // icon: "data:image/svg+xml;base64,..." // Add an icon if desired
  },
  {
    instructions: `
  you are a helpful assistant that can interact with a user's obsidian vault.
  you can use the following tools to interact with the vault:
  `,
  }
);

// Define schemas separately for clarity and type inference

const simpleSearchSchema = z.object({
  query: z.string().describe("text to a simple search for in the vault."),
  context_length: z
    .number()
    .optional()
    .default(100)
    .describe(
      "how much context to return around the matching string (default: 100)"
    ),
});

const dataviewSearchSchema = z.object({
  query: z
    .string()
    .describe("dataview query language (dql) query string to execute."),
});

// Helper type for the callback argument based on a schema
type ToolArgs<T extends z.ZodType<any, any, any>> = z.infer<T>;

// --- Start Server ---
async function main() {
  const { apiKey } = await parseArgs(); // Parse args first
  const obsidian = new Obsidian({
    apiKey,
    protocol: "http",
    host: "127.0.0.1",
    port: 27123,
  }); // Initialize obsidian here

  console.log("starting easy-obsidian-mcp server...");

  // --- Tool Definitions ---
  // Move tool definitions inside main or ensure callbacks close over obsidian
  // Keeping them outside but referencing 'obsidian' from main's scope should work due to closure.

  server.tool(
    "obsidian_simple_search",
    "simple search for documents matching a specified text query across all files in the vault. use this tool when you want to do a simple text search",
    simpleSearchSchema.shape,
    async (args: ToolArgs<typeof simpleSearchSchema>) => {
      const results = await obsidian.search(args.query, args.context_length);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  server.tool(
    "obsidian_dataview_search",
    `execute a dataview query language (dql) query. 
dql is a powerful, sql-like language for querying obsidian notes based on metadata (frontmatter, inline fields), tags, folders, links, file properties (name, path, dates), and tasks. use it to filter, sort, group, and transform data from your obsidian vault.

**key difference from sql:** dql executes queries sequentially, line by line, passing results between commands. this allows multiple 'where', 'sort', or 'group by' steps, unlike declarative sql.

**examples:**
- get the metadata, links, etc. of my note "MYNOTE":
  \`\`\`
  table file from "MYNOTE"
  \`\`\`


this tool is useful in pair with the "obsidian_simple_search" tool and is especially good at getting links between notes.

see dataview documentation for full syntax: https://blacksmithgu.github.io/obsidian-dataview/`,
    dataviewSearchSchema.shape,
    async (args: ToolArgs<typeof dataviewSearchSchema>) => {
      const results = await obsidian.searchDataview(args.query);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // --- Connect Server ---
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    console.log("easy-obsidian-mcp server connected and listening on stdio.");
  } catch (error) {
    console.error("failed to start or connect server:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("uncaught error:", error);
  process.exit(1);
});
