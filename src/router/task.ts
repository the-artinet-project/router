/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { v4 as uuidv4 } from "uuid";
import {
  AgentResponse,
  ConnectResponse,
  ToolResponse,
  SessionMessage,
  AgentRequest,
  ToolRequest,
} from "@artinet/types";
import { ISessionManager, TaskOptions } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { ToolManager } from "../tools/index.js";
import { AgentManager } from "../agents/index.js";
import { callAgents } from "./call-agents.js";
import { callTools } from "./call-tools.js";

export const MAX_ITERATIONS = 10;

function createTaskOptions(
  taskOptions: TaskOptions = {},
  sessionManager: ISessionManager
): Required<TaskOptions> {
  return {
    ...taskOptions,
    taskId: taskOptions.taskId ?? uuidv4(),
    maxIterations: taskOptions.maxIterations ?? MAX_ITERATIONS,
    callbackFunction: taskOptions.callbackFunction ?? ((_) => {}),
    abortSignal: taskOptions.abortSignal ?? new AbortController().signal,
    sessionManager: sessionManager,
  };
}
export async function executeTask(
  sessionManager: ISessionManager,
  toolManager: ToolManager,
  agentManager: AgentManager,
  taskOptions: TaskOptions = {}
): Promise<string> {
  if (!sessionManager.Initialized) {
    throw new Error("Session is not initialized");
  }
  const fullTaskOptions: Required<TaskOptions> = createTaskOptions(
    taskOptions,
    sessionManager
  );

  let requestCount = 0;
  let iteration = 0;
  let response: ConnectResponse;
  let toolResponses: ToolResponse[] = [];
  let agentResponses: AgentResponse[] = [];
  do {
    const message: SessionMessage | undefined =
      iteration >= MAX_ITERATIONS - 1
        ? {
            role: "system",
            content: `The assistant has run out of executions for this task and will not be able to continue.
The assistant must now formulate a final response to the user summarising what has been achieved so far and what is left to be done.
In the final response, the assistant will also provide the user with suggestions for next steps and ask them whether they would like to continue.`,
          }
        : undefined;
    response = await sessionManager.sendMessage(
      message,
      toolResponses,
      agentResponses
    );
    const agentRequests: AgentRequest[] =
      response.options?.agents?.requests ?? [];
    const toolRequests: ToolRequest[] = response.options?.tools?.requests ?? [];
    //update request count
    requestCount = (toolRequests.length ?? 0) + (agentRequests.length ?? 0);

    //call tools
    const latestToolResponses: ToolResponse[] = await callTools(
      toolManager,
      toolRequests,
      fullTaskOptions
    ).catch((error) => {
      logger.error(
        `error calling tools[task:${fullTaskOptions.taskId}][${iteration}]: `,
        error
      );
      return [];
    });
    toolResponses = [...toolResponses, ...latestToolResponses];

    //call agents
    const latestAgentResponses: AgentResponse[] = await callAgents(
      agentManager,
      agentRequests,
      fullTaskOptions,
      sessionManager.SubSessions
    ).catch((error) => {
      logger.error(
        `error calling agents[task:${fullTaskOptions.taskId}][${iteration}]: `,
        error
      );
      return [];
    });
    agentResponses = [...agentResponses, ...latestAgentResponses];

    //update iterations
    iteration++;
  } while (
    requestCount > 0 &&
    response &&
    iteration < MAX_ITERATIONS &&
    !fullTaskOptions.abortSignal?.aborted
  );
  return sessionManager.Response;
}
