/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { ConnectRequest, ConnectResponse } from "@artinet/types";
import { ISessionManager } from "./session.js";
export type ApiProvider = (
  connectRequest: ConnectRequest,
  abortSignal?: AbortSignal
) => Promise<ConnectResponse>;

export interface RouterRequest
  extends Partial<Omit<ConnectRequest, "options" | "session">> {
  session: ConnectRequest["session"];
  options?: Omit<ConnectRequest["options"], "tools" | "agents">;
  apiProvider?: ApiProvider;
}

export interface TaskOptions {
  taskId?: string;
  maxIterations?: number;
  callbackFunction?: (...args: any[]) => void;
  abortSignal?: AbortSignal | undefined;
  sessionManager?: ISessionManager;
}

export interface RouterParams {
  message: string | RouterRequest;
  tools?: string[];
  agents?: string[];
  options?: Omit<TaskOptions, "callbackFunction">;
}

export interface IRouter {
  connect(params: RouterParams): Promise<string>;
  close(): Promise<void>;
}
