import { jest, describe, it, expect } from "@jest/globals";
import { ConnectRequest } from "@artinet/types";
import { AgentCard, ContextManager } from "@artinet/sdk";
import { echoAgentEngine } from "./agents/echo-agent.js";
import {
  LocalRouter,
  ToolManager,
  AgentManager,
  type LocalRouter as LocalRouterType,
} from "../publish-temp/dist/router.js";

jest.setTimeout(10000);
describe.skip("Bundle Tests", () => {
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
  const testAgentCard: AgentCard = {
    description: "A test agent for unit tests",
    name: "test-agent",
    url: "https://test-agent.com",
    protocolVersion: "0.3.0",
    version: "1.0.0",
    capabilities: {
      extensions: [],
      streaming: false,
      pushNotifications: false,
    },
    defaultInputModes: [],
    defaultOutputModes: [],
    skills: [
      {
        id: "test-skill",
        name: "echo",
        description: "Echo the input",
        tags: ["test", "skill", "echo"],
        examples: ["this input will be echoed"],
        inputModes: ["text/plain"],
        outputModes: ["text/plain"],
      },
    ],
  };

  it("should send message", async () => {
    const toolManager = new ToolManager();
    const agentManager = new AgentManager();
    //@ts-ignore
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
      new ContextManager(),
      toolManager,
      agentManager
    );
    router.createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    expect(router).toBeDefined();
    const abortController = new AbortController();
    let callbackCalled = false;
    const response = await router
      .connect(
        {
          ...defaultProps,
          session: {
            ...defaultProps.session,
            messages: [
              ...defaultProps.session.messages,
              { role: "user", content: "You are a test agent. Echo the input" },
            ],
          },
        },
        ["example-servers/everything"],
        ["test-agent"],
        (response: any[]) => {
          callbackCalled = true;
          abortController.abort();
        },
        undefined,
        abortController
      )
      .catch((error) => {
        console.log("error: ", error);
      });
    expect(response).toBeDefined();
    await router.close();
    expect(abortController.signal.aborted).toBe(true);
    expect(callbackCalled).toBe(true);
  }, 30000);
});
