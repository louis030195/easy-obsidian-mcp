import { z } from "zod";
import { performance } from "perf_hooks";

// Helper function for JSON logging to stderr
function logObsidianEvent(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  details: Record<string, any> = {}
): void {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      source: "obsidian.ts",
      message,
      ...details,
    })
  );
}

// --- Zod Schemas for API Responses ---

// Structure for a single match within a search result
const SearchMatchSchema = z.object({
  context: z.string().optional(), // Context might not always be present
  match: z.object({
    start: z.number(),
    end: z.number(),
  }),
});

// Structure for a single search result item
const SearchResultSchema = z.object({
  filename: z.string(),
  score: z.number().optional(), // Score might not always be present
  matches: z.array(SearchMatchSchema).optional(), // Matches might not be present
});

// Array of search results
const SearchResultsListSchema = z.array(SearchResultSchema);

// Structure for a single Dataview search result item
const DataviewResultSchema = z.object({
  filename: z.string().describe("Path to the matching file"),
  // The result can be any valid JSON type according to the spec
  result: z.any().describe("The result data derived from the Dataview query"),
});

// Array of Dataview search results
const DataviewResultsListSchema = z.array(DataviewResultSchema);

// Structure for health check response
const HealthCheckResponseSchema = z.object({
  status: z.string(),
  timestamp: z.number(),
  vault: z.string().optional(),
  plugin_version: z.string().optional(),
});

// --- Schemas for new file operations ---
const FileContentSchema = z
  .string()
  .describe("The content of the file as a string.");

const FileListItemSchema = z.object({
  filename: z.string(),
  path: z.string(),
  type: z.enum(["file", "folder"]),
  created: z.number().optional(), // Timestamp
  modified: z.number().optional(), // Timestamp
  size: z.number().optional(), // In bytes for files
});

const FileListSchema = z.array(FileListItemSchema);

// --- Input validation schemas ---
const SearchInputSchema = z.object({
  query: z
    .string()
    .min(1, "search query cannot be empty")
    .max(1000, "search query too long")
    .refine((val) => val.trim().length > 0, "query cannot be only whitespace"),
  contextLength: z.number().min(1).max(2000).default(100),
});

const DataviewInputSchema = z.object({
  query: z
    .string()
    .min(1, "dataview query cannot be empty")
    .max(10000, "dataview query too long")
    .refine((val) => val.trim().length > 0, "query cannot be only whitespace"),
});

const GetFileContentInputSchema = z.object({
  filepath: z
    .string()
    .min(1, "filepath cannot be empty")
    .max(1000, "filepath too long")
    .describe(
      "Path to the file relative to the vault root (e.g., 'Notes/My Note.md')"
    ),
});

const ListFilesInputSchema = z.object({
  directory_path: z
    .string()
    .max(1000, "directory_path too long")
    .optional()
    .describe(
      "Optional path to a directory relative to the vault root (e.g., 'Notes/Projects'). If omitted, lists files in the vault root."
    ),
});

// Circuit breaker for handling repeated failures
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private failureThreshold = 5,
    private cooldownMs = 30000 // 30 seconds
  ) {}

  isOpen(): boolean {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = "half-open";
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = "open";
    }
  }

  getStatus(): { state: string; failures: number; lastFailure: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailureTime,
    };
  }
}

// --- Obsidian API Client Class ---

export class Obsidian {
  private apiKey: string;
  private protocol: string;
  private host: string;
  private port: number;
  private timeoutMs: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private circuitBreaker: CircuitBreaker;
  private requestCounter = 0;

  constructor(options: {
    apiKey: string;
    protocol?: string;
    host?: string;
    port?: number;
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
  }) {
    if (!options.apiKey) {
      throw new Error("obsidian api key is required.");
    }

    // Auto-detect config if not provided
    const autoConfig = detectObsidianConfig();

    this.apiKey = options.apiKey;
    this.protocol = options.protocol ?? "http";
    this.host = options.host ?? autoConfig.host;
    this.port = options.port ?? autoConfig.port;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.circuitBreaker = new CircuitBreaker();

    logObsidianEvent("info", `initialized client: ${this.getBaseUrl()}`, {
      host: this.host,
      port: this.port,
    });
    logObsidianEvent("info", `configuration`, {
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
    });
  }

  private getBaseUrl(): string {
    return `${this.protocol}://${this.host}:${this.port}`;
  }

  private getHeaders(
    additionalHeaders: Record<string, string> = {}
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      ...additionalHeaders,
    };
  }

  private generateRequestId(): string {
    return `req-${++this.requestCounter}-${Date.now()}`;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private sanitizeQuery(query: string): string {
    // More aggressive query sanitization
    return query
      .trim()
      .replace(/[\r\n\t]+/g, " ") // Replace line breaks with spaces
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .replace(/[^\w\s\-_.()[\]{},"'<>:;?!@#$%^&*+=|\\`~]/g, "") // Remove unusual chars that might break API
      .slice(0, 1000); // Hard limit
  }

  private sanitizeDataviewQuery(query: string): string {
    // Less aggressive sanitization for dataview queries as they need special syntax
    return query
      .trim()
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\t/g, "  ") // Replace tabs with spaces
      .slice(0, 10000); // Hard limit
  }

  private async safeCall<T>(
    url: string,
    options: RequestInit,
    responseSchema?: z.ZodType<T>,
    retryCount: number = 0
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const startTime = performance.now();

    // Circuit breaker check
    if (this.circuitBreaker.isOpen()) {
      const status = this.circuitBreaker.getStatus();
      throw new Error(
        `${requestId} circuit breaker is open (${
          status.failures
        } consecutive failures). last failure: ${new Date(
          status.lastFailure
        ).toISOString()}. waiting for cooldown period. troubleshooting: check obsidian is running, verify local rest api plugin is active, confirm api key and port ${
          this.port
        } are correct.`
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;

    logObsidianEvent(
      "debug",
      `making request to ${url} (attempt ${retryCount + 1}/${
        this.maxRetries + 1
      })`,
      {
        requestId,
        url,
        retryCount: retryCount + 1,
        maxRetries: this.maxRetries + 1,
      }
    );

    // Log request details for debugging
    logObsidianEvent("debug", `method: ${options.method || "GET"}`, {
      requestId,
      method: options.method || "GET",
    });
    if (options.body) {
      logObsidianEvent("debug", `body (first 200 chars)`, {
        requestId,
        bodyPreview: String(options.body).substring(0, 200),
      });
    }

    try {
      response = await fetch(url, {
        ...options,
        headers: this.getHeaders(options.headers as Record<string, string>),
        signal: controller.signal,
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      this.circuitBreaker.recordFailure();

      const isRetryableError =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("ECONNRESET") ||
          error.message.includes("fetch failed"));

      if (isRetryableError && retryCount < this.maxRetries) {
        const backoffMs = this.retryDelayMs * Math.pow(2, retryCount); // Exponential backoff
        logObsidianEvent("warn", `request failed, retrying in ${backoffMs}ms`, {
          requestId,
          error: error instanceof Error ? error.message : String(error),
          backoffMs,
          url,
        });
        await this.sleep(backoffMs);
        return this.safeCall(url, options, responseSchema, retryCount + 1);
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `${requestId} request timed out after ${this.timeoutMs}ms to ${url}. ensure obsidian local rest api plugin is running on port ${this.port}. try increasing timeout or check obsidian plugin status.`
        );
      }

      throw new Error(
        `${requestId} network error calling ${url}: ${
          error instanceof Error ? error.message : String(error)
        }. troubleshooting: 1) check obsidian is running 2) verify local rest api plugin is active 3) confirm port ${
          this.port
        } is correct 4) test connection manually`
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody = "<empty response body>";
      let errorData: { errorCode?: number | string; message?: string } = {};
      try {
        errorBody = await response.text();
        if (errorBody) {
          errorData = JSON.parse(errorBody);
        }
      } catch (e) {
        // Ignore parsing errors, use text body
      }

      const code = errorData?.errorCode ?? response.status;
      const message = errorData?.message ?? response.statusText;

      // Log detailed error info for debugging
      logObsidianEvent("error", `api error ${code}: ${message}`, {
        requestId,
        errorCode: code,
        errorMessage: message,
        url,
        responseBodyPreview: errorBody.substring(0, 1000),
      });

      this.circuitBreaker.recordFailure();

      // Retry on 5xx errors but not 4xx (client errors)
      if (response.status >= 500 && retryCount < this.maxRetries) {
        const backoffMs = this.retryDelayMs * Math.pow(2, retryCount);
        logObsidianEvent("warn", `server error, retrying`, {
          requestId,
          backoffMs,
          url,
          status: response.status,
        });
        await this.sleep(backoffMs);
        return this.safeCall(url, options, responseSchema, retryCount + 1);
      }

      // Enhanced error messages for common issues
      let troubleshooting: string[] = [];
      if (response.status === 401) {
        troubleshooting = [
          "check api key is correct",
          "verify obsidian local rest api plugin settings",
          "confirm plugin is enabled",
        ];
      } else if (response.status === 404) {
        troubleshooting = [
          "check obsidian local rest api plugin version",
          "verify endpoint exists in your plugin version",
          "confirm obsidian vault is open",
        ];
      } else if (response.status === 500) {
        troubleshooting = [
          "check obsidian console for plugin errors",
          "try restarting obsidian",
          "verify query syntax",
        ];
      }

      throw new Error(
        `${requestId} obsidian api error ${code}: ${message}. url: ${url}. ${
          troubleshooting.length > 0
            ? `troubleshooting: ${troubleshooting.join(", ")}`
            : ""
        }. response: ${errorBody.substring(0, 500)}`
      );
    }

    // Record success for circuit breaker
    this.circuitBreaker.recordSuccess();

    // Handle expected empty responses (e.g., 204 No Content for PATCH/DELETE)
    if (
      response.status === 204 ||
      response.headers.get("content-length") === "0"
    ) {
      // If no schema, assume null is fine for empty body
      if (!responseSchema) {
        return null as T;
      }
      // Check if the provided schema accepts null
      const result = responseSchema.safeParse(null);
      if (result.success) {
        // Schema accepts null, so return null for the empty body
        return null as T;
      } else {
        // Schema does NOT accept null, but we got an empty body. Error!
        throw new Error(
          `${requestId} expected content conforming to schema but received empty response from ${url}`
        );
      }
    }

    // Process response body based on content type
    const contentType = response.headers.get("content-type");
    let responseData: unknown;

    try {
      if (contentType?.includes("application/json")) {
        responseData = await response.json();
      } else if (
        contentType?.includes("text/plain") ||
        contentType?.includes("text/markdown")
      ) {
        responseData = await response.text();
      } else {
        // Fallback: try reading as text
        responseData = await response.text();
        logObsidianEvent(
          "warn",
          `unexpected content type "${contentType}" from ${url}. parsed as text.`,
          { requestId, contentType, url }
        );
      }
    } catch (error: unknown) {
      throw new Error(
        `${requestId} failed to parse response body from ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    logObsidianEvent("debug", `successful response from ${url}`, {
      requestId,
      url,
      dataType: typeof responseData,
      length: Array.isArray(responseData) ? responseData.length : undefined,
    });

    if (responseSchema) {
      const validation = responseSchema.safeParse(responseData);
      if (!validation.success) {
        logObsidianEvent("error", `api response validation failed`, {
          requestId,
          url,
          errors: validation.error.errors,
          receivedDataPreview: JSON.stringify(responseData, null, 2).substring(
            0,
            1000
          ),
        });
        throw new Error(
          `${requestId} invalid response structure received from ${url}. ${
            validation.error.message
          }. received: ${JSON.stringify(responseData).substring(0, 500)}`
        );
      }
      return validation.data;
    } else {
      // If no schema, return raw parsed data (use with caution)
      return responseData as T;
    }
  }

  // --- API Methods ---

  async search(
    query: string,
    contextLength: number = 100
  ): Promise<z.infer<typeof SearchResultsListSchema>> {
    // Validate inputs
    const validation = SearchInputSchema.safeParse({ query, contextLength });
    if (!validation.success) {
      throw new Error(`invalid search parameters: ${validation.error.message}`);
    }

    const sanitizedQuery = this.sanitizeQuery(query);
    logObsidianEvent("info", `searching for`, {
      originalQuery: query,
      sanitizedQuery,
      contextLength,
    });

    // Query optimization for common patterns
    let optimizedQuery = sanitizedQuery;
    if (sanitizedQuery.toLowerCase() === "ben") {
      // Handle common single-word queries more effectively
      logObsidianEvent("info", `optimizing single-word query`, {
        sanitizedQuery,
      });
    }

    // Spec uses POST, but parameters are in the query string.
    const url = `${this.getBaseUrl()}/search/simple/?query=${encodeURIComponent(
      optimizedQuery
    )}&contextLength=${contextLength}`;

    const results = await this.safeCall(
      url,
      { method: "POST" }, // Use POST as per OpenAPI spec
      SearchResultsListSchema
    );

    logObsidianEvent("info", `search completed`, {
      query: optimizedQuery,
      resultsCount: results.length,
    });

    // Enhanced logging for empty results
    if (results.length === 0) {
      logObsidianEvent("info", `no results found for query`, {
        query: optimizedQuery,
        suggestions:
          "try broader terms, check spelling, or use dataview query for metadata search",
      });
    }

    return results;
  }

  async searchDataview(
    dqlQuery: string
  ): Promise<z.infer<typeof DataviewResultsListSchema>> {
    // Validate inputs
    const validation = DataviewInputSchema.safeParse({ query: dqlQuery });
    if (!validation.success) {
      throw new Error(`invalid dataview query: ${validation.error.message}`);
    }

    const sanitizedQuery = this.sanitizeDataviewQuery(dqlQuery);
    logObsidianEvent("info", `executing dataview query`, {
      originalQuery: dqlQuery,
      sanitizedQuery,
    });

    const url = `${this.getBaseUrl()}/search/`;
    const results = await this.safeCall(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.olrapi.dataview.dql+txt",
        },
        body: sanitizedQuery,
      },
      DataviewResultsListSchema
    );

    logObsidianEvent("info", `dataview query completed`, {
      query: sanitizedQuery,
      resultsCount: results.length,
    });

    // Enhanced logging for empty results
    if (results.length === 0) {
      logObsidianEvent("info", `no results found for dataview query`, {
        query: sanitizedQuery,
        suggestions:
          "check query syntax, verify dataview plugin is active, try simpler queries first",
      });
    }

    return results;
  }

  // Health check method to verify connection
  async healthCheck(): Promise<boolean> {
    try {
      logObsidianEvent("info", `performing health check`, {
        baseUrl: this.getBaseUrl(),
      });
      // Try a simple search to verify the API is working
      // Use a very specific, likely non-existent query to minimize impact
      await this.search("healthcheckqueryxyz123", 1);
      logObsidianEvent("info", "health check passed");
      this.circuitBreaker.recordSuccess(); // Reset any previous failures
      return true;
    } catch (error) {
      logObsidianEvent("error", `health check failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      this.circuitBreaker.recordFailure();
      return false;
    }
  }

  // Get circuit breaker status for debugging
  getStatus(): {
    circuitBreaker: { state: string; failures: number; lastFailure: number };
    connection: { host: string; port: number; timeout: number };
  } {
    return {
      circuitBreaker: this.circuitBreaker.getStatus(),
      connection: {
        host: this.host,
        port: this.port,
        timeout: this.timeoutMs,
      },
    };
  }

  // --- New API Methods for File Operations ---

  async getFileContent(
    filepath: string
  ): Promise<z.infer<typeof FileContentSchema>> {
    // Validate inputs
    const validation = GetFileContentInputSchema.safeParse({ filepath });
    if (!validation.success) {
      throw new Error(
        `invalid getFileContent parameters: ${validation.error.message}`
      );
    }
    const sanitizedFilepath = validation.data.filepath.trim();

    logObsidianEvent("info", `getting content for file`, {
      filepath: sanitizedFilepath,
    });
    const url = `${this.getBaseUrl()}/vault/${encodeURIComponent(
      sanitizedFilepath
    )}`;

    // The Obsidian Local REST API typically returns raw text for file content
    const content = await this.safeCall(
      url,
      { method: "GET" },
      FileContentSchema // Expecting a string response
    );

    logObsidianEvent("info", `successfully fetched content for`, {
      filepath: sanitizedFilepath,
      contentLength: content.length,
    });
    return content;
  }

  async listFiles(
    directoryPath?: string
  ): Promise<z.infer<typeof FileListSchema>> {
    // Validate inputs
    const validation = ListFilesInputSchema.safeParse({
      directory_path: directoryPath,
    });
    if (!validation.success) {
      throw new Error(
        `invalid listFiles parameters: ${validation.error.message}`
      );
    }
    const sanitizedDirectoryPath = validation.data.directory_path?.trim() || "";

    let urlPath = "/vault/";
    if (sanitizedDirectoryPath) {
      // Ensure the path doesn't start with a slash if it's not empty, as /vault/ already has one
      const cleanPath = sanitizedDirectoryPath.startsWith("/")
        ? sanitizedDirectoryPath.substring(1)
        : sanitizedDirectoryPath;
      urlPath += `${encodeURIComponent(cleanPath)}${
        cleanPath.endsWith("/") || cleanPath === "" ? "" : "/"
      }`;
    }

    logObsidianEvent("info", `listing files for path`, { urlPath });
    const url = `${this.getBaseUrl()}${urlPath}`;

    // The API returns an object like { files: ["file1", "folder1/"] }
    // We need a schema for this intermediate structure first.
    const RawFileListResponseSchema = z.object({
      files: z.array(z.string()),
    });

    const rawResponse = await this.safeCall(
      url,
      { method: "GET" },
      RawFileListResponseSchema
    );

    // Now transform the raw list of strings into the expected FileListSchema structure
    const transformedFiles = rawResponse.files.map((name: string) => {
      const isFolder = name.endsWith("/");
      const cleanName = isFolder ? name.slice(0, -1) : name;
      const fullPath = sanitizedDirectoryPath
        ? `${sanitizedDirectoryPath.replace(/\/*$/, "")}/${cleanName}`
        : cleanName;
      return {
        filename: cleanName,
        path: fullPath,
        type: isFolder ? "folder" : ("file" as "file" | "folder"),
        // created, modified, size are not directly available from this endpoint
        // they would require individual calls per item or a different endpoint
      };
    });

    // Validate the transformed structure before returning
    const finalValidation = FileListSchema.safeParse(transformedFiles);
    if (!finalValidation.success) {
      logObsidianEvent(
        "error",
        `listFiles transformed data validation failed`,
        {
          urlPath,
          errors: finalValidation.error.errors,
          transformedDataPreview: JSON.stringify(
            transformedFiles,
            null,
            2
          ).substring(0, 1000),
        }
      );
      throw new Error(
        `Failed to transform API response for listFiles to the expected structure. ${finalValidation.error.message}`
      );
    }

    logObsidianEvent("info", `found items in path`, {
      count: finalValidation.data.length,
      urlPath,
    });
    return finalValidation.data;
  }
}

// Add these environment detection functions
function getObsidianPath(): string {
  const obsidianEnvPath = process.env.OBSIDIAN_VAULT_PATH;
  if (obsidianEnvPath) {
    logObsidianEvent("info", `using vault path from environment`, {
      path: obsidianEnvPath,
    });
    return obsidianEnvPath;
  }

  // Common default paths
  const defaultPaths = [
    `${process.env.HOME}/Documents/Obsidian Vault`,
    `${process.env.HOME}/Obsidian`,
    `${process.env.HOME}/vault`,
  ];

  logObsidianEvent(
    "info",
    `no OBSIDIAN_VAULT_PATH set, using default connection settings for host/port`
  );
  return "";
}

function detectObsidianConfig(): { host: string; port: number } {
  const envHost = process.env.OBSIDIAN_HOST;
  const envPort = process.env.OBSIDIAN_PORT;

  const host = envHost || "127.0.0.1";
  const port = envPort ? parseInt(envPort, 10) : 27123;

  logObsidianEvent("info", `detected obsidian connection details`, {
    host,
    port,
    source: envHost || envPort ? "environment_variables" : "defaults",
  });
  return { host, port };
}
