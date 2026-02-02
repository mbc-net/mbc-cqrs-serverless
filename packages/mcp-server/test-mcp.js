#!/usr/bin/env node

/**
 * Simple MCP server test script.
 * Tests the server by sending JSON-RPC messages via stdin.
 */

const { spawn } = require('child_process')
const path = require('path')

const serverPath = path.join(__dirname, 'bin', 'mcp-server.js')

async function testMcpServer() {
  console.log('Starting MCP server test...\n')

  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let buffer = ''

  server.stdout.on('data', (data) => {
    buffer += data.toString()
    // Try to parse complete JSON-RPC messages
    const lines = buffer.split('\n')
    for (let i = 0; i < lines.length - 1; i++) {
      try {
        const response = JSON.parse(lines[i])
        console.log('Response:', JSON.stringify(response, null, 2))
      } catch (e) {
        // Not valid JSON, might be partial
      }
    }
    buffer = lines[lines.length - 1]
  })

  server.stderr.on('data', (data) => {
    console.log('Server log:', data.toString())
  })

  // Send initialize request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0',
      },
    },
  }

  console.log('Sending initialize request...')
  server.stdin.write(JSON.stringify(initRequest) + '\n')

  await sleep(1000)

  // Send list_resources request
  const listResourcesRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list',
    params: {},
  }

  console.log('\nSending resources/list request...')
  server.stdin.write(JSON.stringify(listResourcesRequest) + '\n')

  await sleep(1000)

  // Send list_tools request
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/list',
    params: {},
  }

  console.log('\nSending tools/list request...')
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n')

  await sleep(1000)

  // Send list_prompts request
  const listPromptsRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'prompts/list',
    params: {},
  }

  console.log('\nSending prompts/list request...')
  server.stdin.write(JSON.stringify(listPromptsRequest) + '\n')

  await sleep(1000)

  // Test mbc_analyze_project tool
  const analyzeRequest = {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'mbc_analyze_project',
      arguments: {},
    },
  }

  console.log('\nSending tools/call (mbc_analyze_project) request...')
  server.stdin.write(JSON.stringify(analyzeRequest) + '\n')

  await sleep(2000)

  console.log('\n--- Test complete ---')
  server.kill()
  process.exit(0)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

testMcpServer().catch(console.error)
