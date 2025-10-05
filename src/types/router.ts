/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { ConnectRequest } from "@artinet/types";

export interface RouterRequest extends Omit<ConnectRequest, "options"> {
  options?: Omit<ConnectRequest["options"], "tools" | "agents">;
}
export interface RouterParams {
  message: string | RouterRequest;
  tools?: string[];
  agents?: string[];
  callbackFunction?: (...args: any[]) => void;
  taskId?: string;
  abortController?: AbortController;
}
export interface IRouter {
  connect(params: RouterParams): Promise<string>;
  close(): Promise<void>;
}
