import { Client } from "@modelcontextprotocol/sdk/client";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ToolInfo } from "@artinet/types";

export interface InitializedTool {
  client: Client;
  transport: Transport;
  info: ToolInfo;
}
