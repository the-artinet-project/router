[![Website](https://img.shields.io/badge/website-artinet.io-black)](https://artinet.io/)
[![npm version](https://img.shields.io/npm/v/@artinet/router.svg)](https://www.npmjs.com/package/@artinet/router)
[![npm downloads](https://img.shields.io/npm/dt/@artinet/router.svg)](https://www.npmjs.com/package/@artinet/router)
[![Apache License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/npm/@artinet/router/badge.svg)](https://snyk.io/test/npm/@artinet/router)
[![GitHub stars](https://img.shields.io/github/stars/the-artinet-project/router?style=social)](https://github.com/the-artinet-project/router/stargazers)
[![Discord](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)](https://discord.gg/DaxzSchmmX)

# @artinet/router

A tool for routing messages between A2A enabled AI agents and marshalling MCP tool servers.

https://github.com/user-attachments/assets/b952b0f7-550a-44a3-b882-2bb3345be0b1

**Breaking Changes in v0.0.8**

- `callbackFunction` has been removed from `router.connect` infavor of event emissions ([see below](#router-with-agents)).
- Sub-agent calls now use their own unique `taskId`s to prevent task overlap.
- Router no longer takes a generic `ContextManager` and now requires the new [`EventBus`](/src/utils/event-bus.ts) which centralizes event emissions across contexts.
- `respondOnFinalOnly` has been removed infavor of [`TaskOptions`](/src/types/router.ts)
- `callAgents` now uses `sendMessage` instead of `streamMessage`.

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
  message: "Hello, World!",
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

// Subscribe to updates like the results of tool/agent calls
router.on("update", (response: any[]) => {
  console.log(response);
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

// Convert the router into an agent
const agent = router.toAgent(
  // Provide instructions for the agent to follow
  "You are a File Management agent. Save every request you recieve in a text file",
  { // The AgentCard describing the Agent and it's skills
    name: "File Manager",
    description: "An agent that can manage the file system",
    ...
  },
  { // Add optional whitelists for tools & agents (defaults to all available tools/agents)
    tools: ["secure-filesystem-server"],
    agents: [...],
  }
);

// Interact with the new agent as you normally would
const result = agent.sendMessage({
  message: {
    ...
    role: "user",
    parts: [{ kind: "text", text: "Please save this message" }],
  },
});

await router.close();
```

### Bring Your Own API

Implement an `ApiProvider` function to plug in your own backend.

Consume a `ConnectRequest` from the router and return a `ConnectResponse`.

Each `ConnectRequest` will include:

- The available tools/agents that have been whitelisted for the request.
- The responses/results of previous agent/tool calls. (e.g. `AgentResponse`, `ToolResponse`)

Ensure that you include an array of `ToolRequest`s and/or `AgentRequest`s in your `ConnectResponse`. This will trigger the router to invoke those tools/agents

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
    ],
  },
});

// Plug-in your own API function by converting tool/agents Calls into a format that the router will understand
const response = await router.connect({
  message: {
    session: { messages: [{ role: "user", content: "Hello!" }] },
    apiProvider: async (request: ConnectRequest) => {
      // The tools/agents available for this request
      const availableTools = request.options?.tools?.localServers;
      const availableAgents = request.options?.agents?.localServers;
      // The responses/results of previous tool/agent invocations
      const toolResponses = request.options?.tools?.results;
      const agentResponses = request.options?.agents?.responses;

      ... // Call your own API here

      // Then return a response including requests to any tools and agents
      const response: ConnectResponse = {
        agentResponse: "Hello!", // A response from the LLM
        timestamp: new Date().toISOString(),
        options: {
          tools: {
            results: [],
            requests: [
              {
                // Format a tool request
                kind: "tool_request",
                callToolRequest: {
                  method: "tools/call",
                  params: {
                    name: "hello-function",
                  },
                },
                id: "test-tool-id",
              },
            ],
          },
          agents: {
            responses: [],
            requests: [
              {
                // Format an agent request
                kind: "agent_request",
                uri: "HelloAgent",
                directive: "Say Hello!",
              },
            ],
          },
        },
      };
      return response;
    },
  },
  tools: ["hello-function"],
  agents: ["HelloAgent"],
});
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
