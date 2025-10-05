/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { LocalServerConfig, RemoteServerConfig, Config } from "@artinet/types";

export function sortServersWithName(config: Config): {
  stdioServers: Record<string, LocalServerConfig>;
  webServers: Record<string, RemoteServerConfig>;
} {
  let stdioServers: Record<string, LocalServerConfig> = {};
  let webServers: Record<string, RemoteServerConfig> = {};
  for (const server of Object.entries(config)) {
    if (
      (server[1] as LocalServerConfig).command &&
      (server[1] as LocalServerConfig).args
    ) {
      stdioServers[server[0]] = server[1] as LocalServerConfig;
    } else if ((server[1] as RemoteServerConfig).url) {
      webServers[server[0]] = server[1] as RemoteServerConfig;
    }
  }
  return {
    stdioServers,
    webServers,
  };
}

export function sortServers(config: Config): {
  stdioServers: LocalServerConfig[];
  webServers: RemoteServerConfig[];
} {
  let stdioServers: LocalServerConfig[] = [];
  let webServers: RemoteServerConfig[] = [];
  for (const server of Object.values(config)) {
    if (
      (server as LocalServerConfig).command &&
      (server as LocalServerConfig).args
    ) {
      stdioServers.push(server as LocalServerConfig);
    } else if ((server as RemoteServerConfig).url) {
      webServers.push(server as RemoteServerConfig);
    }
  }
  return {
    stdioServers,
    webServers,
  };
}
