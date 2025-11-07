import { SessionMessage } from "@artinet/types";
import { Task, Message, getContent } from "@artinet/sdk";

export function getHistory(
  task: Task,
  filter?: (message: SessionMessage) => boolean
): SessionMessage[] {
  if (!task) return [];
  let history: SessionMessage[] =
    task.history?.map((message: Message) => {
      return {
        role: message.role,
        content: getContent(message) ?? "",
      };
    }) ?? [];
  if (!task.metadata?.referencedTasks) return history;
  history = [
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
      .filter((message: SessionMessage) => message !== undefined)
      .filter(
        (message: SessionMessage) =>
          message.content !== "" &&
          message.content !== "{}" &&
          message.content !== "[]"
      ),
    ...history,
  ];

  return filter ? history.filter(filter) : history;
}
