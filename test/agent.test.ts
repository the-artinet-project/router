import { jest, describe, afterEach, it, expect } from "@jest/globals";
import { AgentManager } from "../src/index.js";
import { createAgent } from "@artinet/sdk";
import { echoAgentEngine, testAgentCard } from "./agents/echo-agent.js";

jest.setTimeout(10000);
describe("Agent Tests", () => {
  const agentManager: AgentManager = new AgentManager();
  afterEach(async () => {
    await agentManager.deleteAgent("test-agent");
    await agentManager.close();
  });
  it("should set agent", async () => {
    expect(agentManager).toBeDefined();
    const agent = createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    agentManager.setAgent(agent);
    expect(agentManager.getAgentCount()).toBe(1);
  });
  it("should get agent", async () => {
    const agent = createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    agentManager.setAgent(agent);
    const retrievedAgent = agentManager.getAgent("test-agent");
    expect(retrievedAgent).toBeDefined();
    expect(retrievedAgent?.agentCard.name).toBe("test-agent");
  });
  it("should delete agent", async () => {
    const agent = createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    agentManager.setAgent(agent);
    agentManager.deleteAgent("test-agent");
    expect(agentManager.getAgentCount()).toBe(0);
  });
  it("should get agents", async () => {
    const agent = createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    agentManager.setAgent(agent);
    const agents = agentManager.getAgents();
    expect(agents).toBeDefined();
    expect(agents.length).toBe(1);
  });
  it("should get agent count", async () => {
    expect(agentManager.getAgentCount()).toBe(0);
    const agent = createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    agentManager.setAgent(agent);
    expect(agentManager.getAgentCount()).toBe(1);
  });
  it("should get agent ids", async () => {
    const agent = createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    agentManager.setAgent(agent);
    const agentIds = agentManager.getAgentIds();
    expect(agentIds).toBeDefined();
    expect(agentIds.length).toBe(1);
    expect(agentIds[0]).toBe("test-agent");
  });
});
