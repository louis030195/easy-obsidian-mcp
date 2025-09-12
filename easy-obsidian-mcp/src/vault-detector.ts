import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface VaultInfo {
  path: string;
  name: string;
  hasObsidianFolder: boolean;
}

export class VaultDetector {
  private commonVaultPaths: string[] = [];
  
  constructor() {
    const home = os.homedir();
    const platform = os.platform();
    
    // Common locations where Obsidian vaults might be
    this.commonVaultPaths = [
      path.join(home, 'Documents'),
      path.join(home, 'Desktop'),
      path.join(home, 'Obsidian'),
      path.join(home, 'Vaults'),
      path.join(home, 'Notes'),
      path.join(home, 'OneDrive', 'Documents'),
      path.join(home, 'Dropbox'),
      path.join(home, 'iCloud Drive', 'Documents'),
      path.join(home, 'Google Drive'),
    ];
    
    // Add Windows-specific paths
    if (platform === 'win32') {
      this.commonVaultPaths.push(
        path.join(home, 'OneDrive', 'Desktop'),
        path.join(home, 'My Documents'),
        path.join('C:', 'Obsidian'),
        path.join('D:', 'Obsidian')
      );
    }
    
    // Add environment variable if set
    if (process.env.OBSIDIAN_VAULT_PATH) {
      this.commonVaultPaths.unshift(process.env.OBSIDIAN_VAULT_PATH);
    }
  }

  /**
   * Try to get vault info from Obsidian API
   */
  async getVaultFromAPI(obsidian: any): Promise<VaultInfo | null> {
    try {
      // Try to get vault info through the API
      // First, let's try listing files to infer the vault path
      const healthCheck = await obsidian.healthCheck();
      if (healthCheck) {
        // The API is available, but we need to infer the vault path
        // Try listing files in root
        const files = await obsidian.listFiles('');
        if (files && files.length > 0) {
          // We have files, but the API doesn't directly give us the vault path
          // We'll need to detect it from the filesystem
          return null;
        }
      }
    } catch (error) {
      // API not available
    }
    return null;
  }

  /**
   * Detect Obsidian vaults on the filesystem
   */
  async detectVaults(): Promise<VaultInfo[]> {
    const vaults: VaultInfo[] = [];
    const visited = new Set<string>();

    for (const basePath of this.commonVaultPaths) {
      try {
        const exists = await this.pathExists(basePath);
        if (!exists) continue;

        // Search for .obsidian folders (indicates a vault)
        await this.searchForVaults(basePath, vaults, visited, 2);
      } catch (error) {
        // Skip paths we can't access
        continue;
      }
    }

    // Also check if current working directory is a vault
    const cwd = process.cwd();
    if (!visited.has(cwd)) {
      const vaultInfo = await this.checkIfVault(cwd);
      if (vaultInfo) {
        vaults.push(vaultInfo);
      }
    }

    return vaults;
  }

  /**
   * Auto-detect the most likely vault
   */
  async autoDetectVault(): Promise<string | null> {
    const vaults = await this.detectVaults();
    
    if (vaults.length === 0) {
      return null;
    }

    // Priority order for common vault names
    const priorityNames = ['brain', 'vault', 'notes', 'obsidian', 'knowledge', 'second-brain', 'zettelkasten'];
    
    // First, try to find a vault with a priority name AND .obsidian folder
    for (const name of priorityNames) {
      const found = vaults.find(v => 
        v.name.toLowerCase() === name && v.hasObsidianFolder
      );
      if (found) return found.path;
    }
    
    // Then try priority names without requiring .obsidian folder
    for (const name of priorityNames) {
      const found = vaults.find(v => 
        v.name.toLowerCase().includes(name)
      );
      if (found) return found.path;
    }

    // Prioritize vaults with .obsidian folder
    const withObsidian = vaults.filter(v => v.hasObsidianFolder);
    if (withObsidian.length > 0) {
      // Return the one with most markdown files (heuristic for most active vault)
      return withObsidian[0].path;
    }

    // Otherwise return the first vault found
    return vaults[0].path;
  }

  /**
   * Search for vaults recursively
   */
  private async searchForVaults(
    dir: string,
    vaults: VaultInfo[],
    visited: Set<string>,
    maxDepth: number
  ): Promise<void> {
    if (maxDepth <= 0 || visited.has(dir)) return;
    visited.add(dir);

    try {
      const vaultInfo = await this.checkIfVault(dir);
      if (vaultInfo) {
        vaults.push(vaultInfo);
      }

      // Only go deeper if we haven't found a vault here
      if (!vaultInfo && maxDepth > 1) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const name = entry.name;
            
            // Skip system and hidden directories
            if (name.startsWith('.') || name === 'node_modules' || name === 'Library') {
              continue;
            }

            const fullPath = path.join(dir, name);
            await this.searchForVaults(fullPath, vaults, visited, maxDepth - 1);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  /**
   * Check if a directory is an Obsidian vault
   */
  private async checkIfVault(dir: string): Promise<VaultInfo | null> {
    try {
      const entries = await fs.readdir(dir);
      
      // Check for .obsidian folder (definitive indicator)
      const hasObsidianFolder = entries.includes('.obsidian');
      
      // Check for markdown files
      const hasMarkdownFiles = entries.some(file => file.endsWith('.md'));
      
      if (hasObsidianFolder || hasMarkdownFiles) {
        return {
          path: dir,
          name: path.basename(dir),
          hasObsidianFolder
        };
      }
    } catch (error) {
      // Can't read directory
    }
    
    return null;
  }

  /**
   * Check if a path exists
   */
  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get or create a config file to store vault path
   */
  async getStoredVaultPath(): Promise<string | null> {
    const configPath = path.join(os.homedir(), '.obsidian-mcp-config.json');
    
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      if (config.vaultPath) {
        // Verify it still exists
        const exists = await this.pathExists(config.vaultPath);
        if (exists) {
          return config.vaultPath;
        }
      }
    } catch (error) {
      // Config doesn't exist or is invalid
    }
    
    return null;
  }

  /**
   * Store the vault path for future use
   */
  async storeVaultPath(vaultPath: string): Promise<void> {
    const configPath = path.join(os.homedir(), '.obsidian-mcp-config.json');
    
    try {
      await fs.writeFile(
        configPath,
        JSON.stringify({ vaultPath, lastUpdated: new Date().toISOString() }, null, 2)
      );
    } catch (error) {
      // Couldn't save config, not critical
    }
  }
}