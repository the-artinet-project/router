import {
  ConnectRequest,
  ConnectResponse,
  Session,
  ToolInfo,
  ToolResponse,
  AgentResponse,
  SessionMessage,
} from "@artinet/types";
import { ToolManager } from "../tools/index.js";
import { AgentManager } from "../agents/index.js";
import { AgentCard } from "@artinet/sdk";
import { connectv1 } from "../api/connect.js";
import { safeParseJSON } from "../utils/parse.js";

export function parseResponse(response: ConnectResponse): string {
  return (
    safeParseJSON(response.agentResponse)?.data?.[0]?.generated_text ??
    "failed to parse response: " +
      (response.agentResponse ?? response.systemMessage ?? response.error)
  );
}

export function updateSession(
  session: Session,
  message: SessionMessage
): Session {
  return {
    ...session,
    messages: [...session.messages, message],
  };
}

export class SessionManager {
  private connectRequest: ConnectRequest;
  private responseText: string = "";
  private initialized: boolean = false;
  constructor(
    connectRequest: Omit<ConnectRequest, "options"> & {
      options: Omit<ConnectRequest["options"], "tools" | "agents">;
    }
  ) {
    this.connectRequest = connectRequest;
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

  async initSession(
    toolIds: string[],
    agentIds: string[],
    toolManager: ToolManager,
    agentManager: AgentManager
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

    const connectOptions: ConnectRequest["options"] = {
      ...this.connectRequest.options,
      tools: {
        ...this.connectRequest.options.tools,
        localServers: localTools,
      },
      agents: {
        ...this.connectRequest.options.agents,
        localServers: localAgents,
      },
    };

    this.connectRequest.options = connectOptions;
    this.initialized = true;
    return this.connectRequest;
  }

  async sendMessage(
    message?: SessionMessage,
    toolResults?: ToolResponse[],
    agentResults?: AgentResponse[],
    connectFunction?: (
      connectRequest: ConnectRequest
    ) => Promise<ConnectResponse>
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

    if (toolResults) {
      const connectOptions: ConnectRequest["options"] = {
        ...this.connectRequest.options,
        tools: {
          ...(this.connectRequest.options.tools ?? {}),
          results: toolResults,
        },
      };
      this.connectRequest.options = connectOptions;
    }

    if (agentResults) {
      const connectOptions: ConnectRequest["options"] = {
        ...this.connectRequest.options,
        agents: {
          ...(this.connectRequest.options.agents ?? {}),
          responses: agentResults,
        },
      };
      this.connectRequest.options = connectOptions;
    }

    const response: ConnectResponse = await (connectFunction ?? connectv1)(
      this.connectRequest
    );

    this.responseText = parseResponse(response);
    this.connectRequest.session = updateSession(this.connectRequest.session, {
      role: "agent",
      content: this.responseText,
    });
    return response;
  }
}
