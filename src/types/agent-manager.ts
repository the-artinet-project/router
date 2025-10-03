/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Agent } from "@artinet/sdk";

export interface IAgentManager {
  getAgent(id: string): Agent | undefined;
  setAgent(agent: Agent): void;
  deleteAgent(id: string): void;
  getAgents(): Agent[];
  getAgentCount(): number;
  getAgentIds(): string[];
}
