import {
  ConnectRequest,
  ConnectResponse,
  ConnectResponseSchema,
  ConnectResponseOptions,
  ToolRequest,
  AgentRequest,
  AgentResponse,
  ToolResponse,
} from "@artinet/types";
import { logger } from "../src/utils/logger";
import { safeParseJSON, safeParse } from "../src/utils/parse";
import { ApiProvider } from "../src";

export const MOCK_RESPONSE_OPTIONS = (
  toolRequests: ToolRequest[] = [],
  agentRequests: AgentRequest[] = [],
  toolResults: ToolResponse[] = [],
  agentResponses: AgentResponse[] = []
): ConnectResponseOptions => {
  return {
    tools: {
      requests: toolRequests,
      results: toolResults,
    },
    agents: {
      requests: agentRequests,
      responses: agentResponses,
    },
  };
};

export const MOCK_CONNECT_RESPONSE = (
  response: string,
  options: ConnectResponseOptions = MOCK_RESPONSE_OPTIONS()
): ConnectResponse => {
  return {
    agentResponse: JSON.stringify([
      {
        generated_text: response,
      },
    ]),
    timestamp: new Date().toISOString(),
    options: options,
  };
};

export async function MOCK_CONNECT(
  props: ConnectRequest,
  abortSignal?: AbortSignal,
  mockResponse?: ConnectResponse
): Promise<ConnectResponse> {
  if (mockResponse) return mockResponse;
  try {
    const restResponse = await fetch(
      "https://api.stage.artinet.io/v1/connect",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          ...props,
        }),
        signal: abortSignal,
      }
    );
    // logger.log("connectv1: ", "restResponse: ", restResponse);
    if (!restResponse.ok) {
      const text = await restResponse.text();
      throw new Error(
        "Failed to fetch agent response: " +
          restResponse.statusText +
          " " +
          restResponse.status +
          " " +
          (text ?? "")
      );
    }
    const text = await restResponse.text();
    const json = safeParseJSON(text).data ?? {};
    return (
      safeParse(json?.body, ConnectResponseSchema).data ?? {
        agentResponse: text,
        timestamp: new Date().toISOString(),
        error: "connectv1: failed to parse response: " + text,
        options: {},
      }
    );
  } catch (error: any) {
    logger.error("connectv1: ", "Error connecting to api:", error);
    return {
      agentResponse: JSON.stringify(
        [
          {
            generated_text:
              error instanceof Error ? error.message : JSON.stringify(error),
          },
        ],
        null,
        2
      ), //`Client error: Unfortunately, this agent is currently experiencing issues. Please try again later.`,
      timestamp: new Date().toISOString(),
      error: error,
      options: {},
    };
  }
}

export const MOCK_PROVIDER = (mockResponse: ConnectResponse): ApiProvider => {
  return (request: ConnectRequest, abortSignal?: AbortSignal) =>
    MOCK_CONNECT(request, abortSignal, mockResponse);
};

export function createMockProvider(
  responseMessage: string,
  toolRequests: ToolRequest[] = [],
  agentRequests: AgentRequest[] = []
): ApiProvider {
  const apiProvider: ApiProvider = MOCK_PROVIDER(
    MOCK_CONNECT_RESPONSE(
      responseMessage,
      MOCK_RESPONSE_OPTIONS(toolRequests, agentRequests)
    )
  );
  return apiProvider;
}
