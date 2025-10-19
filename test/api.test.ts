import { jest, describe, beforeAll, afterAll, it, expect } from "@jest/globals";
import { ConnectRequest, Session, ToolInfo } from "@artinet/types";
import { connectv1 } from "../src/api/connect.js";
import { Client } from "@modelcontextprotocol/sdk/client";
import {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { initClient, getToolInfo } from "../src/tools/index.js";
import { AgentCard, createAgent } from "@artinet/sdk";
import { echoAgentEngine } from "./agents/echo-agent.js";
import { safeClose, safeStdioTransport } from "../src/utils/safeTransport.js";
jest.setTimeout(10000);
describe("API Tests", () => {
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
  let transport: StdioClientTransport;
  let client: Client;
  beforeAll(async () => {
    transport = safeStdioTransport({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-everything"],
    });
    client = await initClient(
      { name: "MCP Client", version: "1.0.0" },
      {},
      transport
    );
  });
  afterAll(async () => {
    await safeClose(client, transport);
  });
  it("should connect to api", async () => {
    const response = await connectv1(defaultProps);
    expect(response).toBeDefined();
  });
  it("should send mcp info to api", async () => {
    const mcpInfo: ToolInfo = await getToolInfo(client);
    const response = await connectv1({
      ...defaultProps,
      options: {
        ...defaultProps.options,
        tools: {
          ...defaultProps.options?.tools,
          localServers: [mcpInfo],
        },
      },
    });
    expect(response).toBeDefined();
  }, 20000);
  it("should get tool request", async () => {
    const mcpInfo: ToolInfo = await getToolInfo(client);
    const response = await connectv1({
      ...defaultProps,
      session: {
        ...defaultProps.session,
        messages: [
          ...defaultProps.session.messages,
          { role: "user", content: "use the echo tool" },
        ],
      },
      options: {
        ...defaultProps.options,
        tools: {
          ...defaultProps.options?.tools,
          localServers: [mcpInfo],
        },
      },
    });
    expect(response).toBeDefined();
  }, 20000);
  it("should request and execute a tool", async () => {
    const mcpInfo: ToolInfo = await getToolInfo(client);
    const response = await connectv1({
      ...defaultProps,
      session: {
        ...defaultProps.session,
        messages: [
          ...defaultProps.session.messages,
          { role: "user", content: "use the echo tool" },
        ],
      },
      options: {
        ...defaultProps.options,
        tools: {
          ...defaultProps.options?.tools,
          localServers: [mcpInfo],
        },
      },
    });
    const toolRequest = response.options?.tools?.requests[0];
    expect(toolRequest).toBeDefined();
    expect(toolRequest?.callToolRequest.params).toBeDefined();
    expect(
      toolRequest?.callToolRequest.params as CallToolRequest["params"]
    ).toBeDefined();
    const toolResponse = await client.callTool(
      toolRequest?.callToolRequest.params as CallToolRequest["params"]
    );
    expect(toolResponse).toBeDefined();
    expect((toolResponse as CallToolResult).content[0].text).toEqual(
      "Echo: test-message"
    );
  }, 40000);
  it("should request, execute and respond", async () => {
    const mcpInfo: ToolInfo = await getToolInfo(client);
    const initialProps: ConnectRequest = {
      ...defaultProps,
      session: {
        messages: [
          ...defaultProps.session.messages,
          { role: "user", content: "use the echo tool" },
        ],
      },
      options: {
        ...defaultProps.options,
        tools: {
          ...defaultProps.options?.tools,
          localServers: [mcpInfo],
        },
      },
    };
    const response = await connectv1(initialProps);
    const toolRequest = response.options?.tools?.requests[0];
    expect(toolRequest).toBeDefined();
    expect(toolRequest?.callToolRequest.params).toBeDefined();
    expect(
      toolRequest?.callToolRequest.params as CallToolRequest["params"]
    ).toBeDefined();
    const toolResponse = await client.callTool(
      toolRequest?.callToolRequest.params as CallToolRequest["params"]
    );
    expect(toolResponse).toBeDefined();
    expect((toolResponse as CallToolResult).content[0].text).toEqual(
      "Echo: test-message"
    );
    const newSession: Session = {
      ...initialProps.session,
      messages: [
        ...initialProps.session.messages,
        {
          role: "agent" as const,
          content: JSON.parse(response.agentResponse)[0]?.generated_text,
        },
      ],
    };
    const finalResponse = await connectv1({
      ...initialProps,
      session: newSession,
      options: {
        ...initialProps.options,
        initialized: true,
        tools: {
          ...initialProps.options?.tools,
          results: [
            {
              callToolResult: toolResponse as CallToolResult,
              name: toolRequest?.callToolRequest.params.name ?? "",
              id: toolRequest?.id ?? "",
              kind: "tool_response",
              callToolRequest: toolRequest?.callToolRequest,
            },
          ],
        },
      },
    });
    expect(finalResponse).toBeDefined();
  }, 40000);
  it("should send agentCard to api", async () => {
    const testAgentCard: AgentCard = {
      description: "A test agent for unit tests",
      name: "Test Agent",
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
    const response = await connectv1({
      ...defaultProps,
      session: {
        ...defaultProps.session,
        messages: [
          ...defaultProps.session.messages,
          { role: "user", content: "use the echo skill" },
        ],
      },
      options: {
        ...defaultProps.options,
        agents: {
          ...defaultProps.options?.agents,
          localServers: [testAgentCard],
        },
      },
    });
    expect(response.options?.agents?.requests).toBeDefined();
    expect(response.options?.agents?.requests?.[0].uri).toBeDefined();
    expect(response.options?.agents?.requests?.[0].directive).toBeDefined();
  }, 40000);
  it("should execute an agent skill", async () => {
    const testAgentCard: AgentCard = {
      description: "A test agent for unit tests",
      name: "Test Agent",
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
    const echoAgent = createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    const response = await connectv1({
      ...defaultProps,
      session: {
        ...defaultProps.session,
        messages: [
          ...defaultProps.session.messages,
          { role: "user", content: "use the echo skill" },
        ],
      },
      options: {
        ...defaultProps.options,
        agents: {
          ...defaultProps.options?.agents,
          localServers: [echoAgent.agentCard],
        },
      },
    });
    expect(response.options?.agents?.requests).toBeDefined();
    expect(response.options?.agents?.requests?.[0].uri).toBeDefined();
    const directive = response.options?.agents?.requests?.[0].directive ?? "";
    expect(directive).toBeDefined();
    const agentResponse = await echoAgent.sendMessage({
      message: {
        kind: "message",
        messageId: "test-message-id",
        role: "user",
        taskId: "test-task-id",
        contextId: "test-context-id",
        parts: [{ kind: "text", text: directive }],
      },
    });
    expect(agentResponse).toBeDefined();
  }, 40000);
});
