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

/**
 * Calls tools and returns the responses.
 * @returns The tool responses.
 */
export async function callTools(
  toolManager: ToolManager,
  toolRequests: ToolRequest[],
  options: Required<
    Omit<
      TaskOptions,
      "taskId" | "maxIterations" | "respondOnFinalOnly" | "abortSignal"
    >
  >
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
        const toolResponse:
          | CompatibilityCallToolResult
          | CallToolResult
          | undefined = await toolManager
          .getTool(toolRequest.id)
          ?.client.callTool(toolRequest.callToolRequest.params)
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
            name: toolRequest.callToolRequest.params.name,
            id: toolRequest.id,
            callToolRequest: toolRequest.callToolRequest,
            callToolResult: toolResponse as CallToolResult,
          };
          callbackFunction(toolResponseArgs);
          toolResponses.push(toolResponseArgs);
        }
        return;
      })
    )
  );
  return toolResponses;
}
