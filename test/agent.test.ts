import { jest, describe, afterEach, it, expect } from "@jest/globals";
import { AgentManager } from "../src/index.js";
import { createAgent } from "@artinet/sdk";
import { echoAgentEngine, testAgentCard } from "./agents/echo-agent.js";
import { callAgent, callAgents } from "../src/router/call-agents.js";
import { AgentResponse, ToolResponse } from "@artinet/types";
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
  describe("callAgent", () => {
    it("should call agent", async () => {
      const agent = createAgent({
        engine: echoAgentEngine,
        agentCard: testAgentCard,
      });
      const response: AgentResponse | ToolResponse = await callAgent(
        agent,
        {
          kind: "agent_request" as const,
          uri: "test-agent",
          directive: "test",
        },
        {
          taskId: "test-task-id",
        }
      );
      expect(response).toBeDefined();
      expect(response as AgentResponse).toBeDefined();
      expect(response.kind).toBe("agent_response");
      expect((response as AgentResponse).uri).toBe("test-agent");
      expect((response as AgentResponse).directive).toBe("test");
      expect((response as AgentResponse).result).toBe('{"response":"test"}');
    });
    it("should call agents", async () => {
      const agent = createAgent({
        engine: echoAgentEngine,
        agentCard: testAgentCard,
      });
      agentManager.setAgent(agent);
      const responses: AgentResponse[] = await callAgents(
        agentManager,
        [
          {
            kind: "agent_request" as const,
            uri: "test-agent",
            directive: "test",
          },
        ],
        {
          taskId: "test-task-id",
          callbackFunction: () => {},
        }
      );
      expect(responses).toBeDefined();
      expect(responses[0].kind).toBe("agent_response");
      expect(responses[0].uri).toBe("test-agent");
      expect(responses[0].directive).toBe("test");
      expect(responses[0].result).toBe('{"response":"test"}');
    });
    it("should pass subsession", async () => {
      const agent = createAgent({
        engine: echoAgentEngine,
        agentCard: testAgentCard,
      });
      agentManager.setAgent(agent);
      await callAgents(
        agentManager,
        [
          {
            kind: "agent_request" as const,
            uri: "test-agent",
            directive: "test",
          },
        ],
        {
          taskId: "test-task-id-false",
          callbackFunction: () => {},
        },
        {
          "test-agent": {
            taskId: "test-task-id-true",
            iterations: 0,
          },
        }
      );
      const state = await agent.getState("test-task-id-true");
      expect(state).toBeDefined();
      expect(state?.task.id).toBe("test-task-id-true");
    });
  });
});
