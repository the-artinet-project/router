# @artinet/router

A tool for routing messages between A2A enabled AI agents and marshalling MCP tool servers.

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
import { AgentBuilder, Context, FileStore, getPayload } from "@artinet/sdk";

const router = new LocalRouter();

// Create an agent and define its behavior
router.createAgent({
  engine: AgentBuilder()
    .text(({ command }) => {
      return getPayload(command).text;
    })
    .createAgentEngine(),
  agentCard: {
    name: "EchoAgent",
    description: "Echos back the users request",
  },
  tasks: new FileStore("my_dir"), // Save sessions to disk
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
  },
  tasks: new FileStore("my_dir"),
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

### About

This library leverages api.artinet.io to route commands to local agents & tools.

## License

GPL-3.0 - see [LICENSE](LICENSE)
