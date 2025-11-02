/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  Agent,
  AgentBuilder,
  AgentCard,
  AgentSkill,
  createAgent,
  FactoryParams as CreateAgentParams,
  Message,
  Task,
  getContent,
} from "@artinet/sdk";
import { SessionMessage } from "@artinet/types";
import { LocalRouter } from "./router.js";

export const defaultAgentCard: AgentCard = {
  description: "placeholder",
  name: "placeholder",
  url: "https://agents.artinet.io",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  capabilities: {
    extensions: [],
    streaming: true,
    pushNotifications: false,
  },
  defaultInputModes: [],
  defaultOutputModes: [],
  skills: [],
};
function getHistory(task: Task): SessionMessage[] {
  if (!task) return [];
  let communicationHistory: SessionMessage[] =
    task.history?.map((message: Message) => {
      return {
        role: message.role,
        content: getContent(message) ?? "",
      };
    }) ?? [];
  if (!task.metadata?.referencedTasks) return communicationHistory;
  communicationHistory = [
    ...communicationHistory,
    ...(task.metadata?.referencedTasks as Task[])
      ?.flatMap((referencedTask: Task) => {
        const sessionMessages: SessionMessage[] =
          referencedTask.history?.map((message: Message) => {
            return {
              role: message.role,
              content: getContent(message) ?? "",
            };
          }) ?? [];
        return sessionMessages;
      })
      .filter((message: SessionMessage) => message !== undefined),
    ];
  return communicationHistory;
}
export function wrapRouter(
  instructions: string,
  card: Partial<AgentCard> & {
    name: string;
    description: string;
    skills: AgentSkill[];
  },
  router: LocalRouter,
  params?: Partial<
    Omit<CreateAgentParams, "engine" | "agentCard" | "contexts">
  > & {
    tools?: string[];
    agents?: string[];
  }
): Agent {
  return createAgent({
    ...params,
    engine: AgentBuilder()
      .text(async ({ content, context }) => {
        return await router.connect({
          message: {
            session: {
              messages: [
                ...getHistory(context.State().task),
                { role: "system", content: instructions },
                { role: "user", content: content ?? "" },
              ],
            },
          },
          tools: params?.tools ?? router.tools.getToolNames(),
          agents: (params?.agents ?? router.agents.getAgentIds()).filter(
            (agent) => agent !== card.name //ensure the agent doesn't call itself
          ),
        });
      })
      .createAgentEngine(),
    agentCard: {
      ...defaultAgentCard,
      ...card,
    },
  });
}
