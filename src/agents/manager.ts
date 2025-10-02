import { IAgentManager } from "../types/index.js";
import { Agent } from "@artinet/sdk";

export class AgentManager implements IAgentManager {
  private agents: Map<string, Agent> = new Map();
  constructor(agents: Map<string, Agent> = new Map()) {
    this.agents = agents;
  }
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }
  setAgent(agent: Agent): void {
    this.agents.set(agent.agentCard.name, agent);
  }
  deleteAgent(id: string): void {
    this.agents.delete(id);
  }
  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  getAgentCount(): number {
    return this.agents.size;
  }
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }
  async close(): Promise<void> {
    await Promise.all(
      Array.from(this.agents.values()).map(async (agent) => {
        await agent.stop();
      })
    );
  }
}
