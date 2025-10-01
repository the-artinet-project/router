import {
  ConnectRequest,
  ConnectResponse,
  ConnectResponseSchema,
} from "@artinet/types";
import { safeParse } from "~/utils/parse.js";
import { logger } from "~/utils/logger.js";

export async function connectv1(
  props: ConnectRequest
): Promise<ConnectResponse> {
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
      }
    );
    logger.log("fetchAgentResponse: ", "restResponse: ", restResponse);
    if (!restResponse.ok) {
      throw new Error(
        "Failed to fetch agent response: " + restResponse.statusText
      );
    }

    const bodyJson = await restResponse.json();
    logger.log("fetchAgentResponse: ", "bodyJson: ", bodyJson);
    return safeParse(bodyJson.body, ConnectResponseSchema).data; //todo use TRPC
  } catch (error: any) {
    logger.error(
      "fetchAgentResponse: ",
      "Error fetching agent response:",
      error
    );
    return {
      agentResponse: JSON.stringify(
        [
          {
            generated_text: error,
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
