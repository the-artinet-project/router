/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  ConnectRequest,
  ConnectResponse,
  Session,
  ToolInfo,
  ToolResponse,
  AgentResponse,
  SessionMessage,
  ConnectOptions,
} from "@artinet/types";
import { AgentCard } from "@artinet/sdk";
import { connectv1 } from "../api/connect.js";
import { safeParseJSON } from "../utils/parse.js";
import { ApiProvider, IAgentManager, IToolManager } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";
import { ISessionManager, SubSession } from "../types/session.js";
export function parseResponse(response: ConnectResponse): string {
  return (
    safeParseJSON(response.agentResponse)?.data?.[0]?.generated_text ??
    `failed to parse response: ${
      response.agentResponse ?? response.systemMessage ?? response.error
    }`
  ).trim();
}

function updateSession(session: Session, message: SessionMessage): Session {
  return {
    ...session,
    messages: [...session.messages, message],
  };
}

function addOptions(
  connectOptions: ConnectOptions,
  tools: ToolInfo[],
  agents: AgentCard[]
): ConnectOptions {
  return {
    ...connectOptions,
    tools: {
      ...connectOptions?.tools,
      localServers: tools,
    },
    agents: {
      ...connectOptions?.agents,
      localServers: agents,
    },
  };
}

function addResults(
  connectOptions: ConnectOptions,
  tools: ToolResponse[] | undefined,
  agents: AgentResponse[] | undefined
): ConnectOptions {
  return {
    ...connectOptions,
    tools: {
      ...connectOptions?.tools,
      results: tools,
    },
    agents: {
      ...connectOptions?.agents,
      responses: agents,
    },
  };
}

export class SessionManager implements ISessionManager {
  private connectRequest: ConnectRequest;
  private api: ApiProvider;
  private abortSignal?: AbortSignal;
  private responseText: string = "";
  private initialized: boolean = false;
  private subSessions: Record<string, SubSession> = {};
  constructor(
    connectRequest: ConnectRequest,
    api: ApiProvider = connectv1,
    abortSignal?: AbortSignal
  ) {
    this.connectRequest = connectRequest;
    this.api = api;
    this.abortSignal = abortSignal;
  }
  get ConnectRequest(): ConnectRequest {
    return this.connectRequest;
  }
  get Response(): string {
    return this.responseText;
  }
  get Initialized(): boolean {
    return this.initialized;
  }
  get SubSessions(): Record<string, SubSession> {
    return this.subSessions;
  }
  //maintain async so that we can eventually lazily initialize the session (tools/agents)
  //at which point well use promises to retrieve the tools/agents when they are needed
  async initSession(
    toolIds: string[],
    agentIds: string[],
    toolManager: IToolManager,
    agentManager: IAgentManager
  ): Promise<ConnectRequest> {
    if (this.initialized) {
      throw new Error("Session is already initialized");
    }

    const localTools: ToolInfo[] = (
      await Promise.all(
        toolIds.map(async (id) => await toolManager.getTool(id)?.info)
      )
    ).filter((tool): tool is ToolInfo => tool !== undefined);

    const localAgents: AgentCard[] = (
      await Promise.all(
        agentIds.map(async (id) => await agentManager.getAgent(id)?.agentCard)
      )
    ).filter((agent): agent is AgentCard => agent !== undefined);

    for (const agent of localAgents) {
      this.subSessions[agent.name] = { taskId: uuidv4(), iterations: 0 };
    }

    this.connectRequest.options = addOptions(
      this.connectRequest.options ?? {},
      localTools,
      localAgents
    );

    this.initialized = true;
    return this.connectRequest;
  }

  async sendMessage(
    message?: SessionMessage,
    toolResults?: ToolResponse[],
    agentResults?: AgentResponse[],
    apiProvider?: ApiProvider
  ): Promise<ConnectResponse> {
    if (!this.initialized) {
      throw new Error("Session is not initialized");
    }

    if (message) {
      this.connectRequest.session = updateSession(
        this.connectRequest.session,
        message
      );
    }

    this.connectRequest.options = addResults(
      this.connectRequest.options ?? {},
      toolResults,
      agentResults
    );

    const response: ConnectResponse = await (apiProvider ?? this.api)(
      this.connectRequest,
      this.abortSignal
    );

    this.responseText = parseResponse(response);
    this.connectRequest.session = updateSession(this.connectRequest.session, {
      role: "agent",
      content: this.responseText,
    });
    return response;
  }
}
