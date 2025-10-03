/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ConnectRequest } from "@artinet/types";

export interface IRouter {
  connect(
    params: Omit<ConnectRequest, "options"> & {
      options: Omit<ConnectRequest["options"], "tools" | "agents">;
    },
    tools: string[],
    agents: string[],
    callbackFunction: (...args: any[]) => void,
    taskId: string
  ): Promise<string>;
  close(): Promise<void>;
}
