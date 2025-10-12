import { AgentCard, AgentEngine, Context, getParts } from "@artinet/sdk";

export const testAgentCard: AgentCard = {
  description: "A test agent for unit tests",
  name: "test-agent",
  url: "https://test-agent.com",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  capabilities: {
    extensions: [],
    streaming: false,
    pushNotifications: false,
  },
  defaultInputModes: [],
  defaultOutputModes: [],
  skills: [
    {
      id: "test-skill",
      name: "echo",
      description: "Echo the input",
      tags: ["test", "skill", "echo"],
      examples: ["this input will be echoed"],
      inputModes: ["text/plain"],
      outputModes: ["text/plain"],
    },
  ],
};

export const echoAgentEngine: AgentEngine = async function* (context: Context) {
  const { text: userText } = getParts(context.command.message.parts);
  yield {
    kind: "status-update",
    status: {
      state: "working",
      message: {
        kind: "message",
        role: "agent",
        parts: [{ kind: "text", text: JSON.stringify({ response: userText }) }],
        messageId: context.command.message.messageId ?? "",
      },
    },
    taskId: context.command.message.taskId ?? "",
    contextId: context.command.message.contextId ?? "",
    final: false,
  };
};
