export type Sender = "human" | "assistant";

export type ContentType = "text" | "thinking" | "tool_use" | "tool_result" | "token_budget";

export interface ExportContent {
  type: ContentType;
  text?: string;
  // tool_use fields
  name?: string;
  input?: unknown;
  // tool_result fields
  content?: unknown;
  is_error?: boolean;
  // token_budget fields
  budget?: number;
}

export interface ExportAttachment {
  file_name: string;
  file_size: number;
  file_type: string;
  extracted_content: string;
}

export interface ExportFile {
  file_uuid: string;
  file_name: string;
}

export interface ExportMessage {
  uuid: string;
  text: string;
  sender: Sender;
  created_at: string;
  updated_at: string;
  content: ExportContent[];
  attachments: ExportAttachment[];
  files: ExportFile[];
  parent_message_uuid: string;
}

export interface ExportConversation {
  uuid: string;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
  account: { uuid: string };
  chat_messages: ExportMessage[];
}

export interface ExportProjectDoc {
  uuid: string;
  filename: string;
  content: string;
}

export interface ExportProject {
  uuid: string;
  name: string;
  description: string;
  is_private: boolean;
  is_starter_project: boolean;
  prompt_template: string;
  created_at: string;
  updated_at: string;
  creator: { uuid: string; full_name: string };
  docs: ExportProjectDoc[];
}

export type ContentMode = "minimal" | "standard" | "full";
export type Scope = "all" | "chats" | "projects";

export interface Config {
  inputDir: string;
  outputDir: string;
  mode: ContentMode;
  includeThinking: boolean;
  includeTools: boolean;
  attachmentThreshold: number;
  scope: Scope;
  dryRun: boolean;
}

export interface RunStats {
  chatsTotal: number;
  chatsWritten: number;
  chatsEmpty: number;
  chatsSkipped: number;
  projectsTotal: number;
  projectsWritten: number;
  attachmentsInline: number;
  attachmentsExternal: number;
  attachmentsMissing: number;
  createdFilesWritten: number;
}
