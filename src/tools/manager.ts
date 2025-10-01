import { InitializedTool, IToolManager } from "~/types/index.js";

export class ToolManager implements IToolManager {
  private tools: Map<string, InitializedTool> = new Map();
  constructor(tools: Map<string, InitializedTool> = new Map()) {
    this.tools = tools;
  }
  getTool(name: string): InitializedTool | undefined {
    return this.tools.get(name);
  }
  setTool(tool: InitializedTool): void {
    this.tools.set(tool.info.implementation.name, tool);
  }
  deleteTool(name: string): void {
    this.tools.delete(name);
  }
  getToolCount(): number {
    return this.tools.size;
  }
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
  getTools(): InitializedTool[] {
    return Array.from(this.tools.values());
  }
  async close(): Promise<void> {
    await Promise.all(
      Array.from(this.tools.values()).map((tool) => {
        tool.client.close();
        tool.transport.close();
      })
    );
  }
}
