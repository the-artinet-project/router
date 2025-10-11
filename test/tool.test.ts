import { jest, describe, beforeAll, afterAll, it, expect } from "@jest/globals";
import {
  StdioClientTransport,
  StdioServerParameters,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Config, ToolInfo } from "@artinet/types";
import {
  getToolInfo,
  initClient,
  ToolManager,
  createTool,
  InitializedTool,
} from "../src/index.js";
jest.setTimeout(10000);

const config: Config = {
  "server-everything": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything"],
  },
  "server-filesystem": {
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "${XDG_DATA_HOME:-$HOME/.local/share}/",
    ],
  },
};

describe("Tool Tests", () => {
  let toolManager: ToolManager;
  beforeAll(async () => {
    toolManager = new ToolManager();
  });
  afterAll(async () => {
    await toolManager.close();
  });
  it("should init client", async () => {
    const client: Client = await initClient(
      { name: "MCP Client", version: "1.0.0" },
      {},
      new StdioClientTransport(
        config["server-everything"] as StdioServerParameters
      )
    );
    expect(client).toBeDefined();
  });
  describe("get tool info", () => {
    let client: Client;
    let transport: StdioClientTransport;
    beforeAll(async () => {
      transport = new StdioClientTransport(
        config["server-everything"] as StdioServerParameters
      );
      client = await initClient(
        { name: "MCP Client", version: "1.0.0" },
        {},
        transport
      );
    });
    afterAll(async () => {
      await client.close();
      await transport.close();
    });
    it("should get tool info", async () => {
      const toolInfo: ToolInfo = await getToolInfo(client);
      expect(toolInfo).toBeDefined();
      expect(toolInfo.implementation.name).toBe("example-servers/everything");
      expect(toolInfo.serverCapabilities).toBeDefined();
      expect(toolInfo.serverCapabilities.tools).toBeDefined();
      expect(toolInfo.tools).toBeDefined();
      expect(toolInfo.tools?.length).toBeGreaterThan(0);
      expect(toolInfo.resources).toBeDefined();
      expect(toolInfo.resources?.length).toBeGreaterThan(0);
      expect(toolInfo.prompts).toBeDefined();
      expect(toolInfo.prompts?.length).toBeGreaterThan(0);
      expect(toolInfo.instructions).toBeDefined();
    });
  });
  it("should create Tool", async () => {
    const tool: InitializedTool = await createTool({
      toolServer: config["server-everything"] as StdioServerParameters,
    });
    expect(tool).toBeDefined();
    expect(tool.info).toBeDefined();
    expect(tool.info.tools).toBeDefined();
    expect(tool.info.tools?.length).toBe(10);
    expect(tool.client).toBeDefined();
    expect(tool.transport).toBeDefined();
    tool.client.close();
    tool.transport.close();
  });

  it("should expand env vars", async () => {
    const tool: InitializedTool = await createTool({
      toolServer: config["server-filesystem"] as StdioServerParameters,
    });
    expect(tool).toBeDefined();
    expect(tool.info).toBeDefined();
    expect(tool.info.tools).toBeDefined();
    expect(tool.info.tools?.length).toBe(14);
    expect(tool.client).toBeDefined();
    expect(tool.transport).toBeDefined();
    tool.client.close();
    tool.transport.close();
  });
});
