import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  StdioServerParameters,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from "./logger.js";

export async function safeClose(
  client: Client,
  transport: StdioClientTransport
) {
  if (!client || !transport) {
    return;
  }
  try {
    const pid = transport.pid;
    const childProcess = (transport as any)._process;
    if (childProcess) {
      // Remove all listeners from streams
      childProcess.stdin?.removeAllListeners();
      childProcess.stdout?.removeAllListeners();
      childProcess.stderr?.removeAllListeners();

      // Destroy the streams
      childProcess.stdin?.destroy();
      childProcess.stdout?.destroy();
      childProcess.stderr?.destroy();

      // Unpipe stderr if it was piped
      childProcess.stderr?.unpipe();
    }
    await transport.close().catch((_) => {});
    await client.close().catch((_) => {});
    if (pid) {
      await process.kill(pid, "SIGKILL");
    }
    transport.stderr?.removeAllListeners();
  } catch (error) {
    logger.error("error closing transport: ", error);
  }
}

export function safeStdioTransport(transportParams: StdioServerParameters) {
  return new StdioClientTransport({
    ...transportParams,
    stderr: transportParams.stderr ?? "pipe",
  });
}
