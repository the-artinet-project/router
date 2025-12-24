/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  A2A,
  Agent as A2Agent,
  A2AClient,
  createMessageSendParams,
} from "@artinet/sdk";
import { Runtime } from "@artinet/types";
import * as Callable from "./types.js";
import { v4 as uuidv4 } from "uuid";

const _session = (
  uri: string,
  parentTaskId: string,
  tasks: Record<string, Record<string, string>>,
  callParams: A2A.MessageSendParams
) => {
  if (!tasks[parentTaskId][uri]) {
    tasks[parentTaskId][uri] = callParams.message.taskId ?? uuidv4();
  }
  callParams.message.taskId = tasks[parentTaskId][uri];
  callParams.message.referenceTaskIds =
    Object.values(tasks[parentTaskId]) ?? callParams.message.referenceTaskIds;
};

const _response = (
  request: Runtime.AgentRequest,
  result: A2A.SendMessageSuccessResult | undefined | null,
  error: Error | undefined
): Runtime.AgentResponse => {
  return {
    callerId: request.callerId ?? "unknown",
    kind: "agent_response",
    uri: request.uri,
    call: request.call,
    result: result ?? error?.message ?? "unknown error",
    error: error,
    id: request.id ?? uuidv4(),
  };
};

export async function callAgent(
  agent: A2Agent | A2AClient,
  uri: string,
  request: Runtime.AgentRequest,
  options: Callable.Options
): Promise<Runtime.AgentResponse> {
  let _error: Error | undefined = undefined;

  const callParams: A2A.MessageSendParams =
    typeof request.call === "string"
      ? createMessageSendParams(request.call)
      : createMessageSendParams({ message: request.call });

  _session(uri, options.parentTaskId, options.tasks, callParams);

  const result: A2A.SendMessageSuccessResult | undefined | null = await agent
    .sendMessage(callParams, undefined, {
      abortSignal: options.abortSignal,
    })
    .catch((error) => {
      _error = error as Error;
      return undefined;
    });

  return _response(request, result, _error);
}
