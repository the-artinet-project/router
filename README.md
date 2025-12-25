[![Website](https://img.shields.io/badge/website-artinet.io-black)](https://artinet.io/)
[![npm version](https://img.shields.io/npm/v/@artinet/router.svg)](https://www.npmjs.com/package/@artinet/orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@artinet/router.svg)](https://www.npmjs.com/package/@artinet/orchestrator)
[![Apache License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Known Vulnerabilities](https://snyk.io/test/npm/@artinet/orchestrator/badge.svg)](https://snyk.io/test/npm/@artinet/orchestrator)
[![GitHub stars](https://img.shields.io/github/stars/the-artinet-project/orchestrator?style=social)](https://github.com/the-artinet-project/orchestrator/stargazers)
[![Discord](https://dcbadge.limes.pink/api/server/DaxzSchmmX?style=flat)](https://discord.gg/DaxzSchmmX)

# @artinet/orchestrator

Dynamic orchestration for A2A agents and MCP tools.

## Installation

```bash
npm install @artinet/orchestrator @modelcontextprotocol/sdk
```

## Quick Start

```typescript
import { create } from "@artinet/orchestrator";

const model = create({ modelId: "gpt-4" });

// Add MCP tools
model.add({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
});

// Connect and get a response
const response = await model.connect("List files in /tmp");
console.log(response);

// Clean up
await model.stop();
```

## Adding Agents

```typescript
import { create } from "@artinet/orchestrator";

const model = create({ modelId: "gpt-4" });

model.add({
  engine: async function* (context: A2A.Context) {
    yield {
      kind: "status-update",
      status: {
        state: "completed",
        message: {
          kind: "message",
          role: "agent",
          parts: [
            {
              kind: "text",
              text: `Hello from agent!`,
            },
          ],
          messageId: "msg-1",
        },
      },
      taskId: context.taskId,
      contextId: context.contextId,
      final: true,
    };
  },
  agentCard: {
    name: "EchoAgent",
    description: "Echoes back every request",
  },
});

const result = await model.connect("Say hello");
```

## Events

```typescript
model.events.on("update", (data) => {
  console.log("Update:", data);
});

model.events.on("error", (error, task) => {
  console.error(`Error in ${task.id}:`, error);
});
```

## Expose as an A2A Agent

```typescript
const agent = model.agent;

await agent.sendMessage({
  message: {
    role: "user",
    parts: [{ kind: "text", text: "Hello" }],
  },
});
```

## Custom Provider

Bring your own LLM backend:

```typescript
import { create, type APIProvider } from "@artinet/orchestrator";

const provider: APIProvider = async (request, signal) => {
  const response = await myLLM.chat(request.messages, { signal });
  return {
    agentResponse: response.content,
    timestamp: new Date().toISOString(),
    options: {
      tools: { requests: response.toolCalls ?? [] },
      agents: { requests: response.agentCalls ?? [] },
    },
  };
};

const model = create({ modelId: "my-model", provider });
```

## Environment

| Variable              | Description          | Default                                   |
| --------------------- | -------------------- | ----------------------------------------- |
| `ARTINET_API_URL`     | API endpoint         | `https://api.stage.artinet.io/v1/connect` |
| `DEFAULT_CONCURRENCY` | Max concurrent calls | `10`                                      |
| `DEFAULT_ITERATIONS`  | Max agentic loops    | `10`                                      |

## License

Apache-2.0
