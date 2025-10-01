import { InitializedTool } from "./init-tool.js";

export interface IToolManager {
  getTool(name: string): InitializedTool | undefined;
  setTool(tool: InitializedTool): void;
  deleteTool(name: string): void;
  getToolCount(): number;
  getToolNames(): string[];
  getTools(): InitializedTool[];
}
