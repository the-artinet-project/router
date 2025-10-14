/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { A2AServiceInterface, Message, Task } from "@artinet/sdk";
import {
  AgentResponse,
  ToolResponse,
  AgentRequest,
  ToolResponseSchema,
} from "@artinet/types";
import { TaskOptions } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { getContent } from "../utils/get-content.js";
import { safeParse } from "../utils/parse.js";
import { AgentManager } from "../agents/index.js";
import pLimit from "p-limit";
import { SubSession } from "../types/index.js";

export type AgentOptions = Required<Pick<TaskOptions, "taskId">> & {
  abortSignal?: AbortSignal | undefined;
};

export async function callAgent(
  agent: A2AServiceInterface,
  agentRequest: AgentRequest,
  options: AgentOptions
): Promise<AgentResponse | ToolResponse> {
  const { taskId, abortSignal } = options;
  const agentReply: Message | Task | undefined = await agent.sendMessage(
    {
      message: {
        kind: "message",
        role: "user",
        messageId: uuidv4(),
        taskId: taskId,
        contextId: uuidv4(),
        parts: [{ kind: "text", text: agentRequest.directive }],
      },
    },
    {
      signal: abortSignal,
    }
  );

  if (!agentReply) {
    throw new Error("no response from agent");
  }

  const content = getContent(agentReply) ?? "";
  //we'll keep this for now but we shouldn't recieve a tool response as a final response from an agent
  if (content.includes("tool_response")) {
    const parseResult: z.SafeParseReturnType<ToolResponse, ToolResponse> =
      safeParse(content, ToolResponseSchema);
    if (parseResult.success) {
      const mcpArgs: ToolResponse = parseResult.data;
      mcpArgs.name = `📨 ${agentRequest.uri} 🔧 ${mcpArgs.name}`; //indicator that this is subagent calling the tool
      return mcpArgs;
    }
  } else if (content !== "" && content !== "{}" && content !== "[]") {
    const callAgentResponse: AgentResponse = {
      kind: "agent_response",
      uri: agentRequest.uri,
      directive: agentRequest.directive,
      result: content,
      id: agentRequest.id ?? taskId,
    };
    return callAgentResponse;
  }
  throw new Error("no content detected");
}

/**
 * Calls agents and returns the responses.
 * @returns The agent responses.
 */
export async function callAgents(
  agentManager: AgentManager,
  agentRequests: AgentRequest[],
  options: Required<Pick<TaskOptions, "taskId" | "callbackFunction">> & {
    abortSignal?: AbortSignal | undefined;
  },
  subSessions?: Record<string, SubSession>
): Promise<AgentResponse[]> {
  if (agentRequests.length === 0) {
    return [];
  }
  const { taskId: parentTaskId, callbackFunction } = options;
  let agentResponses: AgentResponse[] = [];
  const limit = pLimit(10);
  await Promise.all(
    agentRequests.map((agentRequest) =>
      limit(async () => {
        const agent = agentManager.getAgent(agentRequest.uri);
        if (!agent) {
          logger.error(
            `agent not found[agent:${agentRequest.uri}][parent-task:${parentTaskId}]`
          );
          return;
        }
        const agentReply: AgentResponse | ToolResponse | undefined =
          await callAgent(agent, agentRequest, {
            ...options,
            //each agent-call should have a unique taskId to avoid conflicts
            taskId: subSessions?.[agentRequest.uri]?.taskId ?? uuidv4(),
          }).catch((error) => {
            logger.error(
              `error calling agent[agent:${agentRequest.uri}][parent-task:${parentTaskId}]: `,
              error instanceof Error ? error.message : JSON.stringify(error)
            );
            return undefined;
          });
        if (!agentReply) {
          logger.error(
            `no response from agent[agent:${agentRequest.uri}][parent-task:${parentTaskId}]: `,
            agentReply
          );
          return;
        }
        if (agentReply.kind === "agent_response") {
          callbackFunction(agentReply);
          agentResponses.push(agentReply as AgentResponse);
        }
        return;
      })
    )
  );
  return agentResponses;
}
