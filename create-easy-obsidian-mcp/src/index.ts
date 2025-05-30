#!/usr/bin/env node

import * as p from "@clack/prompts";
import fs from "fs-extra";
import path from "path";
import color from "picocolors";
import spawn from "cross-spawn";
import os from "os";

async function main() {
  console.clear();
  p.intro(`${color.bgCyan(color.black(" create-easy-obsidian-mcp "))}`);

  // --- Get Target Directory ---
  const args = process.argv.slice(2);
  let targetDir = args[0];

  if (!targetDir) {
    const dir = await p.text({
      message: "where should we create your new server?",
      placeholder: "./easy-obsidian-mcp-server",
    });
    if (p.isCancel(dir)) {
      p.cancel("operation cancelled.");
      process.exit(0);
    }
    targetDir = dir as string;
  }

  const targetPath = path.resolve(process.cwd(), targetDir);
  const projectName = path.basename(targetPath);

  // --- Check if Directory Exists ---
  if (fs.existsSync(targetPath)) {
    const overwrite = await p.confirm({
      message: `directory "${projectName}" already exists. overwrite?`,
      initialValue: false,
    });
    if (!overwrite || p.isCancel(overwrite)) {
      p.cancel("operation cancelled.");
      process.exit(0);
    }
    p.log.warn(`overwriting directory "${targetPath}"...`);
    fs.rmSync(targetPath, { recursive: true, force: true });
  }

  fs.ensureDirSync(targetPath);

  // --- Copy Template Files ---
  const templateDir = path.join(__dirname, "..", "..", "easy-obsidian-mcp"); // Adjust based on actual build structure
  const copySpinner = p.spinner();
  copySpinner.start(`copying template files to "${projectName}"...`);

  try {
    fs.copySync(templateDir, targetPath);
    // Rename gitignore (npm peculiarity)
    const gitignorePath = path.join(targetPath, "_gitignore");
    if (fs.existsSync(gitignorePath)) {
      fs.renameSync(gitignorePath, path.join(targetPath, ".gitignore"));
    }
    copySpinner.stop(`template files copied to "${projectName}".`);
  } catch (err: any) {
    copySpinner.stop("failed to copy template files.");
    p.log.error(err.message);
    process.exit(1);
  }

  // --- Ensure clean state before install ---
  const nodeModulesPath = path.join(targetPath, "node_modules");
  if (fs.existsSync(nodeModulesPath)) {
    p.log.warn("Removing existing node_modules directory...");
    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
  }

  // --- Install Dependencies ---
  const installSpinner = p.spinner();
  installSpinner.start(
    `installing dependencies in "${projectName}" (this may take a minute)...`
  );

  const installResult = spawn.sync("npm", ["install"], {
    cwd: targetPath,
    stdio: "inherit", // Use inherit to show installation logs/errors directly
  });

  if (installResult.error || installResult.status !== 0) {
    installSpinner.stop("dependency installation failed.");
    p.log.error(
      installResult.error?.message || "npm install exited with non-zero status."
    );
    if (installResult.stderr) {
      console.error(installResult.stderr.toString());
    }
    if (installResult.stdout) {
      console.log(installResult.stdout.toString());
    }
    p.log.warn('please try running "npm install" manually in the directory.');
    process.exit(1);
  } else {
    installSpinner.stop("dependencies installed successfully.");
  }

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

  // --- Build the copied project ---
  const buildSpinner = p.spinner();
  buildSpinner.start(`compiling server code in "${projectName}"...`);

  const buildResult = spawn.sync("npm", ["run", "build"], {
    cwd: targetPath,
    stdio: "pipe", // Keep output clean unless error occurs
  });

  if (buildResult.error || buildResult.status !== 0) {
    buildSpinner.stop("server compilation failed.");
    p.log.error(
      buildResult.error?.message || "npm run build exited with non-zero status."
    );
    if (buildResult.stderr) {
      console.error(buildResult.stderr.toString());
    }
    if (buildResult.stdout) {
      console.log(buildResult.stdout.toString());
    }
    p.log.warn(
      'build failed. please try running "npm run build" manually in the directory.'
    );
    // Don't exit, as install and setup might have worked partially
  } else {
    buildSpinner.stop("server compiled successfully.");

    // --- Configure MCP Clients ---
    const homeDir = os.homedir();
    const cursorConfigPath = path.join(homeDir, ".cursor", "mcp.json");
    let claudeConfigPath: string | null = null;
    const platform = os.platform();

    if (platform === "darwin") {
      claudeConfigPath = path.join(
        homeDir,
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json"
      );
    } else if (platform === "win32") {
      const appData = process.env.APPDATA;
      if (appData) {
        claudeConfigPath = path.join(
          appData,
          "Claude",
          "claude_desktop_config.json"
        );
      } else {
        p.log.warn("could not determine windows %APPDATA% directory.");
      }
    } // Linux path not specified in request

    const updateCursor = await p.confirm({
      message: `add server "${projectName}" to cursor's mcp.json? (${cursorConfigPath})`,
      initialValue: false,
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
        // Ensure relative path for cwd if targetPath is within homeDir for portability? No, use absolute.
        config.mcpServers[projectName] = {
          command: "node",
          args: [
            path.join(targetPath, "dist", "index.js"),
            "--apiKey",
            apiKey as string,
          ],
        };
        fs.ensureDirSync(path.dirname(cursorConfigPath));
        fs.writeJsonSync(cursorConfigPath, config, { spaces: 4 });
        cursorSpinner.stop(`updated ${cursorConfigPath}.`);
      } catch (error: any) {
        cursorSpinner.stop(`failed to update ${cursorConfigPath}.`);
        p.log.error(error.message);
        p.log.warn(
          `please add the following manually to ${cursorConfigPath} under "mcpServers":
` +
            `"${projectName}": ${JSON.stringify(
              {
                command: "node",
                args: [
                  path.join(targetPath, "dist", "index.js"),
                  "--apiKey",
                  apiKey as string,
                ],
              },
              null,
              2
            )}`
        );
      }
    }

    if (claudeConfigPath) {
      const updateClaude = await p.confirm({
        message: `add server "${projectName}" to claude desktop app config? (${claudeConfigPath})`,
        initialValue: false,
      });

      if (p.isCancel(updateClaude)) {
        p.cancel("operation cancelled.");
        process.exit(0);
      }

      if (updateClaude) {
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
          // Using a placeholder structure for Claude
          config.mcpServers[projectName] = {
            command: "node",
            args: [
              path.join(targetPath, "dist", "index.js"),
              "--apiKey",
              apiKey as string,
            ],
          };
          fs.ensureDirSync(path.dirname(claudeConfigPath));
          fs.writeJsonSync(claudeConfigPath, config, { spaces: 4 });
          claudeSpinner.stop(`updated ${claudeConfigPath}.`);
          p.log.info(
            `note: added server under "mcpServers" key. you might need to adjust this based on claude's expected format.`
          );
        } catch (error: any) {
          claudeSpinner.stop(`failed to update ${claudeConfigPath}.`);
          p.log.error(error.message);
          p.log.warn(`please check or update ${claudeConfigPath} manually.`);
        }
      }
    } else if (platform !== "darwin" && platform !== "win32") {
      p.log.info(
        `claude desktop configuration path unknown for ${platform}. skipping.`
      );
    }
  }

  p.outro(`🚀 all done! now use cursor/claude etc with your mcp server`);
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
