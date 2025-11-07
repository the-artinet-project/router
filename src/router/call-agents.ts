/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { v4 as uuidv4 } from "uuid";
import { AgentType } from "@artinet/agent-relay";
import { SendMessageSuccessResult, getContent } from "@artinet/sdk";
import { AgentResponse, ToolResponse, AgentRequest } from "@artinet/types";
import { TaskOptions } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { AgentManager } from "../agents/index.js";
import pLimit from "p-limit";
import { SubSession } from "../types/index.js";

export type AgentOptions = Required<Pick<TaskOptions, "taskId">> & {
  abortSignal?: AbortSignal | undefined;
  referenceTaskIds?: string[];
};

export async function callAgent(
  agent: AgentType,
  agentRequest: AgentRequest,
  options: AgentOptions
): Promise<AgentResponse | ToolResponse> {
  const { taskId, abortSignal, referenceTaskIds } = options;
  const agentReply: SendMessageSuccessResult | null = await agent.sendMessage(
    {
      message: {
        kind: "message",
        role: "user",
        messageId: uuidv4(),
        taskId: taskId,
        referenceTaskIds: referenceTaskIds,
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

  if (content === "" || content === "{}" || content === "[]") {
    throw new Error("no content detected");
  }

  const callAgentResponse: AgentResponse = {
    kind: "agent_response",
    uri: agentRequest.uri,
    directive: agentRequest.directive,
    result: content,
    id: agentRequest.id ?? taskId,
  };
  return callAgentResponse;
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
            referenceTaskIds: [parentTaskId],
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
