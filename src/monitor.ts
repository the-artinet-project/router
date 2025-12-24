/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { A2A, Contexts } from "@artinet/sdk";
import { EventEmitter } from "events";
import { Runtime } from "@artinet/types";

/**
 * @description
 * A custom context manager that acts as a centralized event bus for the router.
 * It emits update and error events when any context is updated or an error occurs.
 */
export class Monitor
  extends EventEmitter<
    Pick<A2A.Emissions, "error"> & {
      update: [
        A2A.Task | Runtime.AgentResponse | Runtime.ToolResponse | string,
        A2A.Update | undefined
      ];
    }
  >
  implements A2A.Contexts
{
  private contexts: Contexts;

  constructor(contexts: Map<string, A2A.Context> = new Map()) {
    super();
    this.contexts = new Contexts(contexts);
  }

  private emitUpdate = (
    state: A2A.Task | Runtime.AgentResponse | Runtime.ToolResponse | string,
    update: A2A.Update | undefined
  ): void => {
    this.emit("update", state, update);
  };

  private emitError = (error: any, state: A2A.Task): void => {
    this.emit("error", error, state);
  };

  getContext(id: string): A2A.Context | undefined {
    // Note: Contexts.get is async, adjust if needed
    return this.contexts.get(id) as unknown as A2A.Context | undefined;
  }

  protected _registerContext(context: A2A.Context): void {
    context.publisher.on("update", this.emitUpdate.bind(this));
    context.publisher.on("error", this.emitError.bind(this));
  }

  protected _unregisterContext(context: A2A.Context): void {
    context.publisher.removeListener("update", this.emitUpdate.bind(this));
    context.publisher.removeListener("error", this.emitError.bind(this));
  }

  async delete(id: string): Promise<void> {
    const context = await this.contexts.get(id);
    if (context) {
      this._unregisterContext(context);
    }
    await this.contexts.delete(id);
  }

  async create(params: A2A.ContextParams): Promise<A2A.Context> {
    const context = await this.contexts.create(params);
    this._registerContext(context);
    return context;
  }

  // Delegate remaining A2A.Contexts interface methods
  async get(id: string): Promise<A2A.Context | undefined> {
    return this.contexts.get(id);
  }

  async list(): Promise<A2A.Context[]> {
    return this.contexts.list();
  }

  async has(id: string): Promise<boolean> {
    return this.contexts.has(id);
  }

  async set(id: string, context?: A2A.Context): Promise<void> {
    return this.contexts.set(id, context);
  }
}
