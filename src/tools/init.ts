/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: GPL-3.0-only
 */
import {
  Client,
  ClientOptions,
} from "@modelcontextprotocol/sdk/client/index.js";
import {
  Implementation,
  ServerCapabilities,
  ListToolsResult,
  ListResourcesResult,
  Tool,
  Resource,
  Prompt,
  ListPromptsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  StdioClientTransport,
  StdioServerParameters,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { v4 as uuidv4 } from "uuid";
import { ToolInfo } from "@artinet/types";
import { logger } from "../utils/logger.js";
import { InitializedTool } from "../types/index.js";

export async function initClient(
  implementation: Implementation = {
    name: "MCP Client",
    version: "1.0.0",
    title: "Default MCP Client",
  },
  options: ClientOptions,
  transport: Transport
): Promise<Client> {
  const client = new Client(implementation, options);
  await client.connect(transport);
  return client;
}

export interface createToolParams {
  toolServer: StdioServerParameters;
  implementation?: Implementation;
  options?: ClientOptions;
  transport?: Transport;
}

export async function createTool(
  params: createToolParams
): Promise<InitializedTool> {
  const transport =
    params.transport ||
    new StdioClientTransport({
      ...params.toolServer,
      stderr: params.toolServer.stderr ?? "pipe",
    });
  const client: Client | undefined = await initClient(
    params.implementation || { name: uuidv4(), version: "1.0.0" },
    params.options || {},
    transport
  ).catch((error) => {
    logger.error(
      "createTool: error creating tool[",
      params.toolServer.command,
      "]: ",
      error
    );
    return undefined;
  });
  (transport as StdioClientTransport)?.stderr?.on("data", (data) => {
    logger.warn("stderr: ", data.toString());
  });
  if (!client) {
    throw new Error(
      "createTool: failed to create tool[" +
        params.toolServer.command +
        "]: Client not found"
    );
  }
  const info: ToolInfo | undefined = await getToolInfo(client).catch(
    (error) => {
      logger.error(
        "createTool: error retrieving mcp info[",
        params.toolServer.command,
        "]: ",
        error
      );
      return undefined;
    }
  );
  if (!info) {
    throw new Error(
      "createTool: failed to retrieve tool info[" +
        params.toolServer.command +
        "]: undefined"
    );
  }
  const initializedTool: InitializedTool = {
    client,
    transport,
    info,
  };
  return initializedTool;
}

function getCapabilities(client: Client): ServerCapabilities {
  const serverCapabilities: ServerCapabilities | undefined =
    client.getServerCapabilities();
  if (!serverCapabilities) {
    throw new Error("getCapabilities: Server capabilities not found");
  }
  if (!serverCapabilities.tools || serverCapabilities.tools.length === 0) {
    throw new Error("getCapabilities: Server tools not found");
  }
  return serverCapabilities;
}

function getImplementation(client: Client): Implementation {
  const implementation: Implementation | undefined = client.getServerVersion();
  if (!implementation) {
    throw new Error("getImplementation: Server version not found");
  }
  return implementation;
}

function getInstructions(client: Client): string | undefined {
  const instructions: string | undefined = client.getInstructions();
  if (!instructions) {
    logger.warn("getInstructions: Server instructions not found");
  }
  return instructions;
}

async function getTools(client: Client): Promise<Tool[]> {
  let nextCursor: string | undefined = undefined;
  const tools: Tool[] = [];
  do {
    const toolResults: ListToolsResult = await client
      .listTools({
        cursor: nextCursor,
      })
      .catch((error) => {
        logger.error("getTools: error listing tools: ", error);
        return {
          tools: [],
          nextCursor: undefined,
        };
      });
    tools.push(...toolResults.tools);
    nextCursor = toolResults.nextCursor;
  } while (nextCursor);

  if (!tools || tools.length === 0) {
    throw new Error("getTools: Server tools not found");
  }
  return tools;
}

async function getResources(client: Client): Promise<Resource[]> {
  let nextCursor: string | undefined = undefined;
  const resources: Resource[] = [];
  nextCursor = undefined;
  do {
    const resourceResults: ListResourcesResult = await client
      .listResources({
        cursor: nextCursor,
      })
      .catch((error) => {
        logger.error("getResources: error listing resources: ", error);
        return {
          resources: [],
          nextCursor: undefined,
        };
      });
    resources.push(...resourceResults.resources);
    nextCursor = resourceResults.nextCursor;
  } while (nextCursor);
  if (!resources || resources.length === 0) {
    logger.warn("getResources: Server resources not found");
  }
  return resources;
}

async function getPrompts(client: Client): Promise<Prompt[]> {
  let nextCursor: string | undefined = undefined;
  const prompts: Prompt[] = [];
  do {
    const promptResults: ListPromptsResult = await client
      .listPrompts({
        cursor: nextCursor,
      })
      .catch((error) => {
        logger.error("getPrompts: error listing prompts: ", error);
        return {
          prompts: [],
          nextCursor: undefined,
        };
      });
    prompts.push(...promptResults.prompts);
    nextCursor = promptResults.nextCursor;
  } while (nextCursor);
  if (!prompts || prompts.length === 0) {
    logger.warn("getPrompts: Server prompts not found");
  }
  return prompts;
}

export async function getToolInfo(client: Client): Promise<ToolInfo> {
  if (!client) {
    throw new Error("retrieveMCPInfo: Client not found");
  }

  const serverCapabilities: ServerCapabilities = getCapabilities(client);

  const implementation: Implementation = getImplementation(client);
  // get all tools
  let tools: Tool[] = [];
  if (serverCapabilities.tools) {
    tools = await getTools(client);
  }

  // get all resources
  let resources: Resource[] = [];
  if (serverCapabilities.resources) {
    resources = await getResources(client);
  }

  // get all prompts
  let prompts: Prompt[] = [];
  if (serverCapabilities.prompts) {
    prompts = await getPrompts(client);
  }

  const instructions: string | undefined = getInstructions(client);
  const toolInfo: ToolInfo = {
    implementation: implementation,
    serverCapabilities,
    tools,
    resources,
    prompts,
    instructions,
  };
  return toolInfo;
}
