# @artinet/router

A powerful TypeScript library for routing messages to appropriate AI agents and managing tool interactions in the Artinet ecosystem.

## Overview

The Artinet Router is a sophisticated message routing system that enables seamless communication between AI agents and tools. It provides a unified interface for managing agent-to-agent (A2A) interactions, tool execution, and session management within distributed AI systems.

## Features

- **Agent Management**: Create, manage, and route messages to multiple AI agents
- **Tool Integration**: Seamless integration with Model Context Protocol (MCP) tools
- **Session Management**: Persistent session handling with message history
- **Concurrent Execution**: Parallel tool execution with configurable limits
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Robust error handling and recovery mechanisms

## Installation

```bash
npm install @artinet/router
```

## Quick Start

```typescript
import { LocalRouter } from "@artinet/router";
import { ConnectRequest } from "@artinet/types";

// Create a router instance
const router = new LocalRouter();

// Define your connection request
const connectRequest: ConnectRequest = {
  identifier: "your-session-id",
  session: {
    messages: [{ role: "user", content: "Hello, world!" }],
  },
  preferredEndpoint: "hf-inference",
  options: {
    isAuthRequired: false,
    isFallbackAllowed: false,
    params: {
      // Your custom parameters
    },
    tools: {
      remoteServers: [],
      localServers: [],
      results: [],
    },
    agents: {
      localServers: [],
      remoteServers: [],
      responses: [],
    },
  },
};

// Connect and execute
const result = await router.connect(
  connectRequest,
  [], // tool IDs
  [], // agent IDs
  (response) => console.log("Response:", response)
);

console.log("Task completed:", result);
```

## API Reference

### LocalRouter

The main router class that manages agents, tools, and message routing.

#### Constructor

```typescript
new LocalRouter(
  contexts?: ContextManagerInterface<Command, State, Update>,
  tools?: ToolManager,
  agents?: AgentManager
)
```

#### Methods

##### `connect(params, tools, agents, callback?, taskId?, abortController?)`

Establishes a connection and executes a task with the specified parameters.

**Parameters:**

- `params`: Connection request parameters (excluding tools and agents)
- `tools`: Array of tool IDs to use
- `agents`: Array of agent IDs to use
- `callback`: Optional callback function for responses
- `taskId`: Optional task identifier (defaults to UUID)
- `abortController`: Optional abort controller for cancellation

**Returns:** Promise<string> - Task execution result

##### `createAgent(agentParams)`

Creates a new agent instance.

**Parameters:**

- `agentParams`: Agent creation parameters

**Returns:** Agent instance

##### `createTool(toolServer)`

Creates a new tool instance from MCP server parameters.

**Parameters:**

- `toolServer`: MCP server configuration

**Returns:** Promise<InitializedTool>

##### `close()`

Closes all agent and tool connections.

**Returns:** Promise<void>

#### Static Methods

##### `createRouter(servers, contexts?, tools?, agents?)`

Creates a router instance with pre-configured MCP servers.

**Parameters:**

- `servers`: Server configuration object
- `contexts`: Optional context manager
- `tools`: Optional tool manager
- `agents`: Optional agent manager

**Returns:** Promise<LocalRouter>

### SessionManager

Manages session state and message history.

#### Methods

##### `initSession(tools, agents, toolManager, agentManager)`

Initializes a new session with specified tools and agents.

##### `updateSession(message)`

Updates the session with a new message.

### ToolManager

Manages tool instances and execution.

#### Methods

##### `setTool(tool)`

Registers a new tool instance.

##### `getTool(id)`

Retrieves a tool by ID.

##### `callTools(toolRequests, callback?)`

Executes multiple tool requests concurrently.

## Configuration

### Environment Variables

- `NODE_OPTIONS`: Set to `--experimental-vm-modules` for Jest compatibility

### Dependencies

- Node.js >= 18.0.0
- TypeScript >= 5.2.2

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/the-artinet-project/artinet-sdk.git
cd artinet-router

# Install dependencies
npm install

# Build the project
npm run build
```

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Watch mode compilation
- `npm run test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run lint` - Run ESLint
- `npm run clean` - Clean build artifacts

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Architecture

The router follows a modular architecture with clear separation of concerns:

- **Router**: Main orchestration layer
- **SessionManager**: Handles session state and message flow
- **ToolManager**: Manages tool instances and execution
- **AgentManager**: Manages agent instances and routing
- **Task Execution**: Handles concurrent task processing

## Error Handling

The router includes comprehensive error handling:

- Graceful degradation when tools or agents fail
- Automatic retry mechanisms for transient failures
- Detailed error logging and reporting
- Abort controller support for task cancellation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Related Projects

- [@artinet/sdk](https://github.com/the-artinet-project/artinet-sdk) - Core Artinet SDK
- [@artinet/types](https://github.com/the-artinet-project/types) - TypeScript type definitions
- [Model Context Protocol](https://github.com/modelcontextprotocol) - Tool integration protocol

## Support

For support and questions:

- Create an issue on GitHub
- Join our community discussions
- Check the documentation wiki

## Changelog

### v0.0.1

- Initial release
- Basic router functionality
- Agent and tool management
- Session handling
- Concurrent execution support
