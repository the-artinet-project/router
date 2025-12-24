/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Runtime } from "@artinet/types";
import { logger } from "@artinet/sdk";
import * as Callable from "./types.js";

export async function request(
  callable: Callable.Agent | Callable.Tool,
  request: Callable.Request,
  options: Callable.Options
): Promise<Callable.Response | undefined> {
  if (!callable) {
    logger.warn(`[request:target:${request.uri}]: not found.`);
    return undefined;
  }

  const log = logger.child({
    method: "processRequest",
    target: callable.uri,
  });

  let response: Callable.Response | undefined = undefined;
  if (callable.kind === "agent" && Runtime.isAgentRequest(request)) {
    response = await callable.execute({ request, options }).catch((err) => {
      log.error(`error calling agent: `, err);
      return undefined;
    });
  } else if (callable.kind === "tool" && Runtime.isToolRequest(request)) {
    response = await callable.execute({ request, options }).catch((err) => {
      log.error(`error calling tool: `, err);
      return undefined;
    });
  } else {
    log.warn(`invalid request type: ${request.uri}`);
  }
  return response;
}
