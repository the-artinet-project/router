import {
  CallToolResult,
  CompatibilityCallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { assert } from "console";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  getParts,
  Message,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
} from "@artinet/sdk";
import {
  AgentResponse,
  ConnectResponse,
  ToolResponse,
  AgentRequest,
  ToolRequest,
  SessionMessage,
  ToolResponseSchema,
} from "@artinet/types";
import { logger } from "~/utils/logger.js";
import { safeParse } from "~/utils/parse.js";
import { ToolManager } from "~/tools/index.js";
import { AgentManager } from "~/agents/index.js";
import { SessionManager } from "./session.js";
import pLimit from "p-limit";
export async function callTools(
  toolManager: ToolManager,
  toolRequests: ToolRequest[],
  callbackFunction: (response: ToolResponse) => void = console.log
): Promise<ToolResponse[]> {
  if (toolRequests.length === 0) {
    return [];
  }
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
              ], //todo need to bubble this error up
            } as CallToolResult;
          });
        assert(toolResponse, "Tool response is undefined");
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

export async function callAgents(
  agentManager: AgentManager,
  agentRequests: AgentRequest[],
  taskId: string,
  iterations: number,
  callbackFunction: (
    response: AgentResponse | ToolResponse
  ) => void = console.log
): Promise<AgentResponse[]> {
  if (agentRequests.length === 0) {
    return [];
  }
  let agentResponses: AgentResponse[] = [];
  const limit = pLimit(10);
  await Promise.all(
    agentRequests.map((agentRequest) =>
      limit(async () => {
        const agentStream = agentManager
          .getAgent(agentRequest.uri)
          ?.streamMessage({
            message: {
              kind: "message",
              role: "user",
              messageId: uuidv4(),
              taskId: taskId,
              contextId: uuidv4(),
              parts: [{ kind: "text", text: agentRequest.directive }],
            },
          });
        if (!agentStream) {
          logger.error(
            "no response from agent[agent:" +
              agentRequest.uri +
              "][task:" +
              taskId +
              "][" +
              iterations +
              "]: ",
            agentRequest.uri
          );
          callbackFunction({
            kind: "agent_response",
            uri: agentRequest.uri,
            directive: agentRequest.directive,
            result: "no response",
          });
          return;
        }
        try {
          let finalResponse: AgentResponse | undefined = undefined;
          //todo transition to context events instead of stream updates
          for await (const agentCallResponse of agentStream) {
            if (!agentCallResponse) {
              logger.error(
                "no agent call response[task:" +
                  taskId +
                  "][" +
                  iterations +
                  "]: ",
                agentRequest.uri
              );
              continue;
            }
            assert(agentCallResponse, "Agent response is undefined");
            if (agentCallResponse) {
              if (agentCallResponse.kind === "task") {
                //ignoring tasks to avoid double messages
                continue;
              }
              const parts = getParts(
                (agentCallResponse as Message)?.parts ??
                  // (agentCallResponse as Task)?.status?.message?.parts ?? //ignoring tasks to avoid double messages
                  (agentCallResponse as TaskStatusUpdateEvent)?.status?.message
                    ?.parts ??
                  (agentCallResponse as TaskArtifactUpdateEvent)?.artifact
                    ?.parts ??
                  []
              );
              const content =
                parts.text ??
                parts.file.map((file) => file.bytes).join("\n") ??
                parts.data.map((data) => JSON.stringify(data)).join("\n") ??
                "";
              if (content.includes("tool_response")) {
                const parseResult: z.SafeParseReturnType<
                  ToolResponse,
                  ToolResponse
                > = safeParse(content, ToolResponseSchema);
                if (parseResult.success) {
                  const mcpArgs: ToolResponse = parseResult.data;
                  mcpArgs.name =
                    " 📨 " + agentRequest.uri + " 🔧 " + mcpArgs.name; //indicator that this is subagent calling the tool
                  callbackFunction(mcpArgs);
                }
              } else if (
                content !== "" &&
                content !== "{}" &&
                content !== "[]"
              ) {
                //todo check for final flag in agentCallResponse (TaskStatusUpdateEvent)
                const callAgentResponse: AgentResponse = {
                  kind: "agent_response",
                  uri: agentRequest.uri,
                  directive: (agentCallResponse as TaskStatusUpdateEvent)?.final
                    ? agentRequest.directive
                    : "",
                  result: content,
                };
                finalResponse = callAgentResponse;
                callbackFunction(callAgentResponse);
              }
            }
            //to buffer the yielding of updates
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
          if (finalResponse) {
            //we only add the final response of each agent request to the list of responses
            agentResponses.push(finalResponse);
          }
        } catch (error) {
          logger.error(
            "error calling agent[agent:" +
              agentRequest.uri +
              "][task:" +
              taskId +
              "][" +
              iterations +
              "]: ",
            error
          );
          callbackFunction({
            kind: "agent_response",
            uri: agentRequest.uri,
            directive: agentRequest.directive,
            result:
              error instanceof Error ? error.message : JSON.stringify(error),
          });
        }
        return;
      })
    )
  );
  return agentResponses;
}

export async function executeTask(
  sessionManager: SessionManager,
  toolManager: ToolManager,
  agentManager: AgentManager,
  taskId: string = uuidv4(),
  callbackFunction: (
    response: string | ToolResponse | AgentResponse
  ) => void = console.log,
  abortController: AbortController = new AbortController()
): Promise<string> {
  if (!sessionManager.Initialized) {
    throw new Error("Session is not initialized");
  }

  let requestCount = 0;
  const MAX_ITERATIONS = 10;
  let iterations = 0;
  let response: ConnectResponse;
  let toolResponses: ToolResponse[] = [];
  let agentResponses: AgentResponse[] = [];
  do {
    const message: SessionMessage | undefined =
      iterations >= MAX_ITERATIONS - 1
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
    //update request count
    requestCount =
      (response.options?.tools?.requests?.length ?? 0) +
      (response.options?.agents?.requests?.length ?? 0);

    //call tools
    const latestToolResponses: ToolResponse[] = await callTools(
      toolManager,
      response.options?.tools?.requests ?? [],
      callbackFunction
    ).catch((error) => {
      logger.error(
        "error calling tools[task:" + taskId + "][" + iterations + "]: ",
        error
      );
      return [];
    });
    toolResponses = [...toolResponses, ...latestToolResponses];

    //call agents
    const latestAgentResponses: AgentResponse[] = await callAgents(
      agentManager,
      response.options?.agents?.requests ?? [],
      taskId,
      iterations,
      callbackFunction
    ).catch((error) => {
      logger.error(
        "error calling agents[task:" + taskId + "][" + iterations + "]: ",
        error
      );
      return [];
    });
    agentResponses = [...agentResponses, ...latestAgentResponses];

    //update iterations
    iterations++;
    if (abortController.signal.aborted) {
      callbackFunction("Abort Requested");
    }
  } while (
    requestCount > 0 &&
    response &&
    iterations < MAX_ITERATIONS &&
    !abortController.signal.aborted
  );
  return sessionManager.Response;
}
