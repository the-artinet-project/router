/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { v4 as uuidv4 } from "uuid";
import { Runtime } from "@artinet/types";
import { MCP, logger, formatError, formatJson } from "@artinet/sdk";
import {
  Client as MCPClient,
  ClientOptions as MCPClientOptions,
} from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Transport as MCPTransport } from "@modelcontextprotocol/sdk/shared/transport.js";
import * as Callable from "./types.js";

export async function initClient(
  transport: MCPTransport,
  uri: string = uuidv4(),
  options?: MCPClientOptions
): Promise<MCPClient> {
  const client = new MCPClient(
    {
      name: uri,
      version: "0.0.1",
    },
    options
  );
  await client.connect(transport);
  return client;
}

function getCapabilities(client: MCPClient): MCP.ServerCapabilities {
  const serverCapabilities: MCP.ServerCapabilities | undefined =
    client.getServerCapabilities();
  if (!serverCapabilities) {
    throw new Error("getCapabilities: Server capabilities not found");
  }
  if (!serverCapabilities.tools) {
    throw new Error("getCapabilities: Server tools not found");
  }
  return serverCapabilities;
}

function getImplementation(client: MCPClient): MCP.Implementation {
  const implementation: MCP.Implementation | undefined =
    client.getServerVersion();
  if (!implementation) {
    throw new Error("getImplementation: Server version not found");
  }
  return implementation;
}

function getInstructions(client: MCPClient): string | undefined {
  const instructions: string | undefined = client.getInstructions();
  if (!instructions) {
    logger.warn("getInstructions: Server instructions not found");
  }
  return instructions;
}

async function getTools(client: MCPClient): Promise<MCP.Tool[]> {
  let nextCursor: string | undefined = undefined;
  const tools: MCP.Tool[] = [];
  do {
    const toolResults: MCP.ListToolsResult = await client
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

async function getResources(client: MCPClient): Promise<MCP.Resource[]> {
  let nextCursor: string | undefined = undefined;
  const resources: MCP.Resource[] = [];
  nextCursor = undefined;
  do {
    const resourceResults: MCP.ListResourcesResult = await client
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

async function getPrompts(client: MCPClient): Promise<MCP.Prompt[]> {
  let nextCursor: string | undefined = undefined;
  const prompts: MCP.Prompt[] = [];
  do {
    const promptResults: MCP.ListPromptsResult = await client
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

export async function getToolInfo(
  client: MCPClient
): Promise<Runtime.ToolInfo> {
  if (!client) {
    throw new Error("retrieveMCPInfo: Client not found");
  }
  const serverCapabilities: MCP.ServerCapabilities = getCapabilities(client);
  const implementation: MCP.Implementation = getImplementation(client);
  // get all tools
  let tools: MCP.Tool[] = [];
  if (serverCapabilities.tools) {
    tools = await getTools(client);
  }

  // get all resources
  let resources: MCP.Resource[] = [];
  if (serverCapabilities.resources) {
    resources = await getResources(client);
  }

  // get all prompts
  let prompts: MCP.Prompt[] = [];
  if (serverCapabilities.prompts) {
    prompts = await getPrompts(client);
  }

  const instructions: string | undefined = getInstructions(client);
  const toolInfo: Runtime.ToolInfo = {
    implementation,
    serverCapabilities,
    tools,
    resources,
    prompts,
    instructions,
  };
  return toolInfo;
}

const toolError = (
  request: Runtime.ToolRequest,
  error: unknown
): MCP.CallToolResult => {
  return {
    content: [
      {
        type: "text",
        text: `[tool:${request.uri}]: error calling tool: \ncall: ${formatJson(
          request.call
        )} \nerror: ${formatError(error)}`,
      },
    ],
  } as MCP.CallToolResult;
};

const _response = (
  uri: string,
  request: Runtime.ToolRequest,
  result:
    | MCP.CompatibilityCallToolResult
    | MCP.CallToolResult
    | undefined
    | null,
  error: Error | undefined
): Runtime.ToolResponse => {
  return {
    callerId: request.callerId ?? "unknown",
    kind: "tool_response",
    uri: uri,
    call: request.call,
    result: (result as MCP.CallToolResult) ?? toolError(request, error),
    error: error,
    id: request.id ?? uuidv4(),
  };
};

const _handler = (
  req: Runtime.ToolRequest,
  cb: Callable.Options["callback"] = (resp: Callable.Response) => {
    logger.warn(`[tool:${resp.uri}]: tool response: ${formatJson(resp)}`);
  }
): ((data: Buffer) => void) => {
  return (data: Buffer) => {
    const resp: Runtime.ToolResponse = {
      call: req.call,
      callerId: req.callerId ?? "unknown",
      uri: req.uri,
      kind: "tool_response",
      result: {
        toolUseId: req.id ?? uuidv4(),
        content: [{ type: "text", text: data.toString() }],
      },
      content: {
        type: "tool_result",
        toolUseId: req.id ?? uuidv4(),
        content: [{ type: "text", text: data.toString() }],
      },
      error: undefined,
      id: req.id ?? uuidv4(),
    };
    cb?.(resp);
  };
};

export async function callTool(
  client: MCPClient,
  uri: string,
  request: Runtime.ToolRequest,
  options: Callable.Options
): Promise<Runtime.ToolResponse> {
  let _error: Error | undefined = undefined;
  const handle = _handler(request, options.callback);

  (client.transport as StdioClientTransport)?.stderr?.on("data", handle);

  const result:
    | MCP.CompatibilityCallToolResult
    | MCP.CallToolResult
    | undefined = await client
    .callTool(request.call, undefined, {
      signal: options.abortSignal,
    })
    .catch((error) => {
      logger.error(`[target:${uri}:${request.id}]: tool error: `, error);
      _error = error as Error;
      return undefined;
    });

  (client.transport as StdioClientTransport)?.stderr?.off("data", handle);
  return _response(uri, request, result, _error);
}
