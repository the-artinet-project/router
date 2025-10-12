/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  ConnectRequest,
  ConnectResponse,
  ConnectResponseSchema,
} from "@artinet/types";
import { safeParse } from "../utils/parse.js";
import { logger } from "../utils/logger.js";

export async function connectv1(
  props: ConnectRequest,
  abortSignal?: AbortSignal
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
        signal: abortSignal,
      }
    );
    // logger.log("connectv1: ", "restResponse: ", restResponse);
    if (!restResponse.ok) {
      throw new Error(
        "Failed to fetch agent response: " +
          restResponse.statusText +
          " " +
          restResponse.status +
          " " +
          (JSON.stringify(await restResponse.json()) ?? "")
      );
    }

    const responseJson = await restResponse.json();
    return safeParse(responseJson.body, ConnectResponseSchema).data; //todo use TRPC
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
