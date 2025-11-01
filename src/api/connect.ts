/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  ConnectRequest,
  ConnectResponse,
  ConnectResponseSchema,
} from "@artinet/types";
import { safeParse, safeParseJSON } from "../utils/parse.js";
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
