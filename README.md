
[![Website](https://img.shields.io/badge/website-artinet.io-black)](https://artinet.io/)
[![npm version](https://img.shields.io/npm/v/@artinet/router.svg)](https://www.npmjs.com/package/@artinet/router)
[![npm downloads](https://img.shields.io/npm/dt/@artinet/router.svg)](https://www.npmjs.com/package/@artinet/router)
[![Apache License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/npm/@artinet/router/badge.svg)](https://snyk.io/test/npm/@artinet/router)
[![GitHub stars](https://img.shields.io/github/stars/the-artinet-project/router?style=social)](https://github.com/the-artinet-project/router/stargazers)
[![Discord](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)

# @artinet/router

A tool for routing messages between A2A enabled AI agents and marshalling MCP tool servers.

https://github.com/user-attachments/assets/b952b0f7-550a-44a3-b882-2bb3345be0b1

## Features

- **Agent Management**: Route messages between multiple AI agents
- **Tool Integration**: MCP tool integration with concurrent execution
- **Session Management**: Persistent sessions with message history
- **Coming Soon**: A guide to create your own custom router using the IRouter interface

## Installation

```bash
npm install @artinet/router
```

## Quick Start

Use the [`create-agent`](https://www.npmjs.com/package/@artinet/create-agent) command:

```bash
npx @artinet/create-agent@latest
```

Select the [orchestrator agent](https://github.com/the-artinet-project/create-agent/blob/main/templates/orchestrator/src/agent.ts) to jump right into agent routing.

### Basic Usage

```typescript
import { LocalRouter } from "@artinet/router";

const router = new LocalRouter();

const result = await router.connect({
  message: "Hello World!",
});
```

### Router with Agents

```typescript
import { LocalRouter } from "@artinet/router";
import { AgentBuilder, FileStore, getPayload } from "@artinet/sdk";

const router = new LocalRouter();

// Create an agent and define its behavior
router.createAgent({
  engine: AgentBuilder()
    .text(({ command }) => {
      return getPayload(command.message).text;
    })
    .createAgentEngine(),
  agentCard: { //must be a valid agent card
    name: "EchoAgent",
    description: "Echos back every request exactly",
    ...
  },
  tasks: new FileStore("my_dir"), // Save sessions to disk (must be a valid directory)
});

// Call the agent via a prompt
const result: string = await router.connect({
  message: {
    identifier: "deepseek-ai/DeepSeek-R1", // Find a valid model identifier @ artinet.io; Defaults to DeepSeek-R1
    session: {
      messages: [
        { role: "user", content: "Use the echo agent to reply to me" },
      ],
    },
    preferredEndpoint: "hf-inference",
    options: { isAuthRequired: false },
  },
  agents: ["EchoAgent"], // Provide a list of allowed agents
  callbackFunction: (update) => console.log("Response:", update), // A callback function to recieve updates from the router
  taskId: "task123", // Pass a taskId to resume a saved agent session
});

await router.close();
```

### Router as Agent

```typescript
import { LocalRouter } from "@artinet/router";
import { AgentBuilder, FileStore } from "@artinet/sdk";

// Create a router with tools
const router = await LocalRouter.createRouter({
  mcpServers: {
    stdioServers: [
      {
        command: "npx",
        args: [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "/path/to/allowed/files",
        ],
      },
      {
        command: "uvx",
        args: ["mcp-server-fetch"],
      },
    ],
  },
});

router.createAgent({
  engine: AgentBuilder()
    .text(({ command }) => await router.connect({
        message: {
          identifier: "deepseek-ai/DeepSeek-R1",
          session: {
            messages: [
              { role: "system", content: "If the caller wants to create any files, only make them in /path/to/allowed/files/current" }
              { role: "user", content: getPayload(command).text }
          ]},
          preferredEndpoint: "hf-inference",
          options: { isAuthRequired: false },
        },
        tools: ["secure-filesystem-server"], //a list of allowed tools
        callbackFunction: (update) => console.log("File Manager:", update)
    })).createAgentEngine(),
  agentCard: {
    name: "File Manager",
    description: "An agent that can manage the file system",
    ...
  },
  tasks: new FileStore("my_dir"), //must be a valid directory
});

const result: string = await router.connect({
  message: "Check the status of xyz.com and write that update to a text file in /path/to/allowed/files",
  tools: ["mcp-fetch"],
  agents: ["File Manager"]
});

await router.close();
```

\*Currently only supports stdio MCP Servers.

### Core Commands

- `connect(params, tools[], agents[], callback?)` - Execute task with routing
- `createAgent(params)` - Create new agent instance
- `createTool(server)` - Create tool from MCP server
- `close()` - Close all connections

## About

This library leverages api.artinet.io to route commands to local agents & tools.

## Deprecation Notice

The `@modelcontextprotocol/sdk` will be changed to a peer dependancy in a future release.

## License

Apache-2.0 - see [LICENSE](LICENSE)
