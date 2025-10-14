import { IToolManager } from "./tool-manager.js";
import { IAgentManager } from "./agent-manager.js";
import {
  AgentResponse,
  ConnectRequest,
  ConnectResponse,
  SessionMessage,
  ToolResponse,
} from "@artinet/types";
import { ApiProvider } from "./router.js";

export interface SubSession {
  taskId: string;
  iterations: number;
}

export interface ISessionManager {
  get ConnectRequest(): ConnectRequest;
  get Response(): string;
  get Initialized(): boolean;
  get SubSessions(): Record<string, SubSession>;
  initSession(
    toolIds: string[],
    agentIds: string[],
    toolManager: IToolManager,
    agentManager: IAgentManager
  ): Promise<ConnectRequest>;

  sendMessage(
    message?: SessionMessage,
    toolResults?: ToolResponse[],
    agentResults?: AgentResponse[],
    apiProvider?: ApiProvider
  ): Promise<ConnectResponse>;
}
