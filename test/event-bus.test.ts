import { jest, describe, it, expect } from "@jest/globals";
import { ConnectRequest } from "@artinet/types";
import { LocalRouter, ToolManager, AgentManager } from "../src/index.js";
import { EventBus } from "../src/utils/event-bus.js";
import { createMockProvider } from "./utils.js";

jest.setTimeout(10000);
describe("Router Tests", () => {
  let defaultProps: ConnectRequest = {
    identifier:
      "0xf7dcee219e1a4027191508511c99ea64fe7202c71df416b5e5ed03cc2e6b386f",
    session: { messages: [{ role: "user", content: "test-message" }] },
    preferredEndpoint: "hf-inference",
    options: {
      isAuthRequired: false,
      isFallbackAllowed: false,
      params: {
        test: "test",
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

  it("should init router", async () => {
    const agentManager = new AgentManager();
    const toolManager = new ToolManager();
    const contextManager = new EventBus();
    const router = await LocalRouter.createRouter(
      {
        mcpServers: {
          stdioServers: [
            {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-everything"],
            },
          ],
        },
      },
      contextManager,
      toolManager,
      agentManager
    );
    expect(router).toBeDefined();
    const response = await router.connect({
      message: {
        ...defaultProps,
        apiProvider: createMockProvider(
          "calling tools & agents",
          [
            {
              kind: "tool_request",
              callToolRequest: {
                method: "tools/call",
                params: {
                  name: "echo",
                  arguments: {
                    message: "test-message",
                  },
                },
              },
              id: "example-servers/everything",
            },
          ],
          [
            {
              kind: "agent_request",
              uri: "test-agent",
              directive: "test-directive",
            },
          ]
        ),
      },
      tools: ["example-servers/everything"],
      agents: ["test-agent"],
    });
    expect(response).toBeDefined();
    await router.close();
  }, 40000);
});
