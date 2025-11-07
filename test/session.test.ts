import { jest, describe, it, expect } from "@jest/globals";
import { ConnectRequest } from "@artinet/types";
import {
  AgentManager,
  SessionManager,
  ToolManager,
  initClient,
  getToolInfo,
  InitializedTool,
} from "../src/index.js";
import { Client } from "@modelcontextprotocol/sdk/client";
import { parseResponse } from "../src/router/session.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { safeStdioTransport } from "../src/utils/safeTransport.js";
import { echoAgentEngine, testAgentCard } from "./agents/echo-agent.js";
import { createAgent } from "@artinet/sdk";
import { createMockProvider } from "./utils.js";
jest.setTimeout(10000);

const testBothProvider = createMockProvider(
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
      id: "test-tool",
    },
  ],
  [
    {
      kind: "agent_request",
      uri: "test-agent",
      directive: "echo the input",
    },
  ]
);

describe("Session Tests", () => {
  let request: ConnectRequest = {
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

  it("should create session manager", async () => {
    const sessionManager = new SessionManager(request);
    expect(sessionManager).toBeDefined();
    expect(sessionManager.ConnectRequest).toBeDefined();
    expect(sessionManager.ConnectRequest.identifier).toBe(
      "0xf7dcee219e1a4027191508511c99ea64fe7202c71df416b5e5ed03cc2e6b386f"
    );
  });
  it("should init session", async () => {
    const sessionManager = new SessionManager(request);
    const impl: Implementation = {
      name: "test-tool",
      version: "1.0.0",
      title: "test-tool",
    };
    const toolMap: Map<string, InitializedTool> = new Map([
      [
        "test-tool",
        {
          client: new Client({
            name: "test-tool",
            version: "1.0.0",
            title: "test-tool",
          }),
          transport: safeStdioTransport({
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-everything"],
          }),
          info: {
            implementation: impl,
            prompts: [],
            resources: [],
            tools: [],
            serverCapabilities: {
              tools: { listChanged: false },
            },
            instructions: "",
          },
        },
      ],
    ]);
    const toolManager = new ToolManager(toolMap);
    const newRequest = await sessionManager.initSession(
      ["test-tool"],
      ["test-agent"],
      toolManager,
      new AgentManager()
    );
    expect(newRequest).toBeDefined();
    expect(newRequest.options?.tools?.localServers).toBeDefined();
    expect(newRequest.options?.tools?.localServers?.length).toBe(1);
    expect(
      newRequest.options?.tools?.localServers?.[0].implementation.name
    ).toBe("test-tool");
    await toolManager.close();
  });

  it("should send message", async () => {
    const sessionManager = new SessionManager(request);

    const transport = safeStdioTransport({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-everything"],
    });

    const client = await initClient(
      { name: "test-tool", version: "1.0.0", title: "test-tool" },
      {},
      transport
    );
    const toolManager = new ToolManager(
      new Map([
        [
          "test-tool",
          {
            client: client,
            transport: transport,
            info: await getToolInfo(client),
          },
        ],
      ])
    );
    const newRequest = await sessionManager.initSession(
      ["test-tool"],
      ["test-agent"],
      toolManager,
      new AgentManager()
    );
    expect(newRequest).toBeDefined();
    const response = await sessionManager.sendMessage(
      {
        role: "user",
        content: "this is a test message",
      },
      undefined,
      undefined,
      testBothProvider
    );
    expect(response).toBeDefined();
    expect(response.agentResponse).toBeDefined();
    const parsedResponse = parseResponse(response);
    expect(parsedResponse).toBeDefined();
    expect(response.options?.tools?.requests).toBeDefined();
    expect(
      response.options?.tools?.requests?.[0]?.callToolRequest
    ).toBeDefined();
    await toolManager.close();
  }, 30000);
  describe("subsession", () => {
    it("should add subSession", async () => {
      const sessionManager = new SessionManager(request);
      const agentManager = new AgentManager();
      const agent = createAgent({
        engine: echoAgentEngine,
        agentCard: testAgentCard,
      });
      agentManager.setAgent(agent);
      await sessionManager.initSession(
        ["test-tool"],
        ["test-agent"],
        new ToolManager(),
        agentManager
      );
      expect(sessionManager.SubSessions).toBeDefined();
      expect(Object.keys(sessionManager.SubSessions).length).toBe(1);
      expect(sessionManager.SubSessions["test-agent"]).toBeDefined();
      expect(sessionManager.SubSessions["test-agent"].taskId).toBeDefined();
      expect(sessionManager.SubSessions["test-agent"].iterations).toBe(0);
    });
    it("should not add subsession", async () => {
      const sessionManager = new SessionManager(request);
      await sessionManager.initSession(
        ["test-tool"],
        ["test-agent"],
        new ToolManager(),
        new AgentManager()
      );
      expect(sessionManager.SubSessions).toEqual({});
    });
    it("should add multiple subSessions", async () => {
      const sessionManager = new SessionManager(request);
      const agentManager = new AgentManager();
      const agent1 = createAgent({
        engine: echoAgentEngine,
        agentCard: testAgentCard,
      });
      const agent2 = createAgent({
        engine: echoAgentEngine,
        agentCard: {
          ...testAgentCard,
          name: "test-agent-2",
        },
      });
      agentManager.setAgent(agent1);
      agentManager.setAgent(agent2);
      await sessionManager.initSession(
        ["test-tool"],
        ["test-agent", "test-agent-2"],
        new ToolManager(),
        agentManager
      );
      expect(sessionManager.SubSessions).toBeDefined();
      expect(Object.keys(sessionManager.SubSessions).length).toBe(2);
      expect(sessionManager.SubSessions["test-agent"]).toBeDefined();
      expect(sessionManager.SubSessions["test-agent"].taskId).toBeDefined();
      expect(sessionManager.SubSessions["test-agent"].iterations).toBe(0);
      expect(sessionManager.SubSessions["test-agent-2"]).toBeDefined();
      expect(sessionManager.SubSessions["test-agent-2"].taskId).toBeDefined();
      expect(sessionManager.SubSessions["test-agent-2"].iterations).toBe(0);
    });
  });
});
