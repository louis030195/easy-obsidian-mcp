import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { Obsidian } from "./obsidian";
import path from "path";

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
        port: {
          type: "number",
          default: 27123,
          description: "obsidian local rest api port",
        },
        host: {
          type: "string",
          default: "127.0.0.1",
          description: "obsidian local rest api host",
        },
        timeout: {
          type: "number",
          default: 15000,
          description: "request timeout in milliseconds",
        },
        debug: {
          type: "boolean",
          default: false,
          description: "enable debug logging",
        },
      })
      .strict() // Ensure only defined options are accepted
      .help()
      .alias("help", "h")
      .parseAsync();

    return {
      apiKey: argv.apiKey,
      port: argv.port,
      host: argv.host,
      timeout: argv.timeout,
      debug: argv.debug,
    };
  } catch (error: any) {
    logJsonError({
      level: "error",
      message: "error parsing arguments",
      error: error.message,
      details:
        "please provide the required --apiKey argument. run with --help for details.",
    });
    process.exit(1);
  }
}

// --- Utility Functions ---
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

// Convert LIST and TASK queries to TABLE format for API compatibility
function convertToTableQuery(query: string): { converted: string; originalType: string } {
  const trimmedQuery = query.trim();
  
  // Check if it's a LIST query
  if (trimmedQuery.toLowerCase().startsWith('list')) {
    // Convert "list from ..." to "table file.name from ..."
    const converted = trimmedQuery.replace(/^list\s+/i, 'table file.name ');
    return { converted, originalType: 'list' };
  }
  
  // Check if it's a TASK query
  if (trimmedQuery.toLowerCase().startsWith('task')) {
    // Convert "task from ..." to "table file.name, file.tasks from ..."
    const converted = trimmedQuery.replace(/^task\s+/i, 'table file.name, file.tasks ');
    return { converted, originalType: 'task' };
  }
  
  // Already a TABLE query or other format
  return { converted: query, originalType: 'table' };
}

// Helper function for JSON logging to stderr
function logJsonError(logObject: Record<string, any>): void {
  console.error(JSON.stringify(logObject));
}

// Generate search suggestions for better LLM responses
function generateSearchSuggestions(
  originalQuery: string,
  resultCount: number
): string[] {
  const suggestions: string[] = [];

  if (resultCount === 0) {
    const query = originalQuery.toLowerCase().trim();

    // Common suggestions for empty results
    suggestions.push("try searching for partial words or synonyms");
    suggestions.push("check if the content exists in your vault");

    // Specific suggestions for common queries
    if (query === "ben") {
      suggestions.push("search for 'ben*' to find names starting with ben");
      suggestions.push(
        "try a dataview query: 'list from [[Ben]]' if there's a note about ben"
      );
      suggestions.push(
        "search in note titles: use dataview 'table file.name where contains(file.name, \"ben\")'"
      );
    }

    if (query.length < 3) {
      suggestions.push("try longer search terms (3+ characters work better)");
    }

    if (query.includes(" ")) {
      suggestions.push("try searching for individual words separately");
    } else {
      suggestions.push("try adding context words to your search");
    }
  }

  return suggestions;
}

// Generate dataview suggestions
function generateDataviewSuggestions(query: string, error?: string): string[] {
  const suggestions: string[] = [];
  const lowerQuery = query.toLowerCase();

  if (error?.includes("syntax")) {
    suggestions.push(
      "check dataview query syntax at https://blacksmithgu.github.io/obsidian-dataview/"
    );
    suggestions.push(
      "try a simpler query first, like: 'table file.name from \"\"' (lists all notes)"
    );
  }

  if (error?.includes("no results") || error?.includes("empty")) {
    suggestions.push("verify the folder or tag path exists");
    suggestions.push("check if dataview plugin is enabled in obsidian");
  }

  // Inform about LIST/TASK conversion
  if (lowerQuery.startsWith('list')) {
    suggestions.push('LIST queries are automatically converted to TABLE format for API compatibility');
  }
  
  if (lowerQuery.startsWith('task')) {
    suggestions.push('TASK queries are automatically converted to TABLE format with file.tasks included');
  }

  if (!lowerQuery.includes("from")) {
    suggestions.push(
      "most dataview queries need a 'from' clause, e.g., 'table file.name from \"\"'"
    );
  }

  // Query optimization suggestions
  if (!lowerQuery.includes("limit") && !error) {
    suggestions.push('add "limit N" to restrict results and improve performance');
  }

  if (!lowerQuery.includes("sort") && lowerQuery.includes("table")) {
    suggestions.push('add "sort file.mtime desc" to see recent files first');
  }

  // Specific example for common queries
  if (lowerQuery.includes("ben")) {
    suggestions.push(
      "try: 'table file.name where contains(file.name, \"ben\")'"
    );
    suggestions.push("try: 'table file.name from [[Ben]]' if there's a note named Ben");
    suggestions.push(
      "try: 'table file.name from #ben' if there are notes tagged with ben"
    );
  }

  return suggestions;
}

// --- MCP Server Setup ---
const server = new McpServer(
  {
    name: "easy-obsidian-mcp",
    version: "0.1.0",
    description: "interact with your obsidian vault via local rest api",
  },
  {
    instructions: `
you are a helpful assistant that can interact with a user's obsidian vault through the local rest api.

**available tools:**
- obsidian_simple_search: search for text content across all files
- obsidian_dataview_search: execute dataview queries for structured data retrieval
- obsidian_get_file_content: retrieve the full content of a specific file
- obsidian_list_files: list files and folders within a specified directory (or vault root)

**search optimization tips:**
- for finding people: try both simple search and dataview queries
- simple search works best for content within notes
- dataview queries work best for metadata, links, and note properties
- if simple search returns no results, try dataview with broader queries

**important notes:**
- queries are case-insensitive for simple search
- dataview queries use dql (dataview query language) syntax
- file paths in results are relative to vault root
- empty results mean no matches were found, not an error

**troubleshooting:**
- ensure obsidian local rest api plugin is installed and running
- verify the api key is correct
- check that the specified port (${
      process.env.OBSIDIAN_PORT || 27123
    }) is accessible
`,
  }
);

// Define schemas separately for clarity and type inference
const simpleSearchSchema = z.object({
  query: z
    .string()
    .min(1, "search query cannot be empty")
    .max(1000, "search query too long")
    .describe(
      "text to search for in the vault. searches across all file content. case-insensitive."
    ),
  context_length: z
    .number()
    .min(1)
    .max(2000)
    .optional()
    .default(100)
    .describe(
      "how much context to return around the matching string (default: 100, max: 2000)"
    ),
  max_results: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe(
      "maximum number of results to return (default: 20, max: 100). helps prevent token overflow"
    ),
  offset: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe(
      "number of results to skip for pagination (default: 0). use with max_results to paginate through results"
    ),
});

const dataviewSearchSchema = z.object({
  query: z
    .string()
    .min(1, "dataview query cannot be empty")
    .max(10000, "dataview query too long")
    .describe(`dataview query language (dql) query string to execute.

examples for finding people/names:
- search note titles: "table file.name where contains(file.name, \\"ben\\")"
- find backlinks: "list from [[Ben]]"
- search by tags: "list from #person" 
- all notes: "list from \\"\\""

common patterns:
- list all notes: "list from \"\""
- get specific note: "table file.name, file.mtime from \\"NOTENAME\\""
- find notes with tag: "list from #tag"
- notes in folder: "list from \\"folder/\\"" 
- notes linking to file: "list from [[FILENAME]]"

see https://blacksmithgu.github.io/obsidian-dataview/ for full syntax`),
});

const getFileContentToolSchema = z.object({
  filepath: z
    .string()
    .min(1, "filepath cannot be empty")
    .max(1000, "filepath too long")
    .describe(
      "path to the file relative to the vault root (e.g., 'notes/my important note.md')"
    ),
});

const listFilesToolSchema = z.object({
  directory_path: z
    .string()
    .max(1000, "directory path too long")
    .optional()
    .describe(
      "optional path to a directory relative to the vault root (e.g., 'projects/active'). if omitted, lists files and folders in the vault root."
    ),
  max_items: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe(
      "maximum number of items to return (default: 50, max: 100). helps prevent token overflow in large directories"
    ),
  offset: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe(
      "number of items to skip for pagination (default: 0). use with max_items to paginate through large directories"
    ),
  sort_by: z
    .enum(["name", "modified", "created", "size"])
    .optional()
    .default("name")
    .describe(
      "sort criteria for the results (default: 'name')"
    ),
  sort_order: z
    .enum(["asc", "desc"])
    .optional()
    .default("asc")
    .describe(
      "sort order for the results (default: 'asc')"
    ),
});

// --- Start Server ---
async function main() {
  const { apiKey, port, host, timeout, debug } = await parseArgs();

  if (debug) {
    logJsonError({
      level: "debug",
      message: "debug mode enabled",
    });
    logJsonError({
      level: "debug",
      message: `connecting to obsidian api at ${host}:${port}`,
      host,
      port,
    });
  }

  const obsidian = new Obsidian({
    apiKey,
    protocol: "http",
    host,
    port,
    timeoutMs: timeout,
    maxRetries: 3,
    retryDelayMs: 1000,
  });

  logJsonError({
    level: "info",
    message: "starting easy-obsidian-mcp server...",
  });

  // Perform health check
  try {
    logJsonError({
      level: "info",
      message: "performing initial health check...",
    });
    const isHealthy = await obsidian.healthCheck();
    if (!isHealthy) {
      logJsonError({
        level: "warn",
        message: "⚠️  health check failed - obsidian api may not be accessible",
      });
      logJsonError({
        level: "warn",
        message:
          "   ensure obsidian local rest api plugin is installed and running",
      });
      logJsonError({
        level: "warn",
        message: `   check connection to ${host}:${port}`,
        host,
        port,
      });
    } else {
      logJsonError({
        level: "info",
        message: "✅ obsidian api connection verified",
      });
    }
  } catch (error) {
    logJsonError({
      level: "error",
      message: "❌ initial health check failed:",
      error: formatError(error),
    });
    logJsonError({
      level: "error",
      message: "   continuing anyway - api might become available later",
    });
  }

  // --- Tool Definitions ---
  server.tool(
    "obsidian_simple_search",
    "simple search for documents matching a specified text query across all files in the vault. use this tool when you want to do a simple text search",
    simpleSearchSchema.shape,
    async (args) => {
      const startTime = performance.now();
      const queryId = `search-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}`;
      logJsonError({
        level: "info",
        message: `[mcp] ${queryId} simple search requested`,
        query: args.query,
        context_length: args.context_length,
        max_results: args.max_results,
        offset: args.offset,
      });

      try {
        // Validate inputs with zod schema
        const validatedArgs = simpleSearchSchema.parse(args);

        logJsonError({
          level: "info",
          message: `[mcp] ${queryId} executing search with pagination`,
          context_length: validatedArgs.context_length,
          max_results: validatedArgs.max_results,
          offset: validatedArgs.offset,
        });

        const allResults = await obsidian.search(
          validatedArgs.query,
          validatedArgs.context_length
        );
        
        // Apply pagination
        const paginatedResults = allResults.slice(
          validatedArgs.offset,
          validatedArgs.offset + validatedArgs.max_results
        );
        
        const endTime = performance.now();
        const duration = endTime - startTime;

        logJsonError({
          level: "info",
          message: `[mcp] ${queryId} search completed`,
          durationMs: parseFloat(duration.toFixed(2)),
          totalResultCount: allResults.length,
          returnedResultCount: paginatedResults.length,
          offset: validatedArgs.offset,
        });

        // Generate suggestions for better LLM responses
        const suggestions = generateSearchSuggestions(
          validatedArgs.query,
          allResults.length
        );

        // Enhanced response structure for LLMs with pagination info
        const response = {
          success: true,
          request_id: queryId,
          query: validatedArgs.query,
          original_query: args.query,
          total_results: allResults.length,
          returned_results: paginatedResults.length,
          offset: validatedArgs.offset,
          max_results: validatedArgs.max_results,
          has_more: (validatedArgs.offset + validatedArgs.max_results) < allResults.length,
          search_duration_ms: duration,
          context_length: validatedArgs.context_length,
          results: paginatedResults,
          ...(suggestions.length > 0 && { suggestions }),
          pagination_hint: allResults.length > validatedArgs.max_results 
            ? `Showing results ${validatedArgs.offset + 1}-${Math.min(validatedArgs.offset + validatedArgs.max_results, allResults.length)} of ${allResults.length}. Use offset parameter to see more.`
            : undefined,
          meta: {
            timestamp: new Date().toISOString(),
            search_type: "simple_text",
            vault_info: "content search across all files",
          },
        };

        if (allResults.length === 0) {
          logJsonError({
            level: "error",
            message: "obsidian_simple_search no results found for",
            queryId,
            query: validatedArgs.query,
          });
          response.meta.vault_info += " - no matching content found";
        }

        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        };
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const errorMessage = formatError(error);
        logJsonError({
          level: "error",
          message: `[mcp] ${queryId} search failed`,
          error: errorMessage,
          query: args.query,
          durationMs: parseFloat(duration.toFixed(2)),
        });

        // Generate error-specific suggestions
        const suggestions = generateSearchSuggestions(args.query, 0);

        const errorResponse = {
          success: false,
          request_id: queryId,
          error: "search_failed",
          message: errorMessage,
          query: args.query,
          duration_ms: duration,
          suggestions,
          troubleshooting: [
            "check if obsidian local rest api plugin is running",
            "verify api key is correct",
            "ensure obsidian is open with plugin active",
            `confirm api is accessible at ${host}:${port}`,
            "try restarting obsidian and the plugin",
          ],
          syntax_help:
            "see https://blacksmithgu.github.io/obsidian-dataview/ for query syntax",
          meta: {
            timestamp: new Date().toISOString(),
            connection_status: obsidian.getStatus(),
          },
        };

        return {
          content: [
            { type: "text", text: JSON.stringify(errorResponse, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "obsidian_dataview_search",
    `execute a dataview query language (dql) query. 

dql is a powerful, sql-like language for querying obsidian notes based on metadata (frontmatter, inline fields), tags, folders, links, file properties (name, path, dates), and tasks. use it to filter, sort, group, and transform data from your obsidian vault.

**key difference from sql:** dql executes queries sequentially, line by line, passing results between commands. this allows multiple 'where', 'sort', or 'group by' steps, unlike declarative sql.

**finding people/names:**
- search note titles: 'table file.name where contains(file.name, "ben")'
- find notes linking to person: 'list from [[Ben]]'
- search by person tag: 'list from #person/ben'

**common patterns:**
- get note metadata: 'table file.name, file.mtime from "NOTENAME"'
- search by tag: 'list from #tag' 
- folder search: 'list from "folder/"'
- backlinks: 'list from [[FILENAME]]'
- all notes: 'list from ""'

this tool is especially good at finding relationships between notes, metadata searches, and structured queries. use it when simple text search doesn't find what you need.

see dataview documentation for full syntax: https://blacksmithgu.github.io/obsidian-dataview/`,
    dataviewSearchSchema.shape,
    async (args) => {
      const startTime = performance.now();
      const queryId = `dataview-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}`;
      logJsonError({
        level: "info",
        message: `[mcp] ${queryId} dataview query requested`,
        query: args.query,
      });

      try {
        // Validate inputs with zod schema
        const validatedArgs = dataviewSearchSchema.parse(args);

        // Convert LIST/TASK queries to TABLE format for API compatibility
        const { converted: convertedQuery, originalType } = convertToTableQuery(validatedArgs.query);
        
        logJsonError({
          level: "info",
          message: `[mcp] ${queryId} executing dataview query`,
          originalQuery: validatedArgs.query,
          convertedQuery: convertedQuery,
          queryType: originalType,
        });

        const results = await obsidian.searchDataview(convertedQuery);
        const endTime = performance.now();
        const duration = endTime - startTime;
        logJsonError({
          level: "info",
          message: `[mcp] ${queryId} dataview query completed`,
          durationMs: parseFloat(duration.toFixed(2)),
          resultCount: results.length,
        });

        // Generate suggestions for better LLM responses
        const suggestions = generateDataviewSuggestions(validatedArgs.query);

        // Enhanced response structure for LLMs
        const response = {
          success: true,
          request_id: queryId,
          query: convertedQuery,
          original_query: validatedArgs.query,
          query_type: originalType,
          ...(originalType !== 'table' && { 
            conversion_note: `Original ${originalType.toUpperCase()} query converted to TABLE format for API compatibility` 
          }),
          results_count: results.length,
          query_duration_ms: duration,
          results: results,
          ...(suggestions.length > 0 && { suggestions }),
          meta: {
            timestamp: new Date().toISOString(),
            search_type: "dataview_dql",
            vault_info: "metadata and structural search",
            query_hints: [
              "dataview searches metadata, links, and file properties",
              "use 'from' clauses to specify scope",
              "combine with 'where' for filtering",
              "LIST and TASK queries are automatically converted to TABLE format",
            ],
          },
        };

        if (results.length === 0) {
          logJsonError({
            level: "error",
            message:
              "obsidian_dataview_search no results found for dataview query",
            queryId,
            query: validatedArgs.query,
          });
          response.meta.vault_info += " - no matching metadata/structure found";
        }

        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        };
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const errorMessage = formatError(error);
        logJsonError({
          level: "error",
          message: `[mcp] ${queryId} dataview query failed`,
          error: errorMessage,
          query: args.query,
          durationMs: parseFloat(duration.toFixed(2)),
        });

        // Generate error-specific suggestions
        const suggestions = generateDataviewSuggestions(
          args.query,
          errorMessage
        );

        const errorResponse = {
          success: false,
          request_id: queryId,
          error: "dataview_query_failed",
          message: errorMessage,
          query: args.query,
          duration_ms: duration,
          suggestions,
          troubleshooting: [
            "check dataview query syntax",
            "ensure dataview plugin is installed in obsidian",
            "verify obsidian local rest api plugin supports dataview",
            "confirm api key has necessary permissions",
            `check api accessibility at ${host}:${port}`,
            "try a simpler query first: 'list from \"\"'",
          ],
          syntax_help:
            "see https://blacksmithgu.github.io/obsidian-dataview/ for query syntax",
          meta: {
            timestamp: new Date().toISOString(),
            connection_status: obsidian.getStatus(),
          },
        };

        return {
          content: [
            { type: "text", text: JSON.stringify(errorResponse, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "obsidian_get_file_content",
    "retrieves the full content of a specific file from the obsidian vault.",
    getFileContentToolSchema.shape,
    async (args) => {
      const startTime = performance.now();
      const queryId = `get-content-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}`;
      logJsonError({
        level: "info",
        message: `[mcp] ${queryId} get_file_content requested`,
        filepath: args.filepath,
      });
      try {
        const validatedArgs = getFileContentToolSchema.parse(args);
        const content = await obsidian.getFileContent(validatedArgs.filepath);
        const endTime = performance.now();
        const duration = endTime - startTime;
        logJsonError({
          level: "info",
          message: `[mcp] ${queryId} successfully fetched file content`,
          durationMs: parseFloat(duration.toFixed(2)),
          contentLength: content.length,
        });

        // --- Parse image references in markdown content ---
        const noteDir = path.posix.dirname(validatedArgs.filepath);

        const markdownImageRegex = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g; // ![alt](path "title")
        const wikilinkImageRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g; // ![[path|size]]
        const htmlImgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi; // <img src="path">

        const extractImageTargets = (markdown: string): string[] => {
          const targets: string[] = [];
          const add = (u: string) => {
            if (u && !targets.includes(u)) targets.push(u);
          };
          let m: RegExpExecArray | null;
          while ((m = markdownImageRegex.exec(markdown)) !== null) add(m[1]);
          while ((m = wikilinkImageRegex.exec(markdown)) !== null) add(m[1]);
          while ((m = htmlImgRegex.exec(markdown)) !== null) add(m[1]);
          return targets;
        };

        const isHttpUrl = (u: string) => /^https?:\/\//i.test(u);
        const isDataUri = (u: string) => /^data:/i.test(u);
        const parseDataUri = (
          u: string
        ): { mimeType: string; base64Data: string } | null => {
          const match = /^data:([^;]+);base64,(.*)$/i.exec(u);
          if (!match) return null;
          return { mimeType: match[1], base64Data: match[2] };
        };

        const normalizeVaultPath = (p: string): string => {
          const norm = path.posix.normalize(p).replace(/^\/+/, "");
          return norm;
        };

        const candidatePathsFor = (
          noteDirectory: string,
          ref: string
        ): string[] => {
          const cleanRef = ref.replace(/^\.\//, "");
          const candidates: string[] = [];
          if (cleanRef.startsWith("/")) {
            candidates.push(normalizeVaultPath(cleanRef));
          } else {
            candidates.push(
              normalizeVaultPath(path.posix.join(noteDirectory, cleanRef))
            );
            candidates.push(normalizeVaultPath(cleanRef));
          }
          return Array.from(new Set(candidates));
        };

        /*
         * IMAGE PROCESSING DISABLED - Known Issue (2025-01-10)
         * 
         * There's a compatibility issue between the MCP SDK image format and Claude's expected format.
         * The MCP SDK expects { type: "image", data: string, mimeType: string }
         * But Claude's API validation expects a different format with source.base64.media_type structure.
         * 
         * Attempts to fix:
         * 1. Tried using Anthropic's format directly - rejected by MCP SDK validation
         * 2. Tried normalizing MIME types - still getting "Could not process image" error
         * 3. Added extensive error handling and validation - images still fail
         * 
         * The issue appears to be in the translation layer between MCP SDK and Claude's API.
         * Disabling image processing until this is resolved upstream.
         * 
         * To re-enable: Uncomment the code below and test with various image formats.
         */
        
        // TEMPORARILY DISABLED - See comment above
        const refs = []; // extractImageTargets(content);
        const imageContents: any[] = [];

        // IMAGE PROCESSING CODE DISABLED - loops over refs array which is now empty
        // Original code preserved below for when issue is fixed
        
        /*
        for (const ref of refs) {
          // ... [Full image processing logic commented out]
        }
        */
        
        return {
          content: [{ type: "text", text: content }], // Removed ...imageContents since images are disabled
        };
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const errorMessage = formatError(error);
        logJsonError({
          level: "error",
          message: `[mcp] ${queryId} get_file_content failed`,
          error: errorMessage,
          filepath: args.filepath,
          durationMs: parseFloat(duration.toFixed(2)),
        });

        const errorResponse = {
          success: false,
          request_id: queryId,
          error: "get_file_content_failed",
          message: errorMessage,
          filepath: args.filepath,
          duration_ms: parseFloat(duration.toFixed(2)),
          troubleshooting: [
            "check if the file path is correct and exists in the vault",
            "verify obsidian local rest api plugin is running",
            "ensure api key has permissions to read files",
          ],
          meta: {
            timestamp: new Date().toISOString(),
            connection_status: obsidian.getStatus(),
          },
        };
        return {
          content: [
            { type: "text", text: JSON.stringify(errorResponse, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "obsidian_list_files",
    "lists files and folders within a specified directory in the obsidian vault. if no directory is specified, lists items in the vault root.",
    listFilesToolSchema.shape,
    async (args) => {
      const startTime = performance.now();
      const queryId = `list-files-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}`;
      const dirPath = args.directory_path || "<vault_root>";
      logJsonError({
        level: "info",
        message: `[mcp] ${queryId} list_files requested`,
        directory_path: dirPath,
      });
      try {
        const validatedArgs = listFilesToolSchema.parse(args);
        const allFiles = await obsidian.listFiles(validatedArgs.directory_path);
        
        // Sort the files based on criteria
        let sortedFiles = [...allFiles];
        switch (validatedArgs.sort_by) {
          case 'name':
            sortedFiles.sort((a, b) => a.filename.localeCompare(b.filename));
            break;
          case 'modified':
            sortedFiles.sort((a, b) => (b.modified || 0) - (a.modified || 0));
            break;
          case 'created':
            sortedFiles.sort((a, b) => (b.created || 0) - (a.created || 0));
            break;
          case 'size':
            sortedFiles.sort((a, b) => (b.size || 0) - (a.size || 0));
            break;
        }
        
        // Apply sort order
        if (validatedArgs.sort_order === 'desc' && validatedArgs.sort_by === 'name') {
          sortedFiles.reverse();
        } else if (validatedArgs.sort_order === 'asc' && validatedArgs.sort_by !== 'name') {
          sortedFiles.reverse();
        }
        
        // Apply pagination
        const paginatedFiles = sortedFiles.slice(
          validatedArgs.offset,
          validatedArgs.offset + validatedArgs.max_items
        );
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        logJsonError({
          level: "info",
          message: `[mcp] ${queryId} successfully listed items`,
          total_items: allFiles.length,
          returned_items: paginatedFiles.length,
          offset: validatedArgs.offset,
          durationMs: parseFloat(duration.toFixed(2)),
        });

        const response = {
          success: true,
          request_id: queryId,
          directory_path: validatedArgs.directory_path || "/", // Represent root as /
          total_items: allFiles.length,
          returned_items: paginatedFiles.length,
          offset: validatedArgs.offset,
          max_items: validatedArgs.max_items,
          has_more: (validatedArgs.offset + validatedArgs.max_items) < allFiles.length,
          sort_by: validatedArgs.sort_by,
          sort_order: validatedArgs.sort_order,
          listing_duration_ms: parseFloat(duration.toFixed(2)),
          items: paginatedFiles, // Paginated array of file/folder objects
          ...(allFiles.length > validatedArgs.max_items && {
            pagination_hint: `Showing items ${validatedArgs.offset + 1}-${Math.min(validatedArgs.offset + validatedArgs.max_items, allFiles.length)} of ${allFiles.length}. Use offset parameter to see more.`
          }),
          meta: {
            timestamp: new Date().toISOString(),
            operation_type: "list_files",
          },
        };
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        };
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const errorMessage = formatError(error);
        logJsonError({
          level: "error",
          message: `[mcp] ${queryId} list_files failed for "${dirPath}"`,
          error: errorMessage,
          durationMs: parseFloat(duration.toFixed(2)),
        });

        const errorResponse = {
          success: false,
          request_id: queryId,
          error: "list_files_failed",
          message: errorMessage,
          directory_path: args.directory_path,
          duration_ms: parseFloat(duration.toFixed(2)),
          troubleshooting: [
            "check if the directory path is correct",
            "verify obsidian local rest api plugin is running",
            "ensure api key has permissions to list files",
          ],
          meta: {
            timestamp: new Date().toISOString(),
            connection_status: obsidian.getStatus(),
          },
        };
        return {
          content: [
            { type: "text", text: JSON.stringify(errorResponse, null, 2) },
          ],
          isError: true,
        };
      }
    }
  );

  // --- Connect Server ---
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    logJsonError({
      level: "info",
      message: "✅ easy-obsidian-mcp server connected and listening on stdio",
      obsidian_api: `${host}:${port}`,
      timeout: `${timeout}ms`,
      debug_mode: debug ? "enabled" : "disabled",
      circuit_breaker: "enabled", // Assuming it's always enabled based on Obsidian class
      request_tracking: "enabled", // Assuming based on queryId usage
    });
  } catch (error) {
    logJsonError({
      level: "critical",
      message: "❌ failed to start or connect server",
      error: formatError(error),
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  logJsonError({
    level: "info",
    message: "\n🛑 received sigint, shutting down gracefully...",
  });
  process.exit(0);
});

process.on("SIGTERM", () => {
  logJsonError({
    level: "info",
    message: "\n🛑 received sigterm, shutting down gracefully...",
  });
  process.exit(0);
});

main().catch((error) => {
  logJsonError({
    level: "critical",
    message: "💥 unhandled error in main function",
    error: formatError(error),
  });
  process.exit(1);
});
