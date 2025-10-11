/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  Command,
  State,
  Update,
  ContextManagerInterface,
  Context,
  EventManagerMap,
} from "@artinet/sdk";
import { EventEmitter } from "events";
import { AgentResponse, ToolResponse } from "@artinet/types";

/**
 * @description
 * A custom context manager that acts as a centralized event bus for the router.
 * It emits update and error events when any context is updated or an error occurs.
 */
export class EventBus
  extends EventEmitter<
    Pick<EventManagerMap<Command, State, Update>, "error"> & {
      update: [State | AgentResponse | ToolResponse | string, Update];
    }
  >
  implements ContextManagerInterface<Command, State, Update>
{
  private contexts: Map<string, Context> = new Map();
  constructor(contexts: Map<string, Context> = new Map()) {
    super();
    this.contexts = contexts;
  }
  private emitUpdate = (
    state: State | AgentResponse | ToolResponse | string,
    update: Update
  ): void => {
    this.emit("update", state, update);
  };
  private emitError = (error: any, state: State): void => {
    this.emit("error", error, state);
  };
  getContext(id: string): Context | undefined {
    return this.contexts.get(id);
  }
  setContext(id: string, context: Context): void {
    this.contexts.set(id, context);
    context.events.on("update", this.emitUpdate.bind(this));
    context.events.on("error", this.emitError.bind(this));
  }
  deleteContext(id: string): void {
    const context = this.contexts.get(id);
    if (context) {
      context.events.removeListener("update", this.emitUpdate.bind(this));
      context.events.removeListener("error", this.emitError.bind(this));
    }
    this.contexts.delete(id);
  }
}
