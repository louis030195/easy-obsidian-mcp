#!/usr/bin/env node

// Simple test script to verify MCP server functionality
const { spawn } = require('child_process');

async function testMCPServer() {
    console.log('🧪 Testing easy-obsidian-mcp server...\n');

    // Test with a fake API key to see if the server starts properly
    const child = spawn('node', ['dist/index.js', '--apiKey', 'test-key-123', '--debug'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverOutput = '';
    let hasStarted = false;
    let hasError = false;

    child.stdout.on('data', (data) => {
        const output = data.toString();
        serverOutput += output;
        console.log('📤 STDOUT:', output.trim());

        if (output.includes('easy-obsidian-mcp server connected')) {
            hasStarted = true;
            console.log('✅ Server started successfully!');
            setTimeout(() => {
                child.kill('SIGTERM');
            }, 1000);
        }
    });

    child.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('📤 STDERR:', output.trim());

        // Don't consider Obsidian connection errors as real errors for testing
        if (output.includes('error') || output.includes('Error')) {
            if (output.includes('Authorization required') ||
                output.includes('ECONNREFUSED') ||
                output.includes('health check failed')) {
                console.log('💡 Expected error - Obsidian not available (this is normal for testing)');
            } else {
                hasError = true;
            }
        }
    });

    child.on('close', (code) => {
        console.log(`\n🏁 Process exited with code: ${code}`);

        if (hasStarted && !hasError) {
            console.log('✅ MCP server test PASSED - server can start and initialize properly');
            console.log('💡 Next steps:');
            console.log('   1. Install and configure Obsidian Local REST API plugin');
            console.log('   2. Get your API key from the plugin settings');
            console.log('   3. Test with: node dist/index.js --apiKey YOUR_REAL_KEY');
        } else if (hasError) {
            console.log('❌ MCP server test FAILED - errors detected in output');
        } else {
            console.log('⚠️ MCP server test INCOMPLETE - server did not start properly');
        }
    });

    child.on('error', (error) => {
        console.error('❌ Failed to start process:', error.message);
    });

    // Send a simple initialization message to test MCP protocol
    setTimeout(() => {
        const initMessage = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: {
                    name: "test-client",
                    version: "1.0.0"
                }
            }
        }) + '\n';

        console.log('📤 Sending init message...');
        child.stdin.write(initMessage);
    }, 500);
}

// Run the test
testMCPServer().catch(console.error); 