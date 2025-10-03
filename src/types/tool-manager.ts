/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { InitializedTool } from "./init-tool.js";

export interface IToolManager {
  getTool(name: string): InitializedTool | undefined;
  setTool(tool: InitializedTool): void;
  deleteTool(name: string): void;
  getToolCount(): number;
  getToolNames(): string[];
  getTools(): InitializedTool[];
}
