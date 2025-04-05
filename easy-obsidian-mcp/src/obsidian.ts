import { z } from "zod";

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

// --- Obsidian API Client Class ---

export class Obsidian {
  private apiKey: string;
  private protocol: string;
  private host: string;
  private port: number;
  private timeoutMs: number;

  constructor(options: {
    apiKey: string;
    protocol?: string;
    host?: string;
    port?: number;
    timeoutMs?: number;
  }) {
    if (!options.apiKey) {
      throw new Error("obsidian api key is required.");
    }
    this.apiKey = options.apiKey;
    this.protocol = options.protocol ?? "http";
    this.host = options.host ?? "127.0.0.1";
    this.port = options.port ?? 27124;
    this.timeoutMs = options.timeoutMs ?? 10000; // Increased default timeout
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

  private async safeCall<T>(
    url: string,
    options: RequestInit,
    responseSchema?: z.ZodType<T>
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: this.getHeaders(options.headers as Record<string, string>),
        signal: controller.signal,
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Request timed out after ${this.timeoutMs}ms to ${url}`
        );
      }
      // Rethrow network errors or other fetch issues
      throw new Error(
        `Network error calling ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody = "<empty response body>";
      let errorData: { errorCode?: number | string; message?: string } = {};
      try {
        errorBody = await response.text();
        errorData = JSON.parse(errorBody);
      } catch (e) {
        // Ignore parsing errors, use text body
      }
      const code = errorData?.errorCode ?? response.status;
      const message = errorData?.message ?? response.statusText;
      throw new Error(
        `Obsidian API Error ${code}: ${message}. URL: ${url}. Response: ${errorBody.substring(
          0,
          500
        )}`
      );
    }

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
          `Expected content conforming to schema but received empty response from ${url}`
        );
      }
    }

    // Process response body based on content type
    const contentType = response.headers.get("content-type");
    let responseData: unknown; // Declare responseData here

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
        console.warn(
          `Unexpected content type "${contentType}" from ${url}. Parsed as text.`
        );
      }
    } catch (error: unknown) {
      throw new Error(
        `Failed to parse response body from ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (responseSchema) {
      const validation = responseSchema.safeParse(responseData);
      if (!validation.success) {
        console.error(
          "obsidian api response validation failed:",
          validation.error.errors
        );
        throw new Error(
          `Invalid response structure received from ${url}. ${
            validation.error.message
          }. Received: ${JSON.stringify(responseData).substring(0, 500)}`
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
    // Spec uses POST, but parameters are in the query string.
    const url = `${this.getBaseUrl()}/search/simple/?query=${encodeURIComponent(
      query
    )}&contextLength=${contextLength}`;
    // Although the parameters are in the URL, the spec dictates the method is POST.
    return await this.safeCall(
      url,
      { method: "POST" }, // Use POST as per OpenAPI spec
      SearchResultsListSchema
    );
  }

  async searchDataview(
    dqlQuery: string
  ): Promise<z.infer<typeof DataviewResultsListSchema>> {
    const url = `${this.getBaseUrl()}/search/`;
    return await this.safeCall(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.olrapi.dataview.dql+txt",
        },
        body: dqlQuery,
      },
      DataviewResultsListSchema
    );
  }
}
