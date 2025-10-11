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
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { parseResponse } from "../src/router/session.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
jest.setTimeout(10000);
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
          transport: new StdioClientTransport({
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
    const newRequest = await sessionManager.initSession(
      ["test-tool"],
      ["test-agent"],
      new ToolManager(toolMap),
      new AgentManager()
    );
    expect(newRequest).toBeDefined();
    expect(newRequest.options?.tools?.localServers).toBeDefined();
    expect(newRequest.options?.tools?.localServers?.length).toBe(1);
    expect(
      newRequest.options?.tools?.localServers?.[0].implementation.name
    ).toBe("test-tool");
  });

  it("should send message", async () => {
    const sessionManager = new SessionManager(request);

    const transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-everything"],
    });

    const client = await initClient(
      { name: "test-tool", version: "1.0.0", title: "test-tool" },
      {},
      transport
    );

    const newRequest = await sessionManager.initSession(
      ["test-tool"],
      ["test-agent"],
      new ToolManager(
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
      ),
      new AgentManager()
    );
    expect(newRequest).toBeDefined();
    const response = await sessionManager.sendMessage({
      role: "user",
      content: "this is a test message",
    });
    expect(response).toBeDefined();
    expect(response.agentResponse).toBeDefined();
    const parsedResponse = parseResponse(response);
    expect(parsedResponse).toBeDefined();
    expect(response.options?.tools?.requests).toBeDefined();
    expect(
      response.options?.tools?.requests?.[0]?.callToolRequest
    ).toBeDefined();
    await client.close();
    await transport.close();
  }, 30000);
});
