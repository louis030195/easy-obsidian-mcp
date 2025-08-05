#!/usr/bin/env node

import * as p from "@clack/prompts";
import fs from "fs-extra";
import path from "path";
import color from "picocolors";
import os from "os";

async function main() {
  console.clear();
  p.intro(`${color.bgCyan(color.black(" easy-obsidian-mcp setup "))}`);

  // --- Prompt for API Key ---
  const apiKey = await p.text({
    message: "please enter your obsidian local rest api key:",
    placeholder:
      "find this in obsidian settings -> community plugins -> local rest api",
    validate(value: string) {
      if (value.length === 0) return `api key is required!`;
    },
  });

  if (p.isCancel(apiKey)) {
    p.cancel("setup cancelled during api key entry.");
    process.exit(0);
  }

  // Get the path to the installed package
  const packagePath = path.dirname(__dirname);
  const serverPath = path.join(packagePath, "index.js");

  // --- Configure MCP Clients ---
  const homeDir = os.homedir();
  const cursorConfigPath = path.join(homeDir, ".cursor", "mcp.json");
  let claudeConfigPath: string | null = null;
  let vsCodeConfigPath: string | null = null;
  const platform = os.platform();

  // Platform-specific paths
  if (platform === "darwin") {
    claudeConfigPath = path.join(
      homeDir,
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json"
    );
    vsCodeConfigPath = path.join(
      homeDir,
      "Library",
      "Application Support",
      "Code",
      "User",
      "settings.json"
    );
  } else if (platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      claudeConfigPath = path.join(
        appData,
        "Claude",
        "claude_desktop_config.json"
      );
      vsCodeConfigPath = path.join(
        appData,
        "Code",
        "User",
        "settings.json"
      );
    } else {
      p.log.warn("could not determine windows %APPDATA% directory.");
    }
  } else {
    // Linux
    claudeConfigPath = path.join(
      homeDir,
      ".config",
      "Claude",
      "claude_desktop_config.json"
    );
    vsCodeConfigPath = path.join(
      homeDir,
      ".config",
      "Code",
      "User",
      "settings.json"
    );
  }

  // Cursor Configuration
  const updateCursor = await p.confirm({
    message: `add easy-obsidian-mcp to cursor's mcp.json? (${cursorConfigPath})`,
    initialValue: true,
  });

  if (p.isCancel(updateCursor)) {
    p.cancel("operation cancelled.");
    process.exit(0);
  }

  if (updateCursor) {
    const cursorSpinner = p.spinner();
    cursorSpinner.start(`updating ${cursorConfigPath}...`);
    try {
      let config: { mcpServers?: Record<string, any> } = {};
      if (fs.existsSync(cursorConfigPath)) {
        config = fs.readJsonSync(cursorConfigPath);
      }
      if (!config.mcpServers) {
        config.mcpServers = {};
      }
      config.mcpServers["easy-obsidian-mcp"] = {
        command: "node",
        args: [serverPath, "--apiKey", apiKey as string],
      };
      fs.ensureDirSync(path.dirname(cursorConfigPath));
      fs.writeJsonSync(cursorConfigPath, config, { spaces: 2 });
      cursorSpinner.stop(`✅ cursor configuration updated.`);
    } catch (error: any) {
      cursorSpinner.stop(`❌ failed to update cursor configuration.`);
      p.log.error(error.message);
    }
  }

  // Claude Desktop Configuration
  if (claudeConfigPath) {
    const updateClaude = await p.confirm({
      message: `add easy-obsidian-mcp to claude desktop app config? (${claudeConfigPath})`,
      initialValue: true,
    });

    if (!p.isCancel(updateClaude) && updateClaude) {
      const claudeSpinner = p.spinner();
      claudeSpinner.start(`updating ${claudeConfigPath}...`);
      try {
        let config: { mcpServers?: Record<string, any> } = {};
        if (fs.existsSync(claudeConfigPath)) {
          config = fs.readJsonSync(claudeConfigPath);
        }
        if (!config.mcpServers) {
          config.mcpServers = {};
        }
        config.mcpServers["easy-obsidian-mcp"] = {
          command: "node",
          args: [serverPath, "--apiKey", apiKey as string],
        };
        fs.ensureDirSync(path.dirname(claudeConfigPath));
        fs.writeJsonSync(claudeConfigPath, config, { spaces: 2 });
        claudeSpinner.stop(`✅ claude desktop configuration updated.`);
      } catch (error: any) {
        claudeSpinner.stop(`❌ failed to update claude desktop configuration.`);
        p.log.error(error.message);
      }
    }
  }

  // VS Code Configuration (for future MCP support)
  if (vsCodeConfigPath) {
    const updateVSCode = await p.confirm({
      message: `prepare vs code configuration for future mcp support? (${vsCodeConfigPath})`,
      initialValue: false,
    });

    if (!p.isCancel(updateVSCode) && updateVSCode) {
      const vsCodeSpinner = p.spinner();
      vsCodeSpinner.start(`updating ${vsCodeConfigPath}...`);
      try {
        let config: any = {};
        if (fs.existsSync(vsCodeConfigPath)) {
          config = fs.readJsonSync(vsCodeConfigPath);
        }
        if (!config["mcp.servers"]) {
          config["mcp.servers"] = {};
        }
        config["mcp.servers"]["easy-obsidian-mcp"] = {
          command: "node",
          args: [serverPath, "--apiKey", apiKey as string],
        };
        fs.ensureDirSync(path.dirname(vsCodeConfigPath));
        fs.writeJsonSync(vsCodeConfigPath, config, { spaces: 2 });
        vsCodeSpinner.stop(`✅ vs code configuration prepared.`);
        p.log.info("note: vs code mcp support is not yet available but configuration is ready.");
      } catch (error: any) {
        vsCodeSpinner.stop(`❌ failed to update vs code configuration.`);
        p.log.error(error.message);
      }
    }
  }

  p.outro(`🚀 setup complete! restart your applications to use easy-obsidian-mcp`);

  // Show usage instructions
  console.log("\n" + color.cyan("📖 usage examples:"));
  console.log("- \"search my obsidian notes for 'artificial intelligence'\"");
  console.log("- \"list the files in my obsidian vault\"");
  console.log("- \"find my last 5 notes\"");

  console.log("\n" + color.yellow("🔧 manual configuration:"));
  console.log(`server path: ${serverPath}`);
  console.log(`api key: ${apiKey}`);
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});