# @artinet/router

A TypeScript library for routing messages to AI agents and managing tool interactions.

## Features

- **Agent Management**: Route messages between multiple AI agents
- **Tool Integration**: MCP tool integration with concurrent execution
- **Session Management**: Persistent sessions with message history
- **Type Safety**: Full TypeScript support
- **Coming Soon**: Creating your own custom router using the IRouter interface

## Installation

```bash
npm install @artinet/router
```

## Quick Start

### Basic Usage

```typescript
import { LocalRouter } from "@artinet/router";

const router = new LocalRouter();

const result = await router.connect(
  {
    identifier: "session-id",
    session: { messages: [{ role: "user", content: "Hello!" }] },
    preferredEndpoint: "hf-inference",
    options: { isAuthRequired: false },
  },
  [],
  []
);
```

### Full Router with Tools and Agents

```typescript
import { LocalRouter, FileStore } from "@artinet/router";
import { Agent } from "@artinet/sdk";

// Create a router with MCP tools
const router: LocalRouter = await LocalRouter.createRouter({
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
        command: "python",
        args: ["-m", "mcp_server_git", "/path/to/git/repo"],
      },
    ],
  },
});

// Create agents
const codeAgent: Agent = router.createAgent({
  agentCard: {
    name: "CodeAgent",
    description: "Helps with code analysis",
  },
  tasks: new FileStore("my_dir"), //save sessions to disk
});

// Execute with tools and agents
const result: string = await router.connect(
  {
    identifier: "deepseek-ai/DeepSeek-R1",
    session: {
      messages: [{ role: "user", content: "Analyze this repository" }],
    },
    preferredEndpoint: "hf-inference",
    options: { isAuthRequired: false },
  },
  ["filesystem", "git"], // tool IDs
  ["CodeAgent"], // agent IDs
  (response) => console.log("Response:", response),
  taskId: "task123" //pass session identifiers to resume
);

await router.close();
```

## API

### LocalRouter

- `connect(params, tools[], agents[], callback?)` - Execute task with routing
- `createAgent(params)` - Create new agent instance
- `createTool(server)` - Create tool from MCP server
- `close()` - Close all connections

## Development

```bash
npm install
npm run build
npm test
```

## License

GPL-3.0 - see [LICENSE](LICENSE)
