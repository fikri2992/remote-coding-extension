// Minimal ACP protocol types mirrored from acp-web-app/server/types.ts

export type SessionId = string;

export type ResourceTextContents = { text: string; mimeType?: string };
export type ResourceBlobContents = { blob: string; mimeType?: string; uri: string };

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'resource_link'; uri: string; text?: string }
  | { type: 'resource'; resource: ResourceTextContents | ResourceBlobContents };

export type StopReason = 'end_turn' | 'cancelled' | 'refusal';

export interface InitializeRequest {
  protocolVersion: number;
  clientCapabilities: {
    fs: { readTextFile: boolean; writeTextFile: boolean };
    terminal: boolean;
  };
}

export interface InitializeResponse {
  protocolVersion: string;
  agentCapabilities: any;
  authMethods: Array<{ id: string; name: string; description?: string }>;
}

export interface PromptRequest {
  sessionId: SessionId;
  prompt: ContentBlock[];
  extraEnv?: { name: string; value: string }[];
}

export interface PromptResponse {
  stop_reason: StopReason;
}

export type SessionUpdate =
  | { type: 'user_message_chunk'; content: ContentBlock }
  | { type: 'agent_message_chunk'; content: ContentBlock }
  | { type: 'agent_thought_chunk'; content: ContentBlock }
  | { type: 'tool_call'; tool_call: any }
  | { type: 'tool_call_update'; tool_call: any }
  | { type: 'plan'; plan: any }
  | { type: 'available_commands_update'; available_commands: any[] }
  | { type: 'current_mode_update'; current_mode_id: string };

export interface PermissionOption {
  id: string; // optionId
  name: string;
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
}

export interface RequestPermissionRequest {
  session_id: SessionId;
  tool_call: any; // ToolCallUpdate
  options: PermissionOption[];
}
