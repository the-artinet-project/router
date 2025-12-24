/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Runtime } from "@artinet/types";
import { core } from "@artinet/sdk";

export const DEFAULT_CONCURRENCY = process.env.DEFAULT_CONCURRENCY
  ? parseInt(process.env.DEFAULT_CONCURRENCY)
  : 10;
export const DEFAULT_ITERATIONS = process.env.DEFAULT_ITERATIONS
  ? parseInt(process.env.DEFAULT_ITERATIONS)
  : 10;

//Callables are a derived type of services that can be executed dynamically.
export type Type = Runtime.AgentCall | Runtime.ToolCall;
interface Bundle<Call extends Type, Options extends object> {
  call: Call;
  request: Call extends Runtime.AgentCall
    ? Runtime.AgentRequest
    : Runtime.ToolRequest;
  options: Options;
  response: Call extends Runtime.AgentCall
    ? Runtime.AgentResponse
    : Runtime.ToolResponse;
  info: Call extends Runtime.AgentCall ? Runtime.AgentInfo : Runtime.ToolInfo;
  target: Call extends Runtime.AgentCall
    ? Runtime.AgentService
    : Runtime.ToolService;
}

export interface Options {
  parentTaskId: string;
  tasks: Record<string, Record<string, string>>;
  iterations?: number;
  abortSignal?: AbortSignal;
  callback?: (response: Response) => void;
}

export interface Instance<Call extends Type, Options extends object>
  extends core.Service<
    {
      request: Bundle<Call, Options>["request"];
      options: Bundle<Call, Options>["options"];
    },
    Bundle<Call, Options>["response"]
  > {
  uri: string;
  readonly kind: Call extends Runtime.AgentCall ? "agent" : "tool";
  info: Bundle<Call, Options>["info"] | undefined;
  getInfo(): Promise<Bundle<Call, Options>["info"]>;
  getTarget(): Promise<Bundle<Call, Options>["target"]>;
}

export interface Agent extends Instance<Runtime.AgentCall, Options> {}
export interface Tool extends Instance<Runtime.ToolCall, Options> {}
export type Request = Runtime.AgentRequest | Runtime.ToolRequest;
export type Response = Runtime.AgentResponse | Runtime.ToolResponse;
