import { jest, describe, it, expect } from "@jest/globals";
import { ConnectRequest } from "@artinet/types";
import { AgentCard, createAgentServer, createAgent } from "@artinet/sdk";
import { echoAgentEngine } from "./agents/echo-agent.js";
import {
  LocalRouter,
  ToolManager,
  AgentManager,
  RouterRequest,
} from "../src/index.js";
import { EventBus } from "../src/utils/event-bus.js";

describe("Router Tests", () => {
  jest.setTimeout(10000);
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

  it.skip("should init router", async () => {
    const agentManager = new AgentManager();
    const toolManager = new ToolManager();
    const abortController = new AbortController();
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
      new EventBus(),
      toolManager,
      agentManager
    );
    expect(router).toBeDefined();
    router.on("update", (_) => {
      abortController.abort();
    });
    router.on("error", (_) => {
      abortController.abort();
    });
    const response = await router.connect({
      message: defaultProps,
      tools: ["example-servers/everything"],
      agents: ["test-agent"],
      options: {
        abortSignal: abortController.signal,
      },
    });
    expect(response).toBeDefined();
    expect(abortController.signal.aborted).toBe(true);
    await router.close();
  }, 60000);
  it("should init with echo agent", async () => {
    const toolManager = new ToolManager();
    const agentManager = new AgentManager();
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
      new EventBus(),
      toolManager,
      agentManager
    );
    router.createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    expect(router).toBeDefined();
    const abortController = new AbortController();
    router.on("update", (_) => {
      abortController.abort();
    });
    router.on("error", (_) => {
      abortController.abort();
    });
    const response = await router.connect({
      message: {
        ...defaultProps,
        session: {
          ...defaultProps.session,
          messages: [
            ...defaultProps.session.messages,
            { role: "user", content: "You are a test agent. Echo the input" },
          ],
        },
      },
      tools: ["example-servers/everything"],
      agents: ["test-agent"],
      options: {
        abortSignal: abortController.signal,
      },
    });
    expect(response).toBeDefined();
    await router.close();
    expect(abortController.signal.aborted).toBe(true);
  }, 60000);
  it("should send message", async () => {
    const toolManager = new ToolManager();
    const agentManager = new AgentManager();
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
      new EventBus(),
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
    const routerRequest: RouterRequest = {
      ...defaultProps,
      session: {
        ...defaultProps.session,
        messages: [
          ...defaultProps.session.messages,
          { role: "user", content: "You are a test agent. Echo the input" },
        ],
      },
    };
    router.on("update", (_) => {
      callbackCalled = true;
      abortController.abort();
    });
    router.on("error", (_) => {
      callbackCalled = true;
      abortController.abort();
    });
    const response = await router
      .connect({
        message: routerRequest,
        tools: ["example-servers/everything"],
        agents: ["test-agent"],
        options: {
          abortSignal: abortController.signal,
        },
      })
      .catch((error) => {
        console.log("error: ", error);
      });
    expect(response).toBeDefined();
    await router.close();
    expect(abortController.signal.aborted).toBe(true);
    expect(callbackCalled).toBe(true);
  }, 60000);
  it("should emit on tool response", async () => {
    const toolManager = new ToolManager();
    const agentManager = new AgentManager();
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
      new EventBus(),
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
    const routerRequest: RouterRequest = {
      ...defaultProps,
      session: {
        ...defaultProps.session,
        messages: [
          ...defaultProps.session.messages,
          { role: "user", content: "You are a test agent. Echo the input" },
        ],
      },
    };
    router.on("update", (_) => {
      callbackCalled = true;
      abortController.abort();
    });
    router.on("error", (_) => {
      callbackCalled = true;
      abortController.abort();
    });
    const response = await router
      .connect({
        message: routerRequest,
        tools: ["example-servers/everything"],
        // agents: ["test-agent"],
        options: {
          abortSignal: abortController.signal,
        },
      })
      .catch((error) => {
        console.log("error: ", error);
      });
    expect(response).toBeDefined();
    await router.close();
    expect(abortController.signal.aborted).toBe(true);
    expect(callbackCalled).toBe(true);
  }, 60000);
  it("should send string message", async () => {
    const toolManager = new ToolManager();
    const agentManager = new AgentManager();
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
      new EventBus(),
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
    router.on("update", (_) => {
      callbackCalled = true;
      abortController.abort();
    });
    const response = await router
      .connect({
        message: "You are a test agent. Echo the input",
        tools: ["example-servers/everything"],
        agents: ["test-agent"],
        options: {
          abortSignal: abortController.signal,
        },
      })
      .catch((error) => {
        console.log("error: ", error);
      });
    expect(response).toBeDefined();
    expect(abortController.signal.aborted).toBe(true);
    expect(callbackCalled).toBe(true);
    await router.close();
  }, 60000);
  it("should run as an agent", async () => {
    const toolManager = new ToolManager();
    const agentManager = new AgentManager();
    const abortController = new AbortController();
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
      undefined,
      toolManager,
      agentManager,
      {
        abortSignal: abortController.signal,
      }
    );
    router.on("update", (_) => {
      abortController.abort();
    });
    router.on("error", (_) => {
      abortController.abort();
    });
    router.createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    const agent = router.toAgent(
      "You are a test agent. Echo the input",
      {
        name: "main-agent",
        description: "A test agent for unit tests",
        skills: [
          {
            name: "test-skill",
            description: "Echo the input",
            id: "test-skill",
            tags: ["test", "skill", "echo"],
            examples: ["this input will be echoed"],
            inputModes: ["text/plain"],
            outputModes: ["text/plain"],
          },
        ],
      },
      {
        tools: ["example-servers/everything"],
        agents: ["test-agent"],
      }
    );
    const response = await agent.sendMessage({
      message: {
        kind: "message",
        messageId: "test-message-id",
        role: "user",
        parts: [{ kind: "text", text: "You are a test agent. Echo the input" }],
      },
    });
    expect(response).toBeDefined();
    expect(abortController.signal.aborted).toBe(true);

    await router.close();
  }, 60000);
  it("should detect and call an agent server", async () => {
    const agentServer = createAgentServer({
      agent: createAgent({
        engine: echoAgentEngine,
        agentCard: {
          ...testAgentCard,
        },
      }),
      agentCardPath: "/.well-known/agent-card.json",
    });
    const server = agentServer.app.listen(3001, () => {});
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const abortController = new AbortController();
    const router = await LocalRouter.createRouter(
      undefined,
      undefined,
      new ToolManager(),
      new AgentManager(),
      {
        abortSignal: abortController.signal,
      }
    );
    router.on("update", (_) => {
      abortController.abort();
    });
    const response = await router
      .connect({
        message: "Call the test-agent and make sure it responds",
        options: {
          abortSignal: abortController.signal,
        },
        agents: ["test-agent"],
      })
      .catch((error) => {
        console.log("error: ", error);
      });
    expect(response).toBeDefined();
    expect(abortController.signal.aborted).toBe(true);
    await router.close();
    await server.close();
    await agentServer.agent.stop();
  }, 60000);
});
