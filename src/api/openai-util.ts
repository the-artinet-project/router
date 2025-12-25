/**
 * @fileoverview
 * OpenAI adapter for the Artinet Orchestrator.
 *
 * Provides bidirectional conversion between OpenAI Chat Completion types
 * and Artinet Connect request/response types, enabling seamless integration
 * with OpenAI-compatible backends.
 *
 * @module api/openai-util
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import openai from "openai";
import { API, Runtime } from "@artinet/types";
import { getContent, formatJson, logger, safeParse } from "@artinet/sdk";
import z, { toJSONSchema } from "zod/v4";
import * as Callables from "../types.js";
/**
 * Converts an Artinet message role to OpenAI role.
 * Artinet roles: "user" | "agent" | "assistant" | "system"
 * OpenAI roles: "system" | "user" | "assistant" | "tool" | "developer"
 */
function toOpenAIRole(
  role: API.Message["role"]
): "system" | "user" | "assistant" {
  if (role === "agent" || role === "assistant") return "assistant";
  return role as "system" | "user";
}

/**
 * Extracts string content from an Artinet message.
 */
function extractContent(content: API.Message["content"]): string {
  if (typeof content === "string") return content;
  if (typeof content === "object" && "text" in content) return content.text;
  return "";
}

/**
 * Converts Artinet messages to OpenAI ChatCompletionMessageParam format.
 */
export function toOpenAIMessages(
  messages: API.Message[]
): openai.ChatCompletionMessageParam[] {
  return messages
    .map((msg) => ({
      role: toOpenAIRole(msg.role),
      content: extractContent(msg.content),
    }))
    .filter((msg) => msg.content !== "");
}
const customSeperator = "_-_";
const mcpName = (uri: string, toolName: string): string =>
  `mcp${customSeperator}${uri}${customSeperator}${toolName}`;
const a2aName = (uri: string, agentName: string): string =>
  `a2a${customSeperator}${uri}${customSeperator}${agentName}`;
/**
 * Converts an MCP tool definition to OpenAI function tool format.
 */
export function mcpTools(
  uri: string,
  tool: Runtime.ToolInfo
): openai.ChatCompletionTool[] {
  if (!tool.tools || tool.tools.length === 0) return [];
  return tool.tools.map((tool) => ({
    type: "function",
    function: {
      name: mcpName(uri, tool.name),
      description: tool.description,
      parameters: tool.inputSchema as Record<string, unknown>,
    },
  }));
}

const rootSchema = z
  .object({
    message: z.string(),
  })
  .describe("A2A tool input schema");
const a2aToolSchema = toJSONSchema(rootSchema);

export function a2aTools(
  uri: string,
  agent: Runtime.AgentInfo
): openai.ChatCompletionTool[] {
  if (agent.skills && agent.skills.length > 0) {
    return agent.skills.map((skill) => ({
      type: "function",
      function: {
        name: a2aName(uri, skill.name),
        description: `ask agent ${agent.name} to perform skill ${
          skill.name
        } with description: ${
          skill.description ?? agent.description
        } and the following examples: ${skill.examples?.join(", ")}`,
        parameters: a2aToolSchema,
      },
    }));
  }
  return [
    {
      type: "function",
      function: {
        name: a2aName(uri, agent.name),
        description: `ask agent ${agent.name} with description: ${agent.description} to perform a task`,
        parameters: a2aToolSchema,
      },
    },
  ];
}

/**
 * Converts Artinet ToolService definitions to OpenAI tools.
 * Extracts MCP tools from the service info and converts each to OpenAI format.
 */
export function toOpenAITools(services?: Runtime.Service[]): {
  tools: openai.ChatCompletionTool[];
  uriMap: Map<string, string>;
} {
  if (!services || services.length === 0)
    return { tools: [], uriMap: new Map() };

  const tools: openai.ChatCompletionTool[] = [];
  const uriMap = new Map<string, string>();

  for (const service of services) {
    const shortUri = service.uri.split("-").pop() ?? service.uri;

    uriMap.set(shortUri, service.uri);

    if (service.type === "mcp" && service.info) {
      tools.push(...mcpTools(shortUri, service.info as Runtime.ToolInfo));
    } else if (service.type === "a2a" && service.info) {
      tools.push(...a2aTools(shortUri, service.info));
    }
  }
  return { tools, uriMap };
}

/**
 * Converts an Artinet ToolResponse to OpenAI tool message format.
 */
export function toOpenAIToolMessage(
  response: Callables.Response
): openai.ChatCompletionToolMessageParam {
  if (typeof response.result === "string") {
    return {
      role: "tool",
      tool_call_id: response.id ?? response.callerId ?? "unknown",
      content: response.result,
    };
  } else if (Runtime.isToolResponse(response)) {
    return {
      role: "tool",
      tool_call_id: response.id ?? response.callerId ?? "unknown",
      content: response.result.content?.filter((c) => c.type === "text"),
    };
  } else if (Runtime.isAgentResponse(response)) {
    return {
      role: "tool",
      tool_call_id: response.id ?? response.callerId ?? "unknown",
      content:
        typeof response.result === "string"
          ? response.result
          : getContent(response.result) ?? "",
    };
  }
  throw new Error(`Unsupported response type: ${typeof response}`);
}

/**
 * Converts an OpenAI tool call to Artinet ToolRequest format.
 * Handles both function-based and custom tool calls.
 */
export function toArtinetToolRequest(
  callerId: string = "unknown",
  toolCall: openai.ChatCompletionMessageToolCall,
  uriMap: Map<string, string>
): Callables.Request {
  if (toolCall.type === "function") {
    const call = toolCall as openai.ChatCompletionMessageFunctionToolCall;

    const [_type, uri, name] = call.function.name.split(customSeperator);
    const type = _type === "mcp" ? ("mcp" as const) : ("a2a" as const);

    const args = call.function.arguments;

    if (type === "mcp") {
      const request: Runtime.ToolRequest = {
        kind: "tool_request",
        id: toolCall.id,
        uri: uriMap.get(uri) ?? uri,
        type,
        callerId,
        call: {
          name,
          arguments: safeParse(args),
        },
      };
      return request;
    } else if (type === "a2a") {
      const request: Runtime.AgentRequest = {
        kind: "agent_request",
        id: toolCall.id,
        uri: uriMap.get(uri) ?? uri,
        type,
        callerId,
        call: rootSchema.safeParse(args).data?.message ?? args,
      };
      return request;
    }
  }
  throw new Error(`Unsupported tool call type: ${toolCall.type}`);
}

/**
 * Converts an Artinet ConnectRequest to OpenAI ChatCompletionCreateParams.
 *
 * @param request - The Artinet connect request
 * @returns OpenAI-compatible chat completion parameters
 *
 * @example
 * ```typescript
 * const openaiParams = toOpenAIRequest(connectRequest);
 * const completion = await openai.chat.completions.create(openaiParams);
 * ```
 */
/**
 * Reconstructs an assistant message with tool_calls from Artinet responses.
 * OpenAI requires tool response messages to be preceded by an assistant
 * message containing the corresponding tool_calls.
 */
function reconstructAssistantToolCalls(
  responses: Callables.Response[]
): openai.ChatCompletionAssistantMessageParam | null {
  if (responses.length === 0) return null;

  const toolCalls: openai.ChatCompletionMessageToolCall[] = responses.map(
    (response) => {
      const callId = response.id ?? response.callerId ?? "unknown";

      // Reconstruct the function call from the response
      if (Runtime.isToolResponse(response)) {
        return {
          id: callId,
          type: "function" as const,
          function: {
            name: response.call?.name ?? "unknown",
            arguments: JSON.stringify(response.call?.arguments ?? {}),
          },
        };
      } else if (Runtime.isAgentResponse(response)) {
        // For agent responses, we need to reconstruct the a2a tool call
        const shortUri = response.uri.split("-").pop() ?? response.uri;
        return {
          id: callId,
          type: "function" as const,
          function: {
            name: a2aName(shortUri, ""),
            arguments: JSON.stringify({ message: response.call ?? "" }),
          },
        };
      }

      // Fallback for unknown response types
      throw new Error(`Unsupported response type: ${typeof response}`);
    }
  );

  return {
    role: "assistant",
    content: null,
    tool_calls: toolCalls,
  };
}

export function toOpenAIRequest(request: API.ConnectRequest): {
  params: openai.ChatCompletionCreateParamsNonStreaming;
  uriMap: Map<string, string>;
} {
  const messages: openai.ChatCompletionMessageParam[] = toOpenAIMessages(
    request.messages
  );

  // Collect all responses (tool + agent)
  const allResponses: Callables.Response[] = [
    ...(request.options?.tools?.responses ?? []),
    ...(request.options?.agents?.responses ?? []),
  ];

  // If we have responses, we need to add the assistant message with tool_calls first
  if (allResponses.length > 0) {
    const assistantMessage = reconstructAssistantToolCalls(allResponses);
    if (assistantMessage) {
      messages.push(assistantMessage);
    }

    // Then add the tool response messages
    messages.push(
      ...allResponses.map((response) => toOpenAIToolMessage(response))
    );
  }

  const params: openai.ChatCompletionCreateParamsNonStreaming = {
    model: request.identifier,
    messages,
    stream: false,
  };

  const { tools, uriMap } = toOpenAITools(
    [
      ...(request.options?.tools?.services ?? []),
      ...(request.options?.agents?.services ?? []),
    ].filter((service) => service !== undefined)
  );
  params.tools = tools;
  return { params, uriMap };
}

/**
 * Converts an OpenAI ChatCompletion to Artinet ConnectResponse.
 *
 * @param completion - The OpenAI chat completion response
 * @param toolServiceUri - URI to assign to tool requests (for routing)
 * @returns Artinet-compatible connect response
 *
 * @example
 * ```typescript
 * const completion = await openai.chat.completions.create(params);
 * const response = toArtinetResponse(completion);
 * ```
 */
export function toArtinetResponse(
  completion: openai.ChatCompletion,
  uriMap: Map<string, string>
): API.ConnectResponse {
  const choice = completion.choices[0];
  const message = choice?.message;

  const response: API.ConnectResponse = {
    timestamp: new Date(completion.created * 1000).toISOString(),
    agentResponse: message?.content ?? "",
  };

  if (message?.tool_calls && message.tool_calls.length > 0) {
    const requests: Callables.Request[] = message.tool_calls.map((toolCall) =>
      toArtinetToolRequest(toolCall.id, toolCall, uriMap)
    );

    response.options = {
      tools: {
        requests: requests.filter((request) => request.kind === "tool_request"),
        responses: [],
      },

      agents: {
        requests: requests.filter(
          (request) => request.kind === "agent_request"
        ),
        responses: [],
      },
    };
  }

  logger.debug("Artinet response:", formatJson(response));
  return response;
}
