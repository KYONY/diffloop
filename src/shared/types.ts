export type CommentType = "fix" | "question";

export interface Message {
  author: "user" | "model";
  text: string;
  timestamp: number;
}

export interface Thread {
  id: string;
  file: string;
  line: number;
  endLine?: number;
  lines?: number[];
  side: "old" | "new";
  type: CommentType;
  messages: Message[];
  resolved: boolean;
  codeSnippet?: string;
}

export interface ReviewState {
  iteration: number;
  threads: Thread[];
  previousRawDiff?: string;
}

export interface FileDiff {
  filename: string;
  status: "modified" | "added" | "deleted" | "renamed";
  oldFilename?: string;
  rawDiff: string;
}

export interface DiffData {
  files: FileDiff[];
  rawUnifiedDiff: string;
}

export type Decision =
  | { decision: "allow" }
  | { decision: "deny"; feedback: string; state: ReviewState }
  | { decision: "save"; state: ReviewState };

export interface StdinInput {
  state?: ReviewState;
  modelResponses?: Array<{
    threadId: string;
    text: string;
  }>;
}
// test
