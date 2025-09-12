import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

// Schema for filesystem search results
export const FilesystemSearchResultSchema = z.object({
  filename: z.string(),
  path: z.string(),
  matches: z.array(z.object({
    line: z.number(),
    content: z.string(),
    context: z.string().optional()
  })),
  frontmatter: z.record(z.any()).optional()
});

export type FilesystemSearchResult = z.infer<typeof FilesystemSearchResultSchema>;

// Schema for graph/link analysis results
export const GraphSearchResultSchema = z.object({
  filename: z.string(),
  path: z.string(),
  outgoingLinks: z.array(z.string()),
  incomingLinks: z.array(z.string()).optional(),
  tags: z.array(z.string()),
  frontmatter: z.record(z.any()).optional()
});

export type GraphSearchResult = z.infer<typeof GraphSearchResultSchema>;

interface SearchOptions {
  vaultPath: string;
  query: string;
  maxResults?: number;
  contextLines?: number;
  includeContent?: boolean;
  searchType?: 'content' | 'filename' | 'tags' | 'links' | 'frontmatter';
}

interface GraphSearchOptions {
  vaultPath: string;
  maxDepth?: number;
  startFile?: string;
  includeOrphans?: boolean;
}

export class FilesystemSearch {
  private vaultPath: string;
  private linkCache: Map<string, Set<string>> = new Map();
  private backlinksCache: Map<string, Set<string>> = new Map();

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  /**
   * Main search function that searches through markdown files
   */
  async search(options: SearchOptions): Promise<FilesystemSearchResult[]> {
    const {
      query,
      maxResults = 20,
      contextLines = 2,
      includeContent = true,
      searchType = 'content'
    } = options;

    const results: FilesystemSearchResult[] = [];
    const files = await this.getAllMarkdownFiles();

    for (const file of files) {
      if (results.length >= maxResults) break;

      const fullPath = path.join(this.vaultPath, file);
      
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const result = await this.searchFile(
          file,
          content,
          query,
          searchType,
          contextLines,
          includeContent
        );

        if (result) {
          results.push(result);
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return results;
  }

  /**
   * Graph search - analyze links and connections between notes
   */
  async graphSearch(options: GraphSearchOptions): Promise<GraphSearchResult[]> {
    const { maxDepth = 2, startFile, includeOrphans = false } = options;

    // Build the link graph
    await this.buildLinkGraph();

    const results: GraphSearchResult[] = [];
    const files = await this.getAllMarkdownFiles();

    for (const file of files) {
      const fullPath = path.join(this.vaultPath, file);
      
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const frontmatter = this.extractFrontmatter(content);
        const tags = this.extractTags(content);
        const outgoingLinks = Array.from(this.linkCache.get(file) || []);
        const incomingLinks = Array.from(this.backlinksCache.get(file) || []);

        // Filter based on criteria
        if (startFile && !this.isConnected(file, startFile, maxDepth)) {
          continue;
        }

        if (!includeOrphans && outgoingLinks.length === 0 && incomingLinks.length === 0) {
          continue;
        }

        results.push({
          filename: path.basename(file),
          path: file,
          outgoingLinks,
          incomingLinks,
          tags,
          frontmatter
        });
      } catch (error) {
        continue;
      }
    }

    return results;
  }

  /**
   * Fuzzy search - find notes by approximate matching
   */
  async fuzzySearch(query: string, maxResults: number = 10): Promise<FilesystemSearchResult[]> {
    const results: FilesystemSearchResult[] = [];
    const files = await this.getAllMarkdownFiles();
    const queryLower = query.toLowerCase();
    const queryParts = queryLower.split(/\s+/);

    const scored: Array<{ file: string; score: number; result: FilesystemSearchResult }> = [];

    for (const file of files) {
      const fullPath = path.join(this.vaultPath, file);
      const filename = path.basename(file).toLowerCase();
      
      // Calculate filename score
      let score = 0;
      
      // Exact filename match (without extension)
      if (filename.replace('.md', '') === queryLower) {
        score += 100;
      }
      
      // Filename contains query
      if (filename.includes(queryLower)) {
        score += 50;
      }
      
      // All query parts in filename
      if (queryParts.every(part => filename.includes(part))) {
        score += 30;
      }

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const contentLower = content.toLowerCase();
        
        // Content scoring
        if (contentLower.includes(queryLower)) {
          score += 20;
        }
        
        // All query parts in content
        if (queryParts.every(part => contentLower.includes(part))) {
          score += 10;
        }

        if (score > 0) {
          const matches = [];
          const lines = content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
              matches.push({
                line: i + 1,
                content: lines[i],
                context: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n')
              });
              if (matches.length >= 3) break;
            }
          }

          scored.push({
            file,
            score,
            result: {
              filename: path.basename(file),
              path: file,
              matches,
              frontmatter: this.extractFrontmatter(content)
            }
          });
        }
      } catch (error) {
        continue;
      }
    }

    // Sort by score and return top results
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map(item => item.result);
  }

  /**
   * Search within a single file
   */
  private async searchFile(
    filePath: string,
    content: string,
    query: string,
    searchType: string,
    contextLines: number,
    includeContent: boolean
  ): Promise<FilesystemSearchResult | null> {
    const filename = path.basename(filePath);
    const queryLower = query.toLowerCase();

    // Check based on search type
    switch (searchType) {
      case 'filename':
        if (!filename.toLowerCase().includes(queryLower)) {
          return null;
        }
        break;

      case 'tags':
        const tags = this.extractTags(content);
        if (!tags.some(tag => tag.toLowerCase().includes(queryLower))) {
          return null;
        }
        break;

      case 'links':
        const links = this.extractLinks(content);
        if (!links.some(link => link.toLowerCase().includes(queryLower))) {
          return null;
        }
        break;

      case 'frontmatter':
        const frontmatter = this.extractFrontmatter(content);
        const frontmatterStr = JSON.stringify(frontmatter).toLowerCase();
        if (!frontmatterStr.includes(queryLower)) {
          return null;
        }
        break;

      case 'content':
      default:
        if (!content.toLowerCase().includes(queryLower)) {
          return null;
        }
        break;
    }

    // Build matches if content search
    const matches = [];
    if (includeContent && (searchType === 'content' || searchType === 'filename')) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(queryLower)) {
          const startLine = Math.max(0, i - contextLines);
          const endLine = Math.min(lines.length - 1, i + contextLines);
          const contextArray = lines.slice(startLine, endLine + 1);
          
          matches.push({
            line: i + 1,
            content: lines[i],
            context: contextArray.join('\n')
          });
        }
      }
    }

    return {
      filename,
      path: filePath,
      matches,
      frontmatter: this.extractFrontmatter(content)
    };
  }

  /**
   * Get all markdown files in the vault
   */
  private async getAllMarkdownFiles(): Promise<string[]> {
    const files: string[] = [];

    async function walk(dir: string, baseDir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip hidden directories and common non-content folders
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath, baseDir);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const relativePath = path.relative(baseDir, fullPath);
          files.push(relativePath);
        }
      }
    }

    await walk(this.vaultPath, this.vaultPath);
    return files;
  }

  /**
   * Extract frontmatter from markdown content
   */
  private extractFrontmatter(content: string): Record<string, any> {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (!match) return {};

    try {
      // Simple YAML parsing (basic implementation)
      const yaml = match[1];
      const result: Record<string, any> = {};
      
      const lines = yaml.split('\n');
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, '');
          
          // Try to parse as JSON for arrays/objects
          if (cleanValue.startsWith('[') || cleanValue.startsWith('{')) {
            try {
              result[key] = JSON.parse(cleanValue);
            } catch {
              result[key] = cleanValue;
            }
          } else {
            result[key] = cleanValue;
          }
        }
      }
      
      return result;
    } catch {
      return {};
    }
  }

  /**
   * Extract tags from markdown content
   */
  private extractTags(content: string): string[] {
    const tags: Set<string> = new Set();
    
    // Frontmatter tags
    const frontmatter = this.extractFrontmatter(content);
    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        frontmatter.tags.forEach(tag => tags.add(tag));
      } else if (typeof frontmatter.tags === 'string') {
        tags.add(frontmatter.tags);
      }
    }
    
    // Inline tags (#tag)
    const tagRegex = /#[\w\-\_\/]+/g;
    const matches = content.match(tagRegex);
    if (matches) {
      matches.forEach(tag => tags.add(tag));
    }
    
    return Array.from(tags);
  }

  /**
   * Extract wiki-style links from content
   */
  private extractLinks(content: string): string[] {
    const links: string[] = [];
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }
    
    return links;
  }

  /**
   * Build a graph of links between notes
   */
  private async buildLinkGraph(): Promise<void> {
    this.linkCache.clear();
    this.backlinksCache.clear();

    const files = await this.getAllMarkdownFiles();

    for (const file of files) {
      const fullPath = path.join(this.vaultPath, file);
      
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const links = this.extractLinks(content);
        
        this.linkCache.set(file, new Set(links));
        
        // Build backlinks
        for (const link of links) {
          // Find the file that matches this link
          // Use path.sep for cross-platform compatibility
          const linkedFile = files.find(f => 
            path.basename(f, '.md') === link || 
            f === link + '.md' ||
            f.endsWith(path.sep + link + '.md')
          );
          
          if (linkedFile) {
            if (!this.backlinksCache.has(linkedFile)) {
              this.backlinksCache.set(linkedFile, new Set());
            }
            this.backlinksCache.get(linkedFile)!.add(file);
          }
        }
      } catch (error) {
        continue;
      }
    }
  }

  /**
   * Check if two files are connected within a certain depth
   */
  private isConnected(file1: string, file2: string, maxDepth: number): boolean {
    if (file1 === file2) return true;
    if (maxDepth <= 0) return false;

    const visited = new Set<string>();
    const queue: Array<{ file: string; depth: number }> = [{ file: file1, depth: 0 }];

    while (queue.length > 0) {
      const { file, depth } = queue.shift()!;
      
      if (file === file2) return true;
      if (depth >= maxDepth) continue;
      if (visited.has(file)) continue;
      
      visited.add(file);

      // Check outgoing links
      const links = this.linkCache.get(file) || new Set();
      for (const link of links) {
        queue.push({ file: link, depth: depth + 1 });
      }

      // Check incoming links
      const backlinks = this.backlinksCache.get(file) || new Set();
      for (const backlink of backlinks) {
        queue.push({ file: backlink, depth: depth + 1 });
      }
    }

    return false;
  }
}