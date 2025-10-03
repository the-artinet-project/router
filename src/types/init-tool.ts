/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Client } from "@modelcontextprotocol/sdk/client";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ToolInfo } from "@artinet/types";

export interface InitializedTool {
  client: Client;
  transport: Transport;
  info: ToolInfo;
}
