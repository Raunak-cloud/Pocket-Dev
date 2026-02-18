import type { WebsiteConfig } from "@/lib/website-config-types";

export type SiteTheme = "food" | "fashion" | "interior" | "automotive" | "people" | "generic";

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface ReactProject {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintReport: {
    passed: boolean;
    errors: number;
    warnings: number;
  };
  config?: WebsiteConfig;
  imageCache?: Record<string, string>;
  sandboxId?: string;
  sandboxUrl?: string;
  sandboxCreatedAt?: number; // timestamp for TTL checking
  originalPrompt?: string;
  detectedTheme?: SiteTheme;
}

export interface UploadedFile {
  name: string;
  type: string;
  dataUrl: string;
  downloadUrl?: string; // Firebase Storage URL
}

export interface SavedProject {
  id: string;
  userId: string;
  prompt: string;
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintReport: {
    passed: boolean;
    errors: number;
    warnings: number;
  };
  createdAt: Date;
  updatedAt: Date;
  isPublished?: boolean;
  publishedUrl?: string;
  deploymentId?: string;
  publishedAt?: Date;
  customDomain?: string;
  tier?: "free" | "premium";
  paidAt?: Date;
  config?: WebsiteConfig;
  sandboxId?: string;
  sandboxUrl?: string;
  sandboxCreatedAt?: number; // timestamp for TTL checking
  originalPrompt?: string;
  detectedTheme?: SiteTheme;
}

export interface EditHistoryEntry {
  id: string;
  prompt: string;
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  timestamp: Date;
}

export interface TicketMessage {
  sender: "user" | "admin";
  text: string;
  timestamp: Date;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  category: "project-issue" | "billing" | "feature-request" | "general";
  subject: string;
  description: string;
  projectId?: string;
  projectName?: string;
  status: "open" | "in-progress" | "resolved";
  createdAt: Date;
  updatedAt: Date;
  adminResponse?: string;
  respondedAt?: Date;
  messages?: TicketMessage[];
  lastReadByUserAt?: Date;
  unreadAdminMessageCount?: number;
}
