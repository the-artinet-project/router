import { Experimental } from "@artinet/types";
/**
 * @note A lightweight port of the completion interface from the OpenAI API
 * Will attempt to fetch as part of the build.
 */

export interface CreateCompletion {
  messages: Array<{
    name?: string;
    role: Experimental.Role;
    content: string | Array<Experimental.TextContent>;
  }>;
  model: string;
  max_completion_tokens?: number;
  metadata?: Record<string, any>;
  modalities?: Array<"text" | "audio">;
  parrallel_tool_calls?: boolean;
  n?: number;
  user?: string;
  verbosity?: "low" | "medium" | "high";
  tools?: Array<FunctionTool | CustomTool>;
}

export interface Completion {
  id: string;
  choices: Array<Choice>;
  created: number;
  model: string;
  object: "chat.completion";
  usage?: Usage;
}

export interface Choice {
  finish_reason:
    | "stop"
    | "length"
    | "tool_calls"
    | "content_filter"
    | "function_call";
  index: number;
  logprobs?: never;
  message: {
    content?: string;
    refusal?: string;
    role: `assistant`;
    tool_calls?: Array<FunctionToolCall | CustomToolCall>;
  };
}
export interface Usage {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
  completion_tokens_details?: {
    accepted_prediction_tokens?: number;
    audio_tokens?: number;
    reasoning_tokens?: number;
    rejected_prediction_tokens?: number;
  };
  prompt_tokens_details?: {
    audio_tokens?: number;
    cached_tokens?: number;
  };
}
interface Function {
  name: string;
  arguments: string;
}
interface FunctionToolCall {
  id: string;
  type: "function";
  function: Function;
}
interface CustomToolCall {
  id: string;
  type: "custom";
  custom: {
    input: string;
    name: string;
  };
}
export interface FunctionTool {
  /**
   * The type of the tool. Currently, only `function` is supported.
   */
  type: "function";
  function: {
    /**
     * The name of the function to be called. Must be a-z, A-Z, 0-9, or contain
     * underscores and dashes, with a maximum length of 64.
     */
    name: string;

    /**
     * A description of what the function does, used by the model to choose when and
     * how to call the function.
     */
    description?: string;

    /**
     * The parameters the functions accepts, described as a JSON Schema object. See the
     * [guide](https://platform.openai.com/docs/guides/function-calling) for examples,
     * and the
     * [JSON Schema reference](https://json-schema.org/understanding-json-schema/) for
     * documentation about the format.
     *
     * Omitting `parameters` defines a function with an empty parameter list.
     */
    parameters?: { [key: string]: unknown };

    /**
     * Whether to enable strict schema adherence when generating the function call. If
     * set to true, the model will follow the exact schema defined in the `parameters`
     * field. Only a subset of JSON Schema is supported when `strict` is `true`. Learn
     * more about Structured Outputs in the
     * [function calling guide](https://platform.openai.com/docs/guides/function-calling).
     */
    strict?: boolean;
  };
  //   id: string;
}

export interface CustomTool {
  /**
   * The type of the custom tool. Always `custom`.
   */
  type: "custom";
  /**
   * Properties of the custom tool.
   */
  custom: {
    /**
     * The name of the custom tool, used to identify it in tool calls.
     */
    name: string;

    /**
     * Optional description of the custom tool, used to provide more context.
     */
    description?: string;

    /**
     * The input format for the custom tool. Default is unconstrained text.
     */
    format?:
      | {
          /**
           * Unconstrained text format. Always `text`.
           */
          type: "text";
        }
      | {
          /**
           * Grammar format. Always `grammar`.
           */
          type: "grammar";
          /**
           * Your chosen grammar.
           */
          grammar: {
            /**
             * The grammar definition.
             */
            definition: string;

            /**
             * The syntax of the grammar definition. One of `lark` or `regex`.
             */
            syntax: "lark" | "regex";
          };
        };
  };
}
