/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { LocalTool, ToolServer, ToolService } from "@artinet/types";

export function sortServersWithName(config: Record<string, ToolService>): {
  stdioServers: Record<string, LocalTool>;
  webServers: Record<string, ToolServer>;
} {
  let stdioServers: Record<string, LocalTool> = {};
  let webServers: Record<string, ToolServer> = {};
  for (const server of Object.entries(config)) {
    if ((server[1] as LocalTool).command && (server[1] as LocalTool).args) {
      stdioServers[server[0]] = server[1] as LocalTool;
    } else if ((server[1] as ToolServer).url) {
      webServers[server[0]] = server[1] as ToolServer;
    }
  }
  return {
    stdioServers,
    webServers,
  };
}

export function sortServers(config: Record<string, ToolService>): {
  stdioServers: LocalTool[];
  webServers: ToolServer[];
} {
  let stdioServers: LocalTool[] = [];
  let webServers: ToolServer[] = [];
  for (const server of Object.values(config)) {
    if ((server as LocalTool).command && (server as LocalTool).args) {
      stdioServers.push(server as LocalTool);
    } else if ((server as ToolServer).url) {
      webServers.push(server as ToolServer);
    }
  }
  return {
    stdioServers,
    webServers,
  };
}
