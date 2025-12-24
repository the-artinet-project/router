/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { API } from "@artinet/types";
import { logger, safeParse, safeParseSchema } from "@artinet/sdk";
import { APIProvider } from "../model-util.js";

const PROVIDER_URL =
  process.env.ARTINET_API_URL ?? "https://api.stage.artinet.io/v1/connect";

export const artinetProvider: APIProvider = async (
  request: API.ConnectRequest,
  abortSignal?: AbortSignal,
  headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Credentials": "true",
  }
): Promise<API.ConnectResponse> => {
  const restResponse = await fetch(PROVIDER_URL, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(request),
    signal: abortSignal,
  });
  if (!restResponse.ok) {
    const text = await restResponse.text();
    const error = new Error(
      `Failed to fetch agent response: ${restResponse.statusText} ${
        restResponse.status
      } ${text ?? ""}`
    );
    logger.error(
      `[${request.identifier}:${request.preferredEndpoint}]: ${error.message}`,
      error
    );
    throw error;
  }
  const text = await restResponse.text();
  const json = safeParse(text).data ?? {};
  return await safeParseSchema(json?.body, API.ConnectResponseSchema);
};
