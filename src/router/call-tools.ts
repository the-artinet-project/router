/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  CallToolResult,
  CompatibilityCallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { ToolResponse, ToolRequest } from "@artinet/types";
import { TaskOptions } from "../types/index.js";
import { ToolManager } from "../tools/index.js";
import pLimit from "p-limit";
import { logger } from "../utils/logger.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type ToolOptions = Required<Pick<TaskOptions, "callbackFunction">>;

function createStderrMonitor(
  toolRequest: ToolRequest,
  options: ToolOptions
): (data: Buffer) => void {
  const request = toolRequest.callToolRequest;
  const requestParams = request.params;
  const toolName = requestParams.name;
  const { callbackFunction } = options;
  return (data: Buffer) => {
    callbackFunction({
      kind: "tool_response",
      name: toolName,
      id: toolRequest.id,
      callToolRequest: request,
      callToolResult: {
        content: [{ type: "text", text: data.toString() }],
      },
    });
    logger.warn("callTools: stderr: ", data.toString());
  };
}
/**
 * Calls tools and returns the responses.
 * @returns The tool responses.
 */
export async function callTools(
  toolManager: ToolManager,
  toolRequests: ToolRequest[],
  options: ToolOptions
): Promise<ToolResponse[]> {
  if (toolRequests.length === 0) {
    return [];
  }
  const { callbackFunction } = options;
  let toolResponses: ToolResponse[] = [];
  const limit = pLimit(10);
  await Promise.all(
    toolRequests.map((toolRequest) =>
      limit(async () => {
        const tool = toolManager.getTool(toolRequest.id);
        if (!tool) {
          logger.error(
            "callTools: tool not found[tool:" + toolRequest.id + "]"
          );
          return;
        }
        const request = toolRequest.callToolRequest;
        const requestParams = request.params;
        const toolName = requestParams.name;
        //monitor the error stream
        const errStreamCallback = createStderrMonitor(toolRequest, options);
        try {
          (tool.transport as StdioClientTransport)?.stderr?.on(
            "data",
            errStreamCallback
          );
          const toolResponse:
            | CompatibilityCallToolResult
            | CallToolResult
            | undefined = await tool.client
            ?.callTool(requestParams)
            .catch((error) => {
              return {
                content: [
                  {
                    type: "text",
                    text:
                      error instanceof Error
                        ? error.message
                        : JSON.stringify(error),
                  },
                ],
              } as CallToolResult;
            });
          if (toolResponse) {
            const toolResponseArgs: ToolResponse = {
              kind: "tool_response",
              name: toolName,
              id: toolRequest.id,
              callToolRequest: request,
              callToolResult: toolResponse as CallToolResult,
            };
            callbackFunction(toolResponseArgs);
            toolResponses.push(toolResponseArgs);
          }
        } catch (error) {
          logger.error(
            "error calling tool[tool:" + toolRequest.id + "]: ",
            error
          );
        } finally {
          (tool.transport as StdioClientTransport)?.stderr?.off(
            "data",
            errStreamCallback
          );
        }
        return;
      })
    )
  );
  return toolResponses;
}
