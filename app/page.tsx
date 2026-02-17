"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { generateCodeWithInngest } from "@/lib/inngest-helpers";
import CodeViewer from "./components/CodeViewer";
import E2BPreview from "./components/E2BPreview";
import LoadingScreen from "./components/LoadingScreen";
import BackgroundEffects from "./components/BackgroundEffects";
import SettingsContent from "./components/Settings";
import ProjectsContent from "./components/Projects";
import { createSandboxServer } from "./sandbox-actions";
import { cancelGenerationJob } from "./inngest-actions";
import { prepareSandboxFiles } from "@/lib/sandbox-utils";
import { useAuth } from "./contexts/AuthContext";
import SignInModal from "./components/SignInModal";
import DashboardSidebar from "./components/DashboardSidebar";
import GenerationProgress from "./components/GenerationProgress";
import MaintenanceToggle from "./components/MaintenanceToggle";
import { persistGeneratedImages } from "@/lib/persist-images";
import { useSupabaseUploads } from "@/lib/supabase-uploads";
import ThemeToggle from "./components/ThemeToggle";
import {
  DeleteConfirmModal,
  CancelConfirmModal,
  AuthModal,
  DatabaseModal,
  TokenPurchaseModal,
  WelcomeModal,
  DomainSettingsModal,
  GitHubExportModal,
  TokenConfirmModal,
} from "./components/Modals";
import CreateContentComponent from "./components/Generation/CreateContent";
import SupportContentComponent from "./components/Support/SupportContent";
import { usePublishing } from "./hooks/usePublishing";
import { useGitHubExport } from "./hooks/useGitHubExport";
import { useEditorExport } from "./hooks/useEditorExport";

// Types
import type {
  ReactProject,
  UploadedFile,
  SavedProject,
  EditHistoryEntry,
  SupportTicket,
} from "./types";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";
const BASE_GENERATION_APP_COST = 2;
const BASE_EDIT_APP_COST = 0.1;
const AUTH_OPTION_APP_COST = 2;
const DATABASE_APP_FLAT_COST = 10;

// Helper function to format token values to 2 decimal places
const formatTokens = (tokens: number): string => {
  return tokens.toFixed(2);
};

// E2B preview component with loading state
function ReactGeneratorContent() {
  const {
    user,
    userData,
    loading: authLoading,
    refreshUserData,
    isNewUser,
    clearNewUser,
  } = useAuth();
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [project, setProject] = useState<ReactProject | null>(null);
  const [error, setError] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState(false);
  const [activeSection, setActiveSection] = useState("create");
  const [adminTab, setAdminTab] = useState<"support" | "maintenance">(
    "support",
  );
  const [isGenerationMinimized, setIsGenerationMinimized] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [currentGenerationProjectId, setCurrentGenerationProjectId] = useState<
    string | null
  >(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [previewMode, setPreviewMode] = useState<
    "mobile" | "tablet" | "desktop"
  >("desktop");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [showCodeViewer, setShowCodeViewer] = useState(false);
  const [textEditMode, setTextEditMode] = useState(false);
  const [imageSelectMode, setImageSelectMode] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{
    src: string;
    resolvedSrc?: string;
    alt: string;
    occurrence: number;
  } | null>(null);
  const [isReplacingSelectedImage, setIsReplacingSelectedImage] = useState(false);
  const [imageRegenerationPrompt, setImageRegenerationPrompt] = useState("");
  const [editProgressMessages, setEditProgressMessages] = useState<string[]>(
    [],
  );
  const [isEditMinimized, setIsEditMinimized] = useState(false);
  const [editFiles, setEditFiles] = useState<UploadedFile[]>([]);
  const [showTokenPurchaseModal, setShowTokenPurchaseModal] = useState(false);
  const [tokenPurchaseAmount, setTokenPurchaseAmount] = useState(0);
  const [isProcessingTokenPurchase, setIsProcessingTokenPurchase] =
    useState(false);
  const [showTokenConfirmModal, setShowTokenConfirmModal] = useState<
    "generation" | "edit" | null
  >(null);
  const [skipEditTokenConfirm, setSkipEditTokenConfirm] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("skipEditTokenConfirm") === "true";
    }
    return false;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<
    "generation" | "edit" | null
  >(null);
  const [currentAppAuth, setCurrentAppAuth] = useState<string[]>([]);
  const [currentAppDatabase, setCurrentAppDatabase] = useState<string[]>([]);
  const [insufficientTokenMessage, setInsufficientTokenMessage] = useState<
    string | null
  >(null);
  const [editAppAuth, setEditAppAuth] = useState<string[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [tokenToast, setTokenToast] = useState("");
  // Support ticket state
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [adminTickets, setAdminTickets] = useState<SupportTicket[]>([]);
  const [ticketCategory, setTicketCategory] =
    useState<SupportTicket["category"]>("general");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketProjectId, setTicketProjectId] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [adminResponse, setAdminResponse] = useState("");
  const [respondingToTicketId, setRespondingToTicketId] = useState<
    string | null
  >(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [userReplyText, setUserReplyText] = useState("");
  const [replyingToTicketId, setReplyingToTicketId] = useState<string | null>(
    null,
  );
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketSubmittedNotice, setTicketSubmittedNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const generationCancelledRef = useRef(false);
  const editStartTimeRef = useRef<number>(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [authPromptWarning, setAuthPromptWarning] = useState<string | null>(
    null,
  );
  const [checkingAuthIntent, setCheckingAuthIntent] = useState(false);
  const [checkingEditClarity, setCheckingEditClarity] = useState(false);
  const [editClarificationQuestion, setEditClarificationQuestion] = useState("");
  const [editClarificationSuggestion, setEditClarificationSuggestion] =
    useState("");
  const [editClarificationAnswer, setEditClarificationAnswer] = useState("");
  const [editClarificationHistory, setEditClarificationHistory] = useState<
    Array<{ question: string; answer: string }>
  >([]);
  const { startUpload } = useSupabaseUploads();

  // Initialize custom hooks for publishing, GitHub export, and editor export
  const publishingHook = usePublishing({
    user,
    currentProjectId,
    project,
    generationPrompt,
    setError,
    loadSavedProjects: () => loadSavedProjects(), // Will be defined below
  });

  const githubExportHook = useGitHubExport({
    project,
    setError,
  });

  const editorExportHook = useEditorExport({
    project,
    setError,
  });

  // Destructure hook values for easier access
  const {
    isPublishing,
    publishedUrl,
    hasUnpublishedChanges,
    showDomainModal,
    customDomain,
    setPublishedUrl,
    setDeploymentId,
    setHasUnpublishedChanges,
    setShowDomainModal,
    setCustomDomain,
    publishProject,
    unpublishProject,
    connectDomain,
  } = publishingHook;

  const {
    showGitHubModal,
    githubToken,
    githubRepoName,
    githubPrivate,
    githubExportStatus,
    githubExportMessage,
    githubRepoUrl,
    setShowGitHubModal,
    setGithubToken,
    setGithubRepoName,
    setGithubPrivate,
    exportToGitHub,
    pushToGitHub,
  } = githubExportHook;

  const {
    showExportDropdown,
    isExporting,
    exportSuccessMessage,
    setShowExportDropdown,
    setExportSuccessMessage,
    exportToVSCode,
    exportToCursor,
  } = editorExportHook;

  async function detectIntegrationIntent(
    text: string,
  ): Promise<{ hasAuthIntent: boolean; hasDatabaseIntent: boolean }> {
    const lower = text.toLowerCase();
    const localAuthIntent =
      /\bauth\b|\bauthentication\b|\blog[\s-]?in\b|\bsign[\s-]?in\b|\bsign[\s-]?up\b|\bregister\b|\bpassword\b|\boauth\b|\bsso\b|\bsession\b/.test(
        lower,
      );
    const localDatabaseIntent =
      /\bdatabase\b|\bdb\b|\bsql\b|\bnosql\b|\bpostgres\b|\bmysql\b|\bmongodb\b|\bredis\b|\bsupabase\b|\bprisma\b|\bschema\b|\btable\b|\bquery\b|\bcrud\b|\bpersist\b|\bdata model\b/.test(
        lower,
      );

    try {
      const res = await fetch("/api/check-integration-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      if (!res.ok) {
        return {
          hasAuthIntent: localAuthIntent,
          hasDatabaseIntent: localDatabaseIntent,
        };
      }
      const data = await res.json();
      return {
        hasAuthIntent: data.hasAuthIntent === true || localAuthIntent,
        hasDatabaseIntent:
          data.hasDatabaseIntent === true || localDatabaseIntent,
      };
    } catch {
      return {
        hasAuthIntent: localAuthIntent,
        hasDatabaseIntent: localDatabaseIntent,
      };
    }
  }

  function showIntegrationBlockedFeedback(args: {
    hasAuthIntent: boolean;
    hasDatabaseIntent: boolean;
    source: "generation" | "edit";
  }) {
    const { hasAuthIntent, hasDatabaseIntent, source } = args;
    const blocked =
      hasAuthIntent && hasDatabaseIntent
        ? "authentication and database"
        : hasAuthIntent
          ? "authentication (login features)"
          : "database";
    const message =
      source === "generation"
        ? `This request is paused.\n${blocked[0].toUpperCase()}${blocked.slice(1)} should be added using the buttons.\nUse Add Auth and Database below the prompt.`
        : `This request is paused. ${blocked[0].toUpperCase()}${blocked.slice(1)} should be added using buttons. Use Add Auth and Database in the edit panel.`;

    setAuthPromptWarning(message);
    setError(message);

    if (hasAuthIntent) {
      setShowAuthModal(true);
    }
    if (hasDatabaseIntent) {
      setShowDbModal(true);
    }
  }

  async function detectEditClarification(
    text: string,
    filePaths: string[],
    clarificationHistory?: Array<{ question: string; answer: string }>,
  ): Promise<{
    needsClarification: boolean;
    question: string;
    suggestedInterpretation: string;
  }> {
    try {
      const res = await fetch("/api/check-edit-clarity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, filePaths, clarificationHistory }),
      });
      if (!res.ok) {
        return {
          needsClarification: false,
          question: "",
          suggestedInterpretation: "",
        };
      }
      const data = await res.json();
      return {
        needsClarification: data.needsClarification === true,
        question: typeof data.question === "string" ? data.question : "",
        suggestedInterpretation:
          typeof data.suggestedInterpretation === "string"
            ? data.suggestedInterpretation
            : "",
      };
    } catch {
      return {
        needsClarification: false,
        question: "",
        suggestedInterpretation: "",
      };
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "52px";
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 52), 150);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [prompt]);

  // Typing placeholder animation
  const placeholderExamples = [
    "A restaurant website with menu, reservations & contact page",
    "An e-commerce store with product listings and cart",
    "A fitness tracker app with workout logs and progress charts",
    "A recipe sharing platform with search and categories",
    "A portfolio site with project gallery and blog",
  ];
  const [, setTypingPlaceholder] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (prompt) return; // Don't animate when user is typing
    const current = placeholderExamples[placeholderIndex];

    if (isTyping) {
      if (charIndex < current.length) {
        const timeout = setTimeout(
          () => {
            setTypingPlaceholder(current.slice(0, charIndex + 1));
            setCharIndex(charIndex + 1);
          },
          35 + Math.random() * 25,
        );
        return () => clearTimeout(timeout);
      } else {
        // Pause at end before deleting
        const timeout = setTimeout(() => setIsTyping(false), 3500);
        return () => clearTimeout(timeout);
      }
    } else {
      if (charIndex > 0) {
        const timeout = setTimeout(() => {
          setTypingPlaceholder(current.slice(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        }, 12);
        return () => clearTimeout(timeout);
      } else {
        // Move to next example
        setPlaceholderIndex(
          (placeholderIndex + 1) % placeholderExamples.length,
        );
        setIsTyping(true);
      }
    }
  }, [charIndex, isTyping, placeholderIndex, prompt]);

  // Load saved projects when user logs in
  useEffect(() => {
    if (user) {
      loadSavedProjects();
    } else {
      setSavedProjects([]);
    }
  }, [user]);

  // Auto-collapse sidebar when project is being previewed
  useEffect(() => {
    if (project && activeSection === "create") {
      setIsSidebarCollapsed(true);
    } else if (activeSection !== "create") {
      // Expand sidebar when navigating to other sections
      setIsSidebarCollapsed(false);
    }
  }, [project, activeSection]);

  // Close edit/export dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportDropdown && !target.closest(".export-dropdown")) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportDropdown]);

  // Handle token payment success redirect
  useEffect(() => {
    const tokenPayment = searchParams.get("token_payment");

    if (tokenPayment === "success" && user) {
      const handleTokenSuccess = async () => {
        const sessionId = searchParams.get("session_id");
        const tokenType = "app";
        const amount = searchParams.get("amount") || "";

        let credited = false;
        if (sessionId) {
          try {
            const response = await fetch("/api/verify-token-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            });
            const data = await response.json();
            if (data.success) {
              credited = true;
              await refreshUserData();
            }
          } catch (e) {
            console.error("Error verifying token payment:", e);
          }
        }

        if (!credited) {
          await refreshUserData();
        }

        window.history.replaceState({}, "", "/");

        // Check for pending edit to resume
        const pendingEditStr = sessionStorage.getItem("pendingEdit");
        if (pendingEditStr) {
          sessionStorage.removeItem("pendingEdit");
          try {
            const pendingEdit = JSON.parse(pendingEditStr);
            // Load saved projects, find the one we were editing, and reopen it.
            const listRes = await fetch("/api/projects/list", {
              cache: "no-store",
            });
            if (!listRes.ok) {
              throw new Error("Failed to load projects");
            }
            const projects = (await listRes.json()) as SavedProject[];
            setSavedProjects(projects);

            const targetProject = projects.find(
              (p) => p.id === pendingEdit.projectId,
            );
            if (targetProject) {
              // Reopen the project
              openSavedProject(targetProject);
              // Restore edit prompt and auth
              setEditPrompt(pendingEdit.editPrompt || "");
              setEditAppAuth(pendingEdit.editAppAuth || []);
              // Show toast after a short delay for UI to settle
              setTimeout(() => {
                setTokenToast(
                  `Payment successful! ${amount} ${tokenType} tokens added. Your edit will now continue.`,
                );
                setTimeout(() => setTokenToast(""), 8000);
              }, 500);
              return;
            }
          } catch (e) {
            console.error("Error restoring pending edit:", e);
          }
        }

        setTokenToast(
          `Payment successful! ${amount} ${tokenType} tokens have been added to your account.`,
        );
        setTimeout(() => setTokenToast(""), 8000);
      };
      handleTokenSuccess();
    } else if (tokenPayment === "cancelled") {
      sessionStorage.removeItem("pendingEdit");
      window.history.replaceState({}, "", "/");
      setError("Payment cancelled. You can try again when ready.");
    }
  }, [searchParams, user]);

  // Save project to DB via Prisma API
  const saveProjectToFirestore = async (
    projectData: ReactProject,
    projectPrompt: string,
    authIntegrationCost: number = 0,
  ): Promise<string> => {
    if (!user) throw new Error("User not logged in");

    const response = await fetch("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: projectPrompt,
        files: projectData.files,
        dependencies: projectData.dependencies || {},
        lintReport: projectData.lintReport || {
          passed: true,
          errors: 0,
          warnings: 0,
        },
        config: projectData.config,
        authIntegrationCost,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.projectId) {
      throw new Error(data.error || "Failed to save project");
    }

    await refreshUserData();
    return data.projectId as string;
  };

  // Update existing project in DB via Prisma API
  const updateProjectInFirestore = async (
    projectId: string,
    projectData: ReactProject,
  ): Promise<void> => {
    if (!user) throw new Error("User not logged in");
    const response = await fetch("/api/projects/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        files: projectData.files,
        dependencies: projectData.dependencies || {},
        lintReport: projectData.lintReport || {
          passed: true,
          errors: 0,
          warnings: 0,
        },
        config: projectData.config,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update project");
    }
  };

  // Load saved projects from Firestore
  const loadSavedProjects = async () => {
    if (!user) return;

    setLoadingProjects(true);
    try {
      const response = await fetch("/api/projects/list", { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load projects");
      }
      const projects = (await response.json()) as SavedProject[];
      setSavedProjects(projects);
    } catch (error) {
      console.error("Error loading projects:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load projects",
      );
    } finally {
      setLoadingProjects(false);
    }
  };

  // Load support tickets for current user
  const loadSupportTickets = async () => {
    if (!user) return;
    setLoadingTickets(true);
    try {
      const response = await fetch("/api/support-tickets/list", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to load support tickets");
      const tickets = (await response.json()) as SupportTicket[];
      setSupportTickets(tickets);
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Load all tickets (admin only)
  const loadAdminTickets = async () => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    setLoadingTickets(true);
    try {
      const response = await fetch("/api/support-tickets/admin-list", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to load admin tickets");
      const tickets = (await response.json()) as SupportTicket[];
      setAdminTickets(tickets);
    } catch (error) {
      console.error("Error loading admin tickets:", error);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Submit a support ticket
  const submitSupportTicket = async () => {
    if (!user || !ticketSubject.trim() || !ticketDescription.trim()) return;
    setIsSubmittingTicket(true);
    try {
      const ticketData: Record<string, string> = {
        category: ticketCategory,
        subject: ticketSubject.trim(),
        description: ticketDescription.trim(),
      };
      if (ticketProjectId) {
        const proj = savedProjects.find((p) => p.id === ticketProjectId);
        ticketData.projectId = ticketProjectId;
        ticketData.projectName = proj
          ? proj.prompt.substring(0, 60)
          : ticketProjectId;
      }
      const response = await fetch("/api/support-tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticketData),
      });
      if (!response.ok) {
        throw new Error("Failed to submit support ticket");
      }
      // Reset form
      setTicketSubject("");
      setTicketDescription("");
      setTicketCategory("general");
      setTicketProjectId("");
      setTicketSubmittedNotice(true);
      setTimeout(() => setTicketSubmittedNotice(false), 6000);
      // Reload tickets
      await loadSupportTickets();
    } catch (error) {
      console.error("Error submitting ticket:", error);
      alert("Failed to submit ticket. Please try again.");
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // Admin: respond to a ticket
  const respondToTicket = async (
    ticketId: string,
    response: string,
    newStatus: SupportTicket["status"],
  ) => {
    if (!user || user.email !== ADMIN_EMAIL || !response.trim()) return;
    try {
      const responseResult = await fetch("/api/support-tickets/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          response: response.trim(),
          status: newStatus,
        }),
      });
      if (!responseResult.ok) {
        throw new Error("Failed to respond to ticket");
      }

      setAdminResponse("");
      setRespondingToTicketId(null);
      await loadAdminTickets();
    } catch (error) {
      console.error("Error responding to ticket:", error);
      alert("Failed to send response. Please try again.");
    }
  };

  // Mark ticket as read when user opens it
  const handleTicketClick = async (ticketId: string) => {
    // Toggle selection
    const newSelectedId = ticketId === selectedTicketId ? null : ticketId;
    setSelectedTicketId(newSelectedId);

    // If opening a ticket (not closing), mark as read
    if (newSelectedId && user) {
      try {
        await fetch("/api/support-tickets/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId }),
        });
        // Reload tickets to update unread count
        await loadSupportTickets();
      } catch (error) {
        console.error("Error marking ticket as read:", error);
        // Don't show error to user - this is a background operation
      }
    }
  };

  // User: reply back to admin on an unresolved ticket
  const userReplyToTicket = async (ticketId: string) => {
    if (!user || !userReplyText.trim()) return;
    try {
      const response = await fetch("/api/support-tickets/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, text: userReplyText.trim() }),
      });
      if (!response.ok) {
        throw new Error("Failed to send reply");
      }
      setUserReplyText("");
      setReplyingToTicketId(null);
      setTicketSubmittedNotice(true);
      setTimeout(() => setTicketSubmittedNotice(false), 6000);
      await loadSupportTickets();
    } catch (error) {
      console.error("Error replying to ticket:", error);
      alert("Failed to send reply. Please try again.");
    }
  };

  // Load edit history for a project
  const loadEditHistory = async (projectId: string) => {
    // Edit history is currently client-session based after Firebase removal.
    // Keep current state for active session and reset when switching projects.
    void projectId;
    setEditHistory([]);
  };

  // Rollback to a previous version from edit history
  const rollbackToVersion = async (entry: EditHistoryEntry) => {
    if (!currentProjectId || !user) return;
    setIsRollingBack(true);
    try {
      const restoredProject: ReactProject = {
        files: entry.files,
        dependencies: entry.dependencies || {},
        lintReport: { passed: true, errors: 0, warnings: 0 },
      };
      setProject(restoredProject);
      await updateProjectInFirestore(currentProjectId, restoredProject);
      // Preview updates via file diff (Effect 2 in E2BPreview)
      if (publishedUrl) {
        setHasUnpublishedChanges(true);
      }
    } catch (error) {
      console.error("Error rolling back:", error);
      setError("Failed to rollback. Please try again.");
    } finally {
      setIsRollingBack(false);
    }
  };

  // Open a saved project
  const openSavedProject = (savedProject: SavedProject) => {
    setProject({
      files: savedProject.files,
      dependencies: savedProject.dependencies || {},
      lintReport: savedProject.lintReport || {
        passed: true,
        errors: 0,
        warnings: 0,
      },
      config: savedProject.config,
    });
    setCurrentProjectId(savedProject.id);
    setGenerationPrompt(savedProject.prompt);
    setPublishedUrl(savedProject.publishedUrl || null);
    setDeploymentId(savedProject.deploymentId || null);
    setCustomDomain(savedProject.customDomain || "");
    setHasUnpublishedChanges(false);
    setStatus("success");
    setActiveSection("create");
    // Force E2B to re-initialize with new project data
    setPreviewKey((prev) => prev + 1);
    // Load edit history
    loadEditHistory(savedProject.id);
  };

  // Delete project
  const deleteProject = async (projectId: string) => {
    if (!user) return;

    try {
      const response = await fetch("/api/projects/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) throw new Error("Failed to delete project");

      // If this is the currently open project, close it
      if (currentProjectId === projectId) {
        setProject(null);
        setCurrentProjectId(null);
        setStatus("idle");
        setGenerationPrompt("");
        setPublishedUrl(null);
        setDeploymentId(null);
        setHasUnpublishedChanges(false);
        setEditHistory([]);
      }

      // Refresh projects list
      await loadSavedProjects();
      setShowDeleteModal(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      setError("Failed to delete project. Please try again.");
    }
  };

  // Purchase tokens via Stripe
  const purchaseTokens = async () => {
    if (!user) return;

    setIsProcessingTokenPurchase(true);
    setError("");
    try {
      const response = await fetch("/api/create-token-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          quantity: tokenPurchaseAmount,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        throw new Error("Server error. Please try again.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (!data.url) {
        throw new Error("No checkout URL received");
      }

      // Save pending edit context so we can resume after payment
      if (
        currentProjectId &&
        status === "success" &&
        (editPrompt.trim() || editAppAuth.length > 0)
      ) {
        sessionStorage.setItem(
          "pendingEdit",
          JSON.stringify({
            projectId: currentProjectId,
            editPrompt: editPrompt.trim(),
            editAppAuth,
          }),
        );
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Error creating token checkout:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Payment failed. Please try again.",
      );
      setIsProcessingTokenPurchase(false);
    }
  };

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !user) return;
      const fileArray = Array.from(files);

      try {
        const dataUrlResults = await Promise.all(
          fileArray.map(
            (file) =>
              new Promise<{ file: File; dataUrl: string }>((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) =>
                  resolve({
                    file,
                    dataUrl: (ev.target?.result as string) || "",
                  });
                reader.readAsDataURL(file);
              }),
          ),
        );

        const uploaded = await startUpload(fileArray);
        if (!uploaded) throw new Error("Upload failed");

        setUploadedFiles((prev) => [
          ...prev,
          ...uploaded.map((u, idx) => ({
            name: u.name,
            type: dataUrlResults[idx].file.type,
            dataUrl: dataUrlResults[idx].dataUrl,
            downloadUrl: u.url,
          })),
        ]);
      } catch (error) {
        console.error("Error uploading file:", error);
        setError("Failed to upload files. Please try again.");
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [user, startUpload],
  );

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleEditFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !user) return;
      const fileArray = Array.from(files);

      try {
        const dataUrlResults = await Promise.all(
          fileArray.map(
            (file) =>
              new Promise<{ file: File; dataUrl: string }>((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) =>
                  resolve({
                    file,
                    dataUrl: (ev.target?.result as string) || "",
                  });
                reader.readAsDataURL(file);
              }),
          ),
        );

        const uploaded = await startUpload(fileArray);
        if (!uploaded) throw new Error("Upload failed");

        setEditFiles((prev) => [
          ...prev,
          ...uploaded.map((u, idx) => ({
            name: u.name,
            type: dataUrlResults[idx].file.type,
            dataUrl: dataUrlResults[idx].dataUrl,
            downloadUrl: u.url,
          })),
        ]);
      } catch (error) {
        console.error("Error uploading file:", error);
        setError("Failed to upload files. Please try again.");
      }

      if (editFileInputRef.current) editFileInputRef.current.value = "";
    },
    [user, startUpload],
  );

  const removeEditFile = useCallback((index: number) => {
    setEditFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const cancelGeneration = () => {
    setShowCancelConfirm("generation");
  };

  const confirmCancelGeneration = async () => {
    generationCancelledRef.current = true;
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Cancel the Inngest job if it's running
    if (currentGenerationProjectId) {
      console.log(
        `[App] Cancelling generation job: ${currentGenerationProjectId}`,
      );
      await cancelGenerationJob(currentGenerationProjectId);
      setCurrentGenerationProjectId(null);
    }

    setStatus("idle");
    setProgressMessages([]);
    setGenerationPrompt("");
    setIsGenerationMinimized(false);
    setShowCancelConfirm(null);
  };

  const getAuthAppCost = (auth: string[]) => auth.length * AUTH_OPTION_APP_COST;
  const getDatabaseAppCost = (db: string[]) =>
    db.length > 0 ? DATABASE_APP_FLAT_COST : 0;
  const roundToken = (value: number) => Math.round(value * 100) / 100;
  const getGenerationAppCost = () =>
    roundToken(
      BASE_GENERATION_APP_COST +
        getAuthAppCost(currentAppAuth) +
        getDatabaseAppCost(currentAppDatabase),
    );
  const getEditAppCost = () =>
    roundToken(
      BASE_EDIT_APP_COST +
        getAuthAppCost(editAppAuth) +
        getDatabaseAppCost(currentAppDatabase),
    );

  const buildDatabaseRequirementPrompt = (
    selectedDatabase: string[],
    mode: "new" | "existing",
  ) => {
    if (selectedDatabase.length === 0) return "";

    const selectedSet = new Set(selectedDatabase);
    const scopeText =
      mode === "new"
        ? "for this new app"
        : "and integrate it into this existing app";

    const requirements: string[] = [
      `Use Supabase only ${scopeText}.`,
      "Create a production-ready Supabase setup with clear env variable usage.",
    ];

    if (selectedSet.has("supabase-postgres")) {
      requirements.push(
        "Add a Supabase Postgres data model with practical tables, relations, and typed data access.",
      );
    }
    if (selectedSet.has("crud-api-routes")) {
      requirements.push(
        "Implement complete CRUD API routes/server actions for the selected entities, including validation and error handling.",
      );
    }
    if (selectedSet.has("row-level-security")) {
      requirements.push(
        "Enable and apply Row Level Security (RLS) policies so users can only access their own tenant/user-scoped data.",
      );
    }

    return `\n\n🗄️ DATABASE REQUIREMENT:\n${requirements
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n")}`;
  };

  const isExplicitImageChangeRequest = (request: string): boolean => {
    const text = request.toLowerCase();
    if (!text.trim()) return false;

    const imageIntentRe =
      /\b(image|images|photo|photos|picture|pictures|hero image|gallery|thumbnail|banner|logo|illustration|background image)\b/;
    const changeVerbRe =
      /\b(change|replace|swap|update|regenerate|refresh|new|different|another|remove|edit|modify)\b/;

    return imageIntentRe.test(text) && changeVerbRe.test(text);
  };

  const clearEditClarificationState = () => {
    setEditClarificationQuestion("");
    setEditClarificationSuggestion("");
    setEditClarificationAnswer("");
    setEditClarificationHistory([]);
  };

  const buildClarifiedEditRequest = (
    basePrompt: string,
    clarificationHistory: Array<{ question: string; answer: string }>,
  ): string => {
    if (clarificationHistory.length === 0) return basePrompt;
    const details = clarificationHistory
      .map((entry, idx) => `${idx + 1}. ${entry.question} -> ${entry.answer}`)
      .join("\n");
    return `${basePrompt}\n\nUser clarification details:\n${details}`;
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (!editPrompt.trim() && editAppAuth.length === 0) ||
      isEditing ||
      !project ||
      checkingAuthIntent ||
      checkingEditClarity
    )
      return;
    let resolvedClarificationHistory = [...editClarificationHistory];
    // Block auth/database intent in text prompts; force integration buttons.
    if (editPrompt.trim()) {
      setCheckingAuthIntent(true);
      const { hasAuthIntent, hasDatabaseIntent } =
        await detectIntegrationIntent(editPrompt);
      setCheckingAuthIntent(false);

      if (hasAuthIntent || hasDatabaseIntent) {
        showIntegrationBlockedFeedback({
          hasAuthIntent,
          hasDatabaseIntent,
          source: "edit",
        });
        return;
      }
    }
    setAuthPromptWarning(null);

    // Ask for clarification iteratively until request is precise enough.
    if (editPrompt.trim()) {
      let candidateHistory = [...resolvedClarificationHistory];

      if (editClarificationQuestion) {
        const clarificationAnswer = editClarificationAnswer.trim();
        if (!clarificationAnswer) {
          const suggestionLine = editClarificationSuggestion
            ? `\nDid you mean: ${editClarificationSuggestion}`
            : "";
          setAuthPromptWarning(
            `Please answer this before I edit:\n${editClarificationQuestion}${suggestionLine}`,
          );
          return;
        }

        const alreadyIncluded = candidateHistory.some(
          (entry) =>
            entry.question === editClarificationQuestion &&
            entry.answer === clarificationAnswer,
        );
        if (!alreadyIncluded) {
          candidateHistory = [
            ...candidateHistory,
            { question: editClarificationQuestion, answer: clarificationAnswer },
          ];
        }
      }

      setCheckingEditClarity(true);
      const clarity = await detectEditClarification(
        editPrompt.trim(),
        project.files.map((f) => f.path),
        candidateHistory,
      );
      setCheckingEditClarity(false);

      if (clarity.needsClarification) {
        setEditClarificationHistory(candidateHistory);
        setEditClarificationQuestion(clarity.question);
        setEditClarificationSuggestion(clarity.suggestedInterpretation || "");
        setEditClarificationAnswer("");

        const suggestionLine = clarity.suggestedInterpretation
          ? `\nDid you mean: ${clarity.suggestedInterpretation}`
          : "";
        setAuthPromptWarning(
          `Before I start editing, I need one detail:\n${clarity.question}${suggestionLine}`,
        );
        return;
      }

      // Clarity resolved: keep the accepted history and clear pending question.
      setEditClarificationHistory(candidateHistory);
      resolvedClarificationHistory = candidateHistory;
      setEditClarificationQuestion("");
      setEditClarificationSuggestion("");
      setEditClarificationAnswer("");
      setAuthPromptWarning(null);
    }

    // Check app token balance for edit + integrations
    const editCost = getEditAppCost();
    const appTokenBalance = userData?.appTokens || 0;
    if (appTokenBalance < editCost) {
      const deficit = editCost - appTokenBalance;
      setInsufficientTokenMessage(
        `This edit needs ${formatTokens(editCost)} app tokens but you only have ${formatTokens(appTokenBalance)}. Please purchase at least ${formatTokens(deficit)} more app token${deficit > 1 ? "s" : ""} to continue.`,
      );
      setTokenPurchaseAmount(0);
      setShowTokenPurchaseModal(true);
      return;
    }

    // Skip confirmation if user opted out
    if (skipEditTokenConfirm) {
      proceedWithEdit(resolvedClarificationHistory);
      return;
    }

    // Show confirmation modal before deducting token
    setShowTokenConfirmModal("edit");
    return;
  };

  const adjustAppTokens = async (amount: number, reason: string) => {
    if (!user || amount === 0) return;
    const response = await fetch("/api/tokens/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        reason,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed token adjustment");
    }
    await refreshUserData();
  };

  // Actually start the edit after user confirms token deduction
  const proceedWithEdit = async (
    clarificationHistoryOverride?: Array<{ question: string; answer: string }>,
  ) => {
    if (!project) return;
    setShowTokenConfirmModal(null);
    setIsEditing(true);
    editStartTimeRef.current = Date.now();
    setError("");
    setEditProgressMessages([]);
    setIsEditMinimized(false);

    // Deduct app tokens upfront (refundable if cancelled within 10s)
    if (user) {
      try {
        const editCost = getEditAppCost();
        await adjustAppTokens(-editCost, "Edit request token usage");
      } catch (err) {
        console.error("Error deducting tokens:", err);
      }
    }

    // Start progress simulation
    // Build context from current project
    const currentFiles = project.files
      .map((f) => `// ${f.path}\n${f.content}`)
      .join("\n\n---\n\n");

    // List all existing file paths
    const existingFilePaths = project.files.map((f) => f.path).join(", ");

    // Extract currently-used npm packages from existing code
    const existingPackages = new Set<string>();
    for (const f of project.files) {
      if (!f.path.match(/\.(tsx?|jsx?)$/)) continue;
      const importRegex =
        /(?:import\s+(?:[\s\S]*?\s+from\s+)?|require\s*\(\s*)['"]([^'".\/][^'"]*)['"]/g;
      let m;
      while ((m = importRegex.exec(f.content)) !== null) {
        let pkg = m[1];
        if (pkg.startsWith("@")) {
          const parts = pkg.split("/");
          pkg = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : pkg;
        } else {
          pkg = pkg.split("/")[0];
        }
        if (!pkg.startsWith("@/") && !pkg.startsWith("~")) {
          existingPackages.add(pkg);
        }
      }
    }
    const allowedPackagesList = Array.from(existingPackages).join(", ");

    // Build the user request text, including auth if selected
    const authLabels: string[] = [];
    if (editAppAuth.includes("username-password"))
      authLabels.push("Username/Password authentication");
    if (editAppAuth.includes("google"))
      authLabels.push("Google OAuth authentication");
    const baseUserRequest = editPrompt.trim()
      ? editPrompt.trim()
      : authLabels.length > 0
        ? `Add ${authLabels.join(" and ")} to the app`
        : editPrompt;
    const userRequest = buildClarifiedEditRequest(
      baseUserRequest,
      clarificationHistoryOverride ?? editClarificationHistory,
    );

    let editFullPrompt = `I have an existing React app with the following files:

${currentFiles}

USER'S EDIT REQUEST:
${userRequest}

ðŸŽ¯ CRITICAL INSTRUCTIONS:
1. Do EXACTLY what the user requested - nothing more, nothing less
2. DO NOT add features, components, or changes the user did not ask for
3. DO NOT refactor, reorganize, or "improve" code unless specifically asked
4. DO NOT change styling, colors, or layout unless specifically asked
5. DO NOT add comments, documentation, or explanations unless asked
6. DO NOT remove or modify content/features the user didn't mention
7. Only modify the specific parts needed to fulfill the user's exact request
8. Keep everything else EXACTLY as it was before
9. Keep all existing image src URLs unchanged unless the user explicitly requests image changes

ðŸ“¦ PACKAGE CONSTRAINT (CRITICAL - DO NOT VIOLATE):
The app currently uses ONLY these packages: ${allowedPackagesList}
- DO NOT import any npm package that is not in the list above
- DO NOT add framer-motion, gsap, three, @react-three/fiber, or any other new package
- Use Tailwind CSS classes for animations (animate-*, transition, hover:, etc.)
- Use inline SVGs or existing lucide-react icons for icons
- If the user's request absolutely requires a new package, use ONLY packages from this list: lucide-react, react, react-dom, next, @supabase/supabase-js, @supabase/ssr, @prisma/client
- Any import of a package NOT listed above will cause a build error

ðŸŽ¨ TAILWIND CSS RULES (CRITICAL - VIOLATIONS CAUSE BUILD ERRORS):
- NEVER use @apply with custom class names like bg-primary, text-secondary, bg-accent â€” these WILL crash the build
- ONLY use @apply with built-in Tailwind utilities: @apply px-4 py-2 bg-blue-600 text-white rounded-lg
- Use standard Tailwind color classes (blue-600, gray-900, emerald-500, etc.) instead of custom names
- Keep globals.css simple â€” just @tailwind base/components/utilities. Put styles in className attributes.`;

    // Add reference to uploaded files if any
    if (editFiles.length > 0) {
      const imageFiles = editFiles.filter((f) => f.type.startsWith("image/"));
      const pdfFiles = editFiles.filter((f) => f.type === "application/pdf");

      if (imageFiles.length > 0) {
        const imageUrlList = imageFiles
          .map(
            (f, i) =>
              `IMAGE ${i + 1} (${f.name}): ${f.downloadUrl || f.dataUrl}`,
          )
          .join("\n");
        editFullPrompt += `\n\nðŸ“· CRITICAL - User has uploaded ${imageFiles.length} image(s) that MUST be displayed in the website:

${imageUrlList}

ðŸš¨ YOU MUST:
1. Use these EXACT image URLs in your img src attributes
2. Example: <img src="${imageFiles[0]?.downloadUrl || ""}" alt="User uploaded image" className="..." />
3. Replace existing placeholder images with these actual images
4. Embed these images prominently in the relevant sections
5. DO NOT use placeholder images or third-party stock URLs - use ONLY the URLs listed above

The user expects to see their ACTUAL uploaded images in the updated website.`;
      }

      if (pdfFiles.length > 0) {
        const pdfUrlList = pdfFiles
          .map(
            (f, i) => `PDF ${i + 1} (${f.name}): ${f.downloadUrl || f.dataUrl}`,
          )
          .join("\n");
        editFullPrompt += `\n\nðŸ“„ CRITICAL - User has uploaded ${pdfFiles.length} PDF file(s):

${pdfUrlList}

ðŸš¨ YOU MUST:
1. The PDFs are uploaded for reference/context - analyze their content if shown visually
2. If the user wants to link to the PDFs, use these EXACT URLs: <a href="${pdfFiles[0]?.downloadUrl || ""}" download>Download PDF</a>
3. If the PDF contains design references, use them to inform the visual design changes
4. The user has uploaded these PDFs to provide context for the edit request`;
      }
    }

    // Add authentication requirements if selected for this edit
    if (editAppAuth.includes("username-password")) {
      editFullPrompt += `\n\nðŸ” AUTHENTICATION REQUIREMENT (ADD TO EXISTING APP):
Implement a complete username/password authentication system into this existing app:
1. User Registration (Sign Up) - with email/username and password
2. User Login with session management
3. Password Reset/Forgot Password functionality
4. Logout functionality
5. Protected routes that require authentication
6. User profile display
7. Use Supabase Auth (@supabase/supabase-js + @supabase/ssr) for authentication
8. Include proper form validation and error handling
9. Store user sessions securely
10. Add authentication UI components (login form, signup form, password reset form)

Integrate the authentication seamlessly into the existing app design and layout. Use Supabase Auth only.`;
    }
    if (editAppAuth.includes("google")) {
      editFullPrompt += `\n\nðŸ” AUTHENTICATION REQUIREMENT (ADD TO EXISTING APP):
Implement Google OAuth authentication into this existing app using Supabase Auth social sign-in:
1. "Sign in with Google" button with proper Google branding
2. Google OAuth via Supabase Auth provider configuration
3. Automatic user profile creation with Google account data
4. Session management for logged-in users
5. Logout functionality
6. Protected routes that require authentication
7. Display user's Google profile picture and name
8. Handle OAuth errors gracefully
9. Add loading states during authentication

Integrate the Google OAuth seamlessly into the existing app design and layout. Use Supabase Auth only.`;
    }
    editFullPrompt += buildDatabaseRequirementPrompt(
      currentAppDatabase,
      "existing",
    );

    editFullPrompt += `\n\nðŸš¨ CRITICAL REQUIREMENT:
You MUST return ALL of these exact files in your response: ${existingFilePaths}

Even if you only modify 1-2 files, you must include ALL files in the output JSON.
Do not skip any files. Keep unmodified files exactly as they are.`;

    // Save current project state as a snapshot before applying the edit
    if (currentProjectId && user) {
      try {
        const editPromptText =
          editPrompt.trim() ||
          (authLabels.length > 0 ? `Add ${authLabels.join(" and ")}` : "Edit");
        const historyId = `local_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        setEditHistory((prev) => [
          ...prev,
          {
            id: historyId,
            prompt: editPromptText,
            files: project.files,
            dependencies: project.dependencies || {},
            timestamp: new Date(),
          },
        ]);
      } catch (historyError) {
        console.error("Error saving edit history:", historyError);
      }
    }

    try {
      const hasUploadedEditImages = editFiles.some((f) =>
        f.type.startsWith("image/"),
      );
      const allowImageChanges =
        hasUploadedEditImages || isExplicitImageChangeRequest(editPrompt);

      const result = await generateCodeWithInngest(
        editFullPrompt,
        user?.uid || "anonymous",
        (message) => {
          setEditProgressMessages((prev) => [...prev, message]);
        },
      );

      // Store projectId for cancellation tracking (if using Inngest)
      if ("projectId" in result && result.projectId) {
        setCurrentGenerationProjectId(result.projectId);
      }

      setEditProgressMessages((prev) => [
        ...prev,
        "[6/7] Merging updated files into your project...",
      ]);

      // AI code generation: persist images and use generated files
      const persistedFiles = await persistGeneratedImages(result.files, {
        previousFiles: project.files,
        preserveExistingImages: !allowImageChanges,
      });
      const mergedProject = { ...result, files: persistedFiles };

      setProject(mergedProject);
      // Force preview sandbox re-init after AI edit to avoid stale iframe/HMR state.
      setPreviewKey((prev) => prev + 1);
      setEditPrompt("");
      clearEditClarificationState();
      setEditFiles([]); // Clear edit files after successful edit
      setEditAppAuth([]); // Reset edit auth after successful edit

      // Preview updates via file diff (Effect 2 in E2BPreview)

      // Update project in Firestore if we have a project ID
      if (currentProjectId && user) {
        try {
          await updateProjectInFirestore(currentProjectId, mergedProject);

          // Mark that there are unpublished changes
          if (publishedUrl) {
            setHasUnpublishedChanges(true);
          }
        } catch (saveError) {
          console.error("Error updating project:", saveError);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Edit failed");
      setCurrentGenerationProjectId(null); // Clear projectId on error
    } finally {
      setIsEditing(false);
      setCurrentGenerationProjectId(null); // Clear projectId after edit completes
      setTimeout(() => {
        setEditProgressMessages([]);
      }, 1000);
    }
  };

  const startGeneration = async (promptOverride?: string) => {
    const generationPrompt = promptOverride || prompt;
    generationCancelledRef.current = false;
    setStatus("loading");
    setError("");
    setProject(null);
    setProgressMessages([]);
    setGenerationPrompt(generationPrompt);
    setIsGenerationMinimized(false);
    setCurrentGenerationProjectId(null); // Clear any previous projectId

    let fullPrompt = generationPrompt;

    // Add authentication requirements based on user selection
    if (currentAppAuth.includes("username-password")) {
      fullPrompt += `\n\nðŸ” AUTHENTICATION REQUIREMENT:
Implement a complete username/password authentication system with the following features:
1. User Registration (Sign Up) - with email/username and password
2. User Login with session management
3. Password Reset/Forgot Password functionality
4. Logout functionality
5. Protected routes that require authentication
6. User profile display
7. Use Supabase Auth (@supabase/supabase-js + @supabase/ssr) for authentication
8. Include proper form validation and error handling
9. Store user sessions securely
10. Add authentication UI components (login form, signup form, password reset form)

Make sure the authentication is fully functional and integrated throughout the app. Use Supabase Auth only.`;
    }
    if (currentAppAuth.includes("google")) {
      fullPrompt += `\n\nðŸ” AUTHENTICATION REQUIREMENT:
Implement Google OAuth authentication with Supabase Auth (social sign-in) with the following features:
1. "Sign in with Google" button with proper Google branding
2. Google OAuth via Supabase Auth provider configuration
3. Automatic user profile creation with Google account data
4. Session management for logged-in users
5. Logout functionality
6. Protected routes that require authentication
7. Display user's Google profile picture and name
8. Handle OAuth errors gracefully
9. Add loading states during authentication

Make sure the Google OAuth is fully functional and integrated throughout the app. Use Supabase Auth only.`;
    }
    fullPrompt += buildDatabaseRequirementPrompt(currentAppDatabase, "new");

    if (uploadedFiles.length > 0) {
      const imageFiles = uploadedFiles.filter((f) =>
        f.type.startsWith("image/"),
      );
      const pdfFiles = uploadedFiles.filter(
        (f) => f.type === "application/pdf",
      );

      if (imageFiles.length > 0) {
        const imageUrlList = imageFiles
          .map(
            (f, i) =>
              `IMAGE ${i + 1} (${f.name}): ${f.downloadUrl || f.dataUrl}`,
          )
          .join("\n");
        fullPrompt += `\n\nðŸ“· CRITICAL - User has uploaded ${imageFiles.length} image(s) that MUST be displayed in the website:

${imageUrlList}

ðŸš¨ YOU MUST:
1. Use these EXACT image URLs in your img src attributes
2. Example: <img src="${imageFiles[0]?.downloadUrl || ""}" alt="User uploaded image" className="..." />
3. Embed these images prominently in the website (hero sections, galleries, cards, etc.)
4. DO NOT use placeholder images or third-party stock URLs - use ONLY the URLs listed above
5. The user uploaded these images specifically to see them in the generated website

The user expects to see their ACTUAL uploaded images in the final website.`;
      }

      if (pdfFiles.length > 0) {
        const pdfUrlList = pdfFiles
          .map(
            (f, i) => `PDF ${i + 1} (${f.name}): ${f.downloadUrl || f.dataUrl}`,
          )
          .join("\n");
        fullPrompt += `\n\nðŸ“„ CRITICAL - User has uploaded ${pdfFiles.length} PDF file(s):

${pdfUrlList}

ðŸš¨ YOU MUST:
1. The PDFs are uploaded for reference/context - analyze their content if shown visually
2. If the user wants to link to the PDFs, use these EXACT URLs: <a href="${pdfFiles[0]?.downloadUrl || ""}" download>Download PDF</a>
3. If the PDF contains design references, use them to inform the visual design of the website
4. The user has uploaded these PDFs to provide context or downloadable resources for the website`;
      }
    }

    try {
      // Real-time progress from Inngest
      let result = await generateCodeWithInngest(
        fullPrompt,
        user?.uid || "anonymous",
        (message) => {
          setProgressMessages((prev) => [...prev, message]);
        },
      );

      // Store projectId for cancellation tracking
      if (result.projectId) {
        setCurrentGenerationProjectId(result.projectId);
      }

      // If user cancelled while awaiting, discard the result
      if (generationCancelledRef.current) {
        setCurrentGenerationProjectId(null);
        return;
      }

      setProgressMessages((prev) => [
        ...prev,
        "[6/7] Saving generated project...",
      ]);

      // Check if authentication was generated
      // Auth stack is Supabase-based.
      // Persist generated images to Supabase Storage for stable URLs.
      setProgressMessages((prev) => [
        ...prev,
        "[6/7] Persisting generated images...",
      ]);
      const persistedFiles = await persistGeneratedImages(result.files);
      result = { ...result, files: persistedFiles };
      setProject(result);

      // Save project to Firestore
      if (user) {
        try {
          const authCost = getAuthAppCost(currentAppAuth);
          const projectId = await saveProjectToFirestore(
            result,
            generationPrompt,
            authCost,
          );
          setCurrentProjectId(projectId);

          // Refresh projects list
          loadSavedProjects();
        } catch (saveError) {
          console.error("Error saving project:", saveError);
        }
      }

      setStatus("success");
      setCurrentAppAuth([]); // Reset auth selection for next app
      setCurrentAppDatabase([]); // Keep database opt-in only for each new app
      setCurrentGenerationProjectId(null); // Clear projectId after successful completion
    } catch (err) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      progressIntervalRef.current = null;
      setCurrentGenerationProjectId(null); // Clear projectId on error
      // Don't show error if user cancelled
      if (generationCancelledRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : "Generation failed");
      setStatus("error");
    }
  };

  const handleSignInSuccess = () => {
    setShowSignInModal(false);
    if (pendingGeneration) {
      setPendingGeneration(false);
      startGeneration();
    }
  };

  // Handle generation submission
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim() || status === "loading" || checkingAuthIntent) return;
    // Block auth/database intent in text prompts; force integration buttons.
    if (prompt.trim()) {
      setCheckingAuthIntent(true);
      const { hasAuthIntent, hasDatabaseIntent } =
        await detectIntegrationIntent(prompt);
      setCheckingAuthIntent(false);

      if (hasAuthIntent || hasDatabaseIntent) {
        showIntegrationBlockedFeedback({
          hasAuthIntent,
          hasDatabaseIntent,
          source: "generation",
        });
        return;
      }
    }
    setAuthPromptWarning(null);

    // Check if user is logged in
    if (!user) {
      setPendingGeneration(true);
      setShowSignInModal(true);
      return;
    }

    // Check app token balance (project + selected integrations)
    const generationCost = getGenerationAppCost();
    const appTokenBalance = userData?.appTokens || 0;
    if (appTokenBalance < generationCost) {
      const deficit = generationCost - appTokenBalance;
      setInsufficientTokenMessage(
        `You need ${formatTokens(generationCost)} app tokens to continue but only have ${formatTokens(appTokenBalance)}. Please purchase at least ${formatTokens(deficit)} more app token${deficit > 1 ? "s" : ""} to continue.`,
      );
      setTokenPurchaseAmount(0);
      setShowTokenPurchaseModal(true);
      return;
    }

    // Show confirmation modal before deducting tokens
    setShowTokenConfirmModal("generation");
  };

  // Voice recording functions
  const startRecording = () => {
    // Clear any previous errors
    setVoiceError(null);

    // Check if browser supports speech recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError(
        "Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.",
      );
      setTimeout(() => setVoiceError(null), 5000);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
      setVoiceError(null);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("");
      setPrompt(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      if (event.error === "not-allowed") {
        setVoiceError(
          "Microphone access denied. Please allow microphone access in your browser settings and try again.",
        );
      } else if (event.error === "no-speech") {
        setVoiceError("No speech detected. Please try speaking again.");
      } else {
        setVoiceError("Voice input error. Please try again.");
      }
      setTimeout(() => setVoiceError(null), 5000);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const openInE2BSandbox = async () => {
    if (!project) return;

    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) {
      previewWindow.document.write(
        "<html><body style='font-family:system-ui;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;'>Preparing preview sandbox...</body></html>",
      );
    }

    const files = prepareSandboxFiles(project);

    try {
      const { url } = await createSandboxServer(files, undefined, {
        projectId: currentProjectId || undefined,
      });
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = url;
      } else if (!previewWindow) {
        window.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    } catch (err) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close();
      }
      console.error("Error opening E2B sandbox:", err);
      setError("Failed to create sandbox. Please try again.");
    }
  };

  const replaceFirstTextInProject = (
    sourceProject: ReactProject,
    from: string,
    to: string,
  ): ReactProject => {
    if (!from || from === to) return sourceProject;
    const files = sourceProject.files.map((f) => ({ ...f }));
    const mutableExt = /\.(tsx|ts|jsx|js|css|md|txt)$/;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!mutableExt.test(file.path)) continue;
      const idx = file.content.indexOf(from);
      if (idx === -1) continue;
      files[i] = {
        ...file,
        content: `${file.content.slice(0, idx)}${to}${file.content.slice(idx + from.length)}`,
      };
      return { ...sourceProject, files };
    }

    return sourceProject;
  };

  const handlePreviewTextEdited = async (
    originalText: string,
    updatedText: string,
  ) => {
    if (!textEditMode || !project) return;
    const from = originalText.trim();
    const to = updatedText.trim();
    if (!from || !to || from === to) return;

    const updatedProject = replaceFirstTextInProject(project, from, to);
    setProject(updatedProject);

    if (currentProjectId && user) {
      try {
        await updateProjectInFirestore(currentProjectId, updatedProject);
        if (publishedUrl) setHasUnpublishedChanges(true);
      } catch (err) {
        console.error("Failed to save text edit:", err);
      }
    }
  };

  const replaceNthImageSrcInProject = (
    sourceProject: ReactProject,
    fromSrc: string,
    toSrc: string,
    occurrence: number,
  ): ReactProject => {
    if (!fromSrc || !toSrc || fromSrc === toSrc) return sourceProject;
    const sourceCandidates = new Set<string>([fromSrc]);
    try {
      const parsed = new URL(fromSrc);
      sourceCandidates.add(parsed.pathname + parsed.search);
      sourceCandidates.add(parsed.pathname);
      if (parsed.pathname === "/_next/image") {
        const encoded = parsed.searchParams.get("url");
        if (encoded) {
          const decoded = decodeURIComponent(encoded);
          sourceCandidates.add(decoded);
          try {
            const decodedUrl = new URL(decoded);
            sourceCandidates.add(decodedUrl.pathname + decodedUrl.search);
            sourceCandidates.add(decodedUrl.pathname);
          } catch {
            // Decoded value may be relative.
          }
        }
      }
    } catch {
      // Non-absolute input is fine.
    }

    const files = sourceProject.files.map((f) => ({ ...f }));
    const mutableExt = /\.(tsx|ts|jsx|js|css|html|md|txt)$/;
    const srcAttrRe = /\bsrc\s*=\s*(?:\{)?["']([^"']+)["'](?:\})?/gi;

    let seen = 0;
    let replaced = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!mutableExt.test(file.path)) continue;

      const nextContent = file.content.replace(
        srcAttrRe,
        (match, src: string) => {
          if (!sourceCandidates.has(src) || replaced) return match;
          seen++;
          if (seen !== Math.max(1, occurrence)) return match;
          replaced = true;
          return match.replace(src, toSrc);
        },
      );

      if (nextContent !== file.content) {
        files[i] = { ...file, content: nextContent };
      }
      if (replaced) return { ...sourceProject, files };
    }

    // Fallback: replace first exact src if occurrence mapping fails.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!mutableExt.test(file.path)) continue;
      const nextContent = file.content.replace(
        srcAttrRe,
        (match, src: string) => {
          if (replaced || !sourceCandidates.has(src)) return match;
          replaced = true;
          return match.replace(src, toSrc);
        },
      );
      if (nextContent !== file.content) {
        files[i] = { ...file, content: nextContent };
      }
      if (replaced) break;
    }

    return replaced ? { ...sourceProject, files } : sourceProject;
  };

  const handlePreviewImageSelected = (payload: {
    src: string;
    resolvedSrc?: string;
    alt: string;
    occurrence: number;
  }) => {
    setSelectedPreviewImage(payload);
  };

  const handleSelectedImageReplacement = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const picked = e.target.files?.[0];
    if (!picked || !selectedPreviewImage || !project || !user) return;

    try {
      setIsReplacingSelectedImage(true);
      const uploaded = await startUpload([picked]);
      if (!uploaded || uploaded.length === 0 || !uploaded[0]?.url) {
        throw new Error("Failed to upload replacement image");
      }

      const replacementUrl = uploaded[0].url;
      const updatedProject = replaceNthImageSrcInProject(
        project,
        selectedPreviewImage.resolvedSrc || selectedPreviewImage.src,
        replacementUrl,
        selectedPreviewImage.occurrence,
      );
      setProject(updatedProject);
      setSelectedPreviewImage({
        src: replacementUrl,
        alt: selectedPreviewImage.alt,
        occurrence: selectedPreviewImage.occurrence,
      });

      if (currentProjectId) {
        await updateProjectInFirestore(currentProjectId, updatedProject);
        if (publishedUrl) setHasUnpublishedChanges(true);
      }

      // Show success feedback
      setTokenToast("Image replaced successfully! The preview will update momentarily.");
      setTimeout(() => setTokenToast(""), 4000);

      // Exit image select mode after successful replacement
      setImageSelectMode(false);
      setSelectedPreviewImage(null);
      setImageRegenerationPrompt("");
    } catch (err) {
      console.error("Failed to replace selected image:", err);
      setError(
        err instanceof Error ? err.message : "Failed to replace selected image",
      );
    } finally {
      setIsReplacingSelectedImage(false);
      if (replaceImageInputRef.current) {
        replaceImageInputRef.current.value = "";
      }
    }
  };

  const handleRegenerateSelectedImage = async () => {
    if (!selectedPreviewImage || !project || !user) return;

    // Validate prompt
    const promptText = imageRegenerationPrompt.trim();
    if (!promptText) {
      setError("Please enter a description for the image you want to generate");
      return;
    }

    // Check token balance (0.10 tokens for image regeneration)
    const IMAGE_REGEN_COST = 0.10;
    const appTokenBalance = userData?.appTokens || 0;
    if (appTokenBalance < IMAGE_REGEN_COST) {
      const deficit = IMAGE_REGEN_COST - appTokenBalance;
      setInsufficientTokenMessage(
        `Image regeneration costs ${formatTokens(IMAGE_REGEN_COST)} app tokens but you only have ${formatTokens(appTokenBalance)}. Please purchase at least ${formatTokens(deficit)} more token${deficit > 1 ? "s" : ""} to continue.`,
      );
      setTokenPurchaseAmount(0);
      setShowTokenPurchaseModal(true);
      return;
    }

    const escapeAttr = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

    const temporaryFiles = [
      {
        path: "app/__pocket_image_regen__.html",
        content: `<img src="REPLICATE_IMG_1" alt="${escapeAttr(promptText.slice(0, 220))}" />`,
      },
    ];

    try {
      setIsReplacingSelectedImage(true);

      // Deduct tokens first
      const response = await fetch("/api/tokens/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: -IMAGE_REGEN_COST,
          reason: "AI image regeneration",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to deduct tokens");
      }

      // Refresh user data to show updated token balance
      await refreshUserData();

      const persisted = await persistGeneratedImages(temporaryFiles, {
        isUserProvidedPrompt: true,
      });
      const html = persisted[0]?.content || "";
      const srcMatch = html.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      const regeneratedUrl = srcMatch?.[1];

      if (!regeneratedUrl || /^REPLICATE_IMG_/i.test(regeneratedUrl)) {
        throw new Error("AI regeneration did not produce a valid image URL");
      }

      const updatedProject = replaceNthImageSrcInProject(
        project,
        selectedPreviewImage.resolvedSrc || selectedPreviewImage.src,
        regeneratedUrl,
        selectedPreviewImage.occurrence,
      );
      setProject(updatedProject);

      if (currentProjectId) {
        await updateProjectInFirestore(currentProjectId, updatedProject);
        if (publishedUrl) setHasUnpublishedChanges(true);
      }

      // Show success feedback
      setTokenToast(`Image regenerated successfully! (${formatTokens(IMAGE_REGEN_COST)} tokens used)`);
      setTimeout(() => setTokenToast(""), 4000);

      // Exit image select mode and clear prompt after successful regeneration
      setImageSelectMode(false);
      setSelectedPreviewImage(null);
      setImageRegenerationPrompt("");
    } catch (err) {
      console.error("Failed to regenerate selected image:", err);
      setError(
        err instanceof Error ? err.message : "Failed to regenerate selected image",
      );
    } finally {
      setIsReplacingSelectedImage(false);
    }
  };

  // Calculate total unread ticket count
  const unreadTicketCount = supportTickets.reduce(
    (total, ticket) => total + (ticket.unreadAdminMessageCount || 0),
    0,
  );
  const isEditBusy = isEditing || checkingAuthIntent || checkingEditClarity;
  const isEditSubmitDisabled =
    (!editPrompt.trim() && editAppAuth.length === 0) || isEditBusy;
  const editPromptCount = editPrompt.trim().length;

  // SUCCESS STATE
  if (status === "success" && project) {
    return (
      <div className="h-screen bg-bg-primary flex">
        {/* Sidebar - only show when logged in */}
        {user && (
          <DashboardSidebar
            activeSection={activeSection}
            onSectionChange={(section) => {
              setActiveSection(section);
              if (section !== "create" && !isEditing) {
                // Don't reset status if currently editing
                setStatus("idle");
                setEditPrompt("");
                clearEditClarificationState();
              }
              if (section === "support") loadSupportTickets();
              if (section === "admin") loadAdminTickets();
            }}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={setIsSidebarCollapsed}
            onBuyTokens={() => {
              setTokenPurchaseAmount(0);
              setShowTokenPurchaseModal(true);
            }}
            unreadTicketCount={unreadTicketCount}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="flex-shrink-0 border-b border-border-primary bg-bg-secondary/50 backdrop-blur-lg z-10">
            <div className="px-4 h-14 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-px bg-border-secondary" />
                <span className="inline-flex items-center gap-1.5 text-xs text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-full group relative cursor-help">
                  <svg
                    className="w-3 h-3 text-violet-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                    />
                  </svg>
                  App Tokens: {formatTokens(userData?.appTokens || 0)}
                  <span className="hidden group-hover:block absolute top-full left-0 mt-2 w-52 p-2 bg-border-secondary text-text-secondary text-xs rounded-lg shadow-xl z-50">
                    Edits and integrations use app tokens.
                  </span>
                </span>

                {/* View Code Button */}
                <button
                  onClick={() => setShowCodeViewer(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-border-secondary rounded-lg transition"
                  title="View project code"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                  Code
                </button>

                <button
                  onClick={() =>
                    setTextEditMode((v) => {
                      const next = !v;
                      if (next) {
                        setImageSelectMode(false);
                        setSelectedPreviewImage(null);
                        setImageRegenerationPrompt("");
                      }
                      return next;
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    textEditMode
                      ? "text-emerald-800 bg-emerald-100 border border-emerald-300 dark:text-emerald-200 dark:bg-emerald-600/30 dark:border-emerald-500/40"
                      : "text-text-secondary bg-bg-tertiary hover:bg-border-secondary"
                  }`}
                  title="Edit text directly inside preview"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 10h8M8 14h5M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4V8a2 2 0 012-2z"
                    />
                  </svg>
                  Text Edit
                </button>

                <button
                  onClick={() =>
                    setImageSelectMode((v) => {
                      const next = !v;
                      if (next) {
                        setTextEditMode(false);
                      } else {
                        setSelectedPreviewImage(null);
                        setImageRegenerationPrompt("");
                      }
                      return next;
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    imageSelectMode
                      ? "text-orange-900 bg-orange-100 border border-orange-300 dark:text-orange-200 dark:bg-orange-600/30 dark:border-orange-500/40"
                      : "text-text-secondary bg-bg-tertiary hover:bg-border-secondary"
                  }`}
                  title="Select a specific image from preview and replace only that image"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5V6a3 3 0 013-3h12a3 3 0 013 3v10.5m-18 0l4.5-4.5a2.25 2.25 0 013.182 0L15 16.5m-12 0h18M15 10.5h.008v.008H15V10.5z"
                    />
                  </svg>
                  Image Replace
                </button>
              </div>

              {/* Device Preview Toggle */}
              <div className="hidden sm:flex items-center gap-1 bg-bg-tertiary/50 rounded-lg p-1">
                <button
                  onClick={() => setPreviewMode("mobile")}
                  className={`p-1.5 rounded-md transition ${
                    previewMode === "mobile"
                      ? "bg-blue-600 text-white"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  title="Mobile view (375px)"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setPreviewMode("tablet")}
                  className={`p-1.5 rounded-md transition ${
                    previewMode === "tablet"
                      ? "bg-blue-600 text-white"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  title="Tablet view (768px)"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setPreviewMode("desktop")}
                  className={`p-1.5 rounded-md transition ${
                    previewMode === "desktop"
                      ? "bg-blue-600 text-white"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  title="Desktop view (full width)"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Open in E2B Sandbox Button */}
                <button
                  onClick={openInE2BSandbox}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm hover:shadow-md"
                  title="Open in E2B Sandbox"
                >
                  Preview
                </button>

                {/* Export Dropdown */}
                <div className="relative export-dropdown">
                  <button
                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-border-secondary rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export project"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Export
                    <svg
                      className={`w-3 h-3 transition-transform ${showExportDropdown ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {showExportDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-bg-tertiary border border-border-secondary rounded-lg shadow-xl z-50">
                      <button
                        onClick={exportToGitHub}
                        disabled={isExporting}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-text-secondary hover:bg-border-secondary transition disabled:opacity-50 disabled:cursor-not-allowed rounded-t-lg"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        Export to GitHub
                      </button>
                      <button
                        onClick={exportToVSCode}
                        disabled={isExporting}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-text-secondary hover:bg-border-secondary transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                        </svg>
                        Export to VS Code
                      </button>
                      <button
                        onClick={exportToCursor}
                        disabled={isExporting}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-text-secondary hover:bg-border-secondary transition disabled:opacity-50 disabled:cursor-not-allowed rounded-b-lg"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm-1 4v12l8-6-8-6z" />
                        </svg>
                        Export to Cursor
                      </button>
                    </div>
                  )}
                </div>
                {publishedUrl ? (
                  hasUnpublishedChanges ? (
                    <button
                      onClick={publishProject}
                      disabled={isPublishing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPublishing ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Publishing...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                          Publish Changes
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowDomainModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg transition"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                        />
                      </svg>
                      Published
                    </button>
                  )
                ) : (
                  <button
                    onClick={publishProject}
                    disabled={isPublishing || !currentProjectId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPublishing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        Publish
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    setStatus("idle");
                    setEditPrompt("");
                    clearEditClarificationState();
                    setPublishedUrl(null);
                    setDeploymentId(null);
                    setCurrentProjectId(null);
                    setHasUnpublishedChanges(false);
                    setEditHistory([]);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-border-secondary rounded-lg transition"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  New
                </button>
              </div>
            </div>
          </header>

          {imageSelectMode && (
            <div className="px-4 py-2.5 border-b border-border-primary bg-orange-500/10">
              <input
                ref={replaceImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSelectedImageReplacement}
              />
              <div className="space-y-3">
                {!selectedPreviewImage ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <svg
                      className="w-4 h-4 text-orange-400 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-xs font-medium text-orange-300">
                      Click any image in the preview to select it for replacement
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-500/30">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-md bg-orange-500/30 flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-orange-300"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-orange-200">
                          Image Selected
                        </p>
                        <p className="text-xs text-text-secondary truncate mt-0.5">
                          {selectedPreviewImage.alt || selectedPreviewImage.src}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPreviewImage(null);
                          setImageRegenerationPrompt("");
                        }}
                        className="flex-shrink-0 p-1 rounded-md hover:bg-orange-500/20 transition text-text-secondary hover:text-text-primary"
                        title="Clear selection"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Upload File Option */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => replaceImageInputRef.current?.click()}
                        disabled={isReplacingSelectedImage}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25"
                      >
                        {isReplacingSelectedImage ? (
                          <>
                            <svg
                              className="w-3.5 h-3.5 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                              />
                            </svg>
                            Upload File
                          </>
                        )}
                      </button>
                    </div>

                    {/* AI Regeneration Section */}
                    <div className="space-y-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4 text-blue-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                            />
                          </svg>
                          <span className="text-xs font-semibold text-blue-300">
                            AI Regenerate
                          </span>
                        </div>
                        <span className="text-xs font-medium text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded">
                          {formatTokens(0.10)} tokens
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={imageRegenerationPrompt}
                          onChange={(e) => setImageRegenerationPrompt(e.target.value)}
                          placeholder="Describe the image you want to generate..."
                          disabled={isReplacingSelectedImage}
                          className="w-full px-3 py-2 text-xs bg-bg-tertiary/50 border border-blue-500/30 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && imageRegenerationPrompt.trim()) {
                              e.preventDefault();
                              handleRegenerateSelectedImage();
                            }
                          }}
                        />
                        {imageRegenerationPrompt.trim() && (
                          <button
                            onClick={() => setImageRegenerationPrompt("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary transition"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>

                      <button
                        onClick={handleRegenerateSelectedImage}
                        disabled={isReplacingSelectedImage || !imageRegenerationPrompt.trim()}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25"
                      >
                        {isReplacingSelectedImage ? (
                          <>
                            <svg
                              className="w-3.5 h-3.5 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                              />
                            </svg>
                            Generate with AI
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Content Area - Preview + Edit Panel */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Preview Area */}
            <div className="flex-1 overflow-hidden relative min-h-0 bg-slate-950/95">
              {/* Editing overlay */}
              {isEditing && !isEditMinimized && (
                <div className="absolute inset-0 bg-bg-primary/95 backdrop-blur-sm z-50">
                  <GenerationProgress
                    prompt={`Editing: ${editPrompt}`}
                    progressMessages={editProgressMessages}
                    onCancel={() => {
                      setShowCancelConfirm("edit");
                    }}
                    isMinimized={false}
                    onToggleMinimize={() => setIsEditMinimized(true)}
                  />
                </div>
              )}

              {/* Editing minimized banner */}
              {isEditing && isEditMinimized && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                  <button
                    onClick={() => setIsEditMinimized(false)}
                    className="flex items-center gap-3 px-4 py-2 bg-blue-900/40 border-2 border-dashed border-blue-500/40 rounded-lg hover:bg-blue-900/60 transition backdrop-blur-sm"
                  >
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <span className="text-sm text-text-primary font-medium">
                      Editing in progress...
                    </span>
                    <span className="text-xs text-blue-300">
                      (Click to view)
                    </span>
                  </button>
                </div>
              )}

              {/* Device Frame Container */}
              <div
                className={`h-full flex items-center justify-center p-4 ${
                  previewMode === "desktop"
                    ? ""
                    : "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-700/20 to-transparent"
                }`}
              >
                <div
                  className={`h-full transition-all duration-300 ${
                    previewMode === "mobile"
                      ? "w-[375px] rounded-[2rem] border-[8px] border-slate-700 shadow-2xl shadow-black/60 overflow-hidden"
                      : previewMode === "tablet"
                        ? "w-[768px] rounded-[1.5rem] border-[6px] border-slate-700 shadow-2xl shadow-black/60 overflow-hidden"
                        : "w-full"
                  }`}
                >
                  {/* Device Notch for Mobile */}
                  {previewMode === "mobile" && (
                    <div className="bg-slate-700 h-6 flex items-center justify-center">
                      <div className="w-20 h-4 bg-slate-800 rounded-full" />
                    </div>
                  )}

                  {/* E2B Preview */}
                  <div
                    className={
                      previewMode !== "desktop"
                        ? "h-[calc(100%-24px)]"
                        : "h-full"
                    }
                  >
                    <E2BPreview
                      project={project}
                      previewKey={previewKey}
                      projectId={currentProjectId}
                      textEditMode={textEditMode}
                      imageSelectMode={imageSelectMode}
                      onTextEdited={handlePreviewTextEdited}
                      onImageSelected={handlePreviewImageSelected}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Panel - Right on desktop, Bottom on mobile/tablet */}
            <div className="flex-shrink-0 lg:w-56 xl:w-64 border-t lg:border-t-0 lg:border-l border-border-primary bg-bg-secondary/80 backdrop-blur-lg flex flex-col">
              {/* Panel Header - Desktop only */}

              {/* Low token balance indicator */}
              {(userData?.appTokens || 0) < 10 && (
                <div className="px-4 py-3 bg-gradient-to-r from-violet-500/10 to-blue-500/10 border-b border-violet-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-4 h-4 text-violet-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                      />
                    </svg>
                    <span className="text-xs font-medium text-violet-300">
                      Low App Tokens
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mb-2">
                    {formatTokens(userData?.appTokens || 0)} token
                    {(userData?.appTokens || 0) !== 1 ? "s" : ""} remaining.
                  </p>
                  <button
                    onClick={() => {
                      setTokenPurchaseAmount(0);
                      setShowTokenPurchaseModal(true);
                    }}
                    className="w-full px-3 py-1.5 bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 text-white text-xs font-medium rounded-lg transition"
                  >
                    Buy App Tokens
                  </button>
                </div>
              )}

              {/* Edit History */}
              {editHistory.length > 0 && (
                <div className="border-b border-border-primary">
                  <button
                    onClick={() => setShowEditHistory(!showEditHistory)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-tertiary/50 transition"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-3.5 h-3.5 text-text-tertiary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-xs font-medium text-text-secondary">
                        Edit History ({editHistory.length})
                      </span>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 text-text-muted transition-transform ${showEditHistory ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {showEditHistory && (
                    <div className="max-h-48 overflow-y-auto">
                      {[...editHistory].reverse().map((entry, idx) => (
                        <div
                          key={entry.id}
                          className="px-4 py-2 border-t border-border-primary/50 hover:bg-bg-tertiary/30 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-xs text-text-secondary truncate"
                                title={entry.prompt}
                              >
                                {entry.prompt}
                              </p>
                              <p className="text-[10px] text-text-muted mt-0.5">
                                {entry.timestamp.toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {idx === 0 && (
                                  <span className="ml-1.5 text-blue-400">
                                    (latest)
                                  </span>
                                )}
                              </p>
                            </div>
                            <button
                              onClick={() => rollbackToVersion(entry)}
                              disabled={isRollingBack || isEditing}
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-md transition disabled:opacity-50"
                              title="Rollback to this version"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                                />
                              </svg>
                              Rollback
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Edit Error */}
              {error && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-300 dark:bg-red-500/10 dark:border-red-500/20">
                  <p className="text-sm text-red-800 dark:text-red-300">
                    {error}
                  </p>
                </div>
              )}

              {/* Hidden file input for edit */}
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleEditFileUpload}
                className="hidden"
              />

              {/* Uploaded edit files */}
              {editFiles.length > 0 && (
                <div className="px-4 py-2 border-b border-border-primary">
                  <div className="flex flex-wrap gap-2">
                    {editFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-bg-tertiary/50 border border-border-secondary rounded-lg text-xs"
                      >
                        {file.type.startsWith("image/") ? (
                          <svg
                            className="w-3 h-3 text-blue-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-3 h-3 text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                        <span className="text-text-secondary max-w-[80px] truncate">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEditFile(idx)}
                          className="text-text-muted hover:text-red-400 transition"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Auth prompt warning for edit */}
              {authPromptWarning && (
                <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-xl flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-medium whitespace-pre-line">
                      {authPromptWarning}
                    </p>
                    {editClarificationQuestion && (
                      <div className="mt-3 space-y-2">
                        <label className="block text-[11px] font-medium text-amber-900 dark:text-amber-100">
                          Clarification answer
                        </label>
                        <textarea
                          value={editClarificationAnswer}
                          onChange={(e) => setEditClarificationAnswer(e.target.value)}
                          rows={2}
                          placeholder="Type your clarification so the edit is accurate..."
                          className="w-full rounded-lg border border-amber-300/80 bg-white/70 dark:bg-amber-950/30 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-100 placeholder:text-amber-700/70 dark:placeholder:text-amber-300/70 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          {editClarificationSuggestion && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditClarificationAnswer(
                                  editClarificationSuggestion,
                                )
                              }
                              className="px-2 py-1 rounded-md text-[11px] font-medium bg-amber-200/70 text-amber-900 hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-200 dark:hover:bg-amber-400/30 transition"
                            >
                              Use “Did you mean” suggestion
                            </button>
                          )}
                          <span className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
                            Submit edit again after answering to continue.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthPromptWarning(null);
                      clearEditClarificationState();
                    }}
                    className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 transition"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}

              {/* Edit Form */}
              <form onSubmit={handleEdit} className="flex-1 flex flex-col p-4">
                {/* Desktop: Vertical layout with taller textarea */}
                <div className="hidden lg:flex flex-col gap-3.5 flex-1">
                  {/* Prompt area with auth tags */}
                  <div className="flex-1 flex flex-col rounded-2xl border border-border-secondary bg-gradient-to-b from-bg-tertiary/65 to-bg-tertiary/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/15 overflow-hidden transition">
                    <div className="flex items-start justify-between gap-4 px-4 pt-3 pb-2 border-b border-border-secondary/70">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary">
                          Edit Prompt
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/10 text-[11px] text-blue-400 border border-blue-500/20 whitespace-nowrap">
                        Enter to submit
                      </span>
                    </div>
                    {/* Auth prefill tags (non-editable) */}
                    {editAppAuth.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1.5">
                        {editAppAuth.includes("username-password") && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                              />
                            </svg>
                            Add Password Authentication
                            <button
                              type="button"
                              onClick={() =>
                                setEditAppAuth(
                                  editAppAuth.filter(
                                    (a) => a !== "username-password",
                                  ),
                                )
                              }
                              className="ml-0.5 text-blue-400/60 hover:text-blue-300 transition"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </span>
                        )}
                        {editAppAuth.includes("google") && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium">
                            <svg
                              className="w-3 h-3"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Add Google Authentication
                            <button
                              type="button"
                              onClick={() =>
                                setEditAppAuth(
                                  editAppAuth.filter((a) => a !== "google"),
                                )
                              }
                              className="ml-0.5 text-blue-400/60 hover:text-blue-300 transition"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                    <textarea
                      ref={editTextareaRef}
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (
                            (editPrompt.trim() || editAppAuth.length > 0) &&
                            !isEditing
                          )
                            handleEdit(e);
                        }
                      }}
                      placeholder={
                        editAppAuth.length > 0
                          ? "Add additional instructions (optional)..."
                          : "Describe changes you want to make...\n\nExamples:\n- Change the color scheme to blue\n- Add a contact form\n- Make the header sticky\n- Add dark mode toggle"
                      }
                      disabled={isEditing}
                      className="flex-1 min-h-[120px] px-4 py-3.5 bg-transparent text-text-primary placeholder-text-muted focus:outline-none resize-none text-sm leading-relaxed disabled:opacity-50"
                    />
                    <div className="flex items-center justify-between px-4 py-2 border-t border-border-secondary/70">
                      <p className="text-[11px] text-text-muted">
                        Shift+Enter for new line
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {editPromptCount} chars
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border-secondary bg-bg-tertiary/35 px-3 py-2">
                    <p className="text-xs font-medium text-text-muted mb-2">
                      Add Integrations:
                    </p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditAppAuth(
                              editAppAuth.includes("username-password")
                                ? editAppAuth.filter(
                                    (a) => a !== "username-password",
                                  )
                                : [...editAppAuth, "username-password"],
                            )
                          }
                          disabled={isEditing}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                            editAppAuth.includes("username-password")
                              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                              : "bg-bg-tertiary/50 text-text-tertiary border border-border-secondary hover:border-text-faint hover:text-text-secondary"
                          } disabled:opacity-50`}
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                            />
                          </svg>
                          Password
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditAppAuth(
                              editAppAuth.includes("google")
                                ? editAppAuth.filter((a) => a !== "google")
                                : [...editAppAuth, "google"],
                            )
                          }
                          disabled={isEditing}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                            editAppAuth.includes("google")
                              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                              : "bg-bg-tertiary/50 text-text-tertiary border border-border-secondary hover:border-text-faint hover:text-text-secondary"
                          } disabled:opacity-50`}
                        >
                          <svg
                            className="w-3 h-3"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          Google
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDbModal(true)}
                        disabled={isEditing}
                        className={`inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          currentAppDatabase.length > 0
                            ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-bg-tertiary/50 text-text-tertiary border border-border-secondary hover:border-text-faint hover:text-text-secondary"
                        } disabled:opacity-50`}
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375"
                          />
                        </svg>
                        Database
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={isEditing}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-3 bg-bg-tertiary/60 border border-border-secondary hover:bg-bg-tertiary hover:border-text-faint text-text-secondary text-sm font-medium rounded-xl transition disabled:opacity-50"
                      title="Attach image or PDF"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                        />
                      </svg>
                    </button>
                    <button
                      type="submit"
                      disabled={isEditSubmitDisabled}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isEditing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Updating...
                        </>
                      ) : checkingAuthIntent || checkingEditClarity ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                          Apply Changes
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-text-muted text-center">
                    Press Enter to apply edits quickly
                  </p>
                </div>

                {/* Mobile/Tablet: Layout */}
                <div className="flex lg:hidden flex-col gap-2.5">
                  {/* Auth selector for mobile edit */}
                  <div className="px-2 py-1.5 rounded-lg border border-border-secondary bg-bg-tertiary/45 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-text-muted">
                        Add:
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditAppAuth(
                            editAppAuth.includes("username-password")
                              ? editAppAuth.filter(
                                  (a) => a !== "username-password",
                                )
                              : [...editAppAuth, "username-password"],
                          )
                        }
                        disabled={isEditing}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                          editAppAuth.includes("username-password")
                            ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                            : "bg-bg-tertiary/50 text-text-tertiary border border-border-secondary hover:border-text-faint"
                        } disabled:opacity-50`}
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                          />
                        </svg>
                        Password
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditAppAuth(
                            editAppAuth.includes("google")
                              ? editAppAuth.filter((a) => a !== "google")
                              : [...editAppAuth, "google"],
                          )
                        }
                        disabled={isEditing}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                          editAppAuth.includes("google")
                            ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                            : "bg-bg-tertiary/50 text-text-tertiary border border-border-secondary hover:border-text-faint"
                        } disabled:opacity-50`}
                      >
                        <svg
                          className="w-3 h-3"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Google
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDbModal(true)}
                      disabled={isEditing}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                        currentAppDatabase.length > 0
                          ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-bg-tertiary/50 text-text-tertiary border border-border-secondary hover:border-text-faint"
                      } disabled:opacity-50`}
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375"
                        />
                      </svg>
                      Database
                    </button>
                  </div>
                  {/* Auth prefill tags for mobile */}
                  {editAppAuth.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {editAppAuth.includes("username-password") && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-md text-xs">
                          Add Password Auth
                          <button
                            type="button"
                            onClick={() =>
                              setEditAppAuth(
                                editAppAuth.filter(
                                  (a) => a !== "username-password",
                                ),
                              )
                            }
                            className="text-blue-400/60 hover:text-blue-300"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </span>
                      )}
                      {editAppAuth.includes("google") && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-md text-xs">
                          Add Google Auth
                          <button
                            type="button"
                            onClick={() =>
                              setEditAppAuth(
                                editAppAuth.filter((a) => a !== "google"),
                              )
                            }
                            className="text-blue-400/60 hover:text-blue-300"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={isEditing}
                      className="p-3 bg-bg-tertiary/60 border border-border-secondary hover:bg-bg-tertiary hover:border-text-faint text-text-secondary rounded-xl transition disabled:opacity-50"
                      title="Attach file"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                        />
                      </svg>
                    </button>
                    <div className="flex-1 relative">
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (
                              (editPrompt.trim() || editAppAuth.length > 0) &&
                              !isEditing
                            )
                              handleEdit(e);
                          }
                        }}
                        placeholder={
                          editAppAuth.length > 0
                            ? "Additional instructions (optional)..."
                            : "Describe changes..."
                        }
                        rows={1}
                        disabled={isEditing}
                        className="w-full px-4 py-3 bg-bg-tertiary/55 border border-border-secondary rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 resize-none text-sm disabled:opacity-50"
                        style={{ minHeight: "46px", maxHeight: "120px" }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isEditSubmitDisabled}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isEditing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span className="hidden sm:inline">Updating...</span>
                        </>
                      ) : checkingAuthIntent || checkingEditClarity ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span className="hidden sm:inline">Checking...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                          <span className="hidden sm:inline">Edit</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] text-text-muted">
                      Shift+Enter for new line
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {editPromptCount} chars
                    </p>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Domain Modal */}
        <DomainSettingsModal
          isOpen={showDomainModal}
          onClose={() => setShowDomainModal(false)}
          publishedUrl={publishedUrl}
          customDomain={customDomain}
          onCustomDomainChange={setCustomDomain}
          onConnectDomain={connectDomain}
          hasUnpublishedChanges={hasUnpublishedChanges}
          isPublishing={isPublishing}
          onPublish={publishProject}
          onUnpublish={unpublishProject}
        />

        {/* GitHub Export Modal */}
        <GitHubExportModal
          isOpen={showGitHubModal}
          onClose={() => setShowGitHubModal(false)}
          githubToken={githubToken}
          onTokenChange={setGithubToken}
          githubRepoName={githubRepoName}
          onRepoNameChange={setGithubRepoName}
          githubPrivate={githubPrivate}
          onPrivateChange={setGithubPrivate}
          githubExportStatus={githubExportStatus}
          githubExportMessage={githubExportMessage}
          githubRepoUrl={githubRepoUrl}
          onPushToGitHub={pushToGitHub}
        />

        {/* Export Success Toast */}
        {exportSuccessMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3 px-5 py-3 bg-emerald-600 text-white rounded-xl shadow-2xl text-sm font-medium">
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {exportSuccessMessage}
              <button
                onClick={() => setExportSuccessMessage("")}
                className="ml-2 p-0.5 hover:bg-emerald-500 rounded transition"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Token Payment Toast */}
        {tokenToast && (
          <div className="fixed top-6 right-6 z-50 anim-fade-up max-w-sm">
            <div className="flex items-start gap-3 px-5 py-4 bg-bg-secondary border border-border-primary rounded-xl shadow-2xl shadow-black/20">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center mt-0.5">
                <svg
                  className="w-4.5 h-4.5 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary mb-0.5">
                  Tokens Added
                </p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {tokenToast}
                </p>
              </div>
              <button
                onClick={() => setTokenToast("")}
                className="flex-shrink-0 p-1 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          isOpen={showDeleteModal && !!projectToDelete}
          onClose={() => {
            setShowDeleteModal(false);
            setProjectToDelete(null);
          }}
          onConfirm={() => {
            if (projectToDelete) deleteProject(projectToDelete);
          }}
        />

        {/* Token Purchase Modal (success view) */}
        <TokenPurchaseModal
          isOpen={showTokenPurchaseModal}
          onClose={() => {
            setShowTokenPurchaseModal(false);
            setInsufficientTokenMessage(null);
          }}
          amount={tokenPurchaseAmount}
          onAmountChange={setTokenPurchaseAmount}
          appTokens={userData?.appTokens || 0}
          insufficientMessage={insufficientTokenMessage}
          isProcessing={isProcessingTokenPurchase}
          onPurchase={purchaseTokens}
        />

        {/* Cancel Confirmation Modal (success view) */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="relative px-6 pt-8 pb-4 text-center">
                <button
                  onClick={() => setShowCancelConfirm(null)}
                  className="absolute top-4 right-4 p-1 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-amber-500/20 rounded-2xl">
                  <svg
                    className="w-8 h-8 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-text-primary mb-2">
                  {showCancelConfirm === "generation"
                    ? "Cancel Generation?"
                    : "Cancel Editing?"}
                </h3>
                <p className="text-text-tertiary text-sm">
                  {showCancelConfirm === "generation"
                    ? "The AI is still generating your app. Are you sure you want to cancel? Progress will be lost."
                    : "The AI is still applying your edits. Are you sure you want to cancel? Changes will be lost."}
                </p>
                {showCancelConfirm === "edit" &&
                  Date.now() - editStartTimeRef.current < 10000 && (
                    <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <p className="text-xs text-emerald-300">
                        Cancelling now will refund your app tokens.
                      </p>
                    </div>
                  )}
                {showCancelConfirm === "edit" &&
                  Date.now() - editStartTimeRef.current >= 10000 && (
                    <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <p className="text-xs text-amber-300">
                        More than 10 seconds have passed. Tokens cannot be
                        refunded.
                      </p>
                    </div>
                  )}
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(null)}
                  className="flex-1 px-4 py-2.5 text-text-secondary bg-bg-tertiary hover:bg-border-secondary rounded-xl text-sm font-medium transition"
                >
                  Keep Going
                </button>
                <button
                  onClick={async () => {
                    if (showCancelConfirm === "generation") {
                      confirmCancelGeneration();
                    } else {
                      const withinRefundWindow =
                        Date.now() - editStartTimeRef.current < 10000;
                      setIsEditing(false);
                      setEditProgressMessages([]);
                      setShowCancelConfirm(null);
                      if (withinRefundWindow && user) {
                        try {
                          const editCost = getEditAppCost();
                          await adjustAppTokens(
                            editCost,
                            "Edit cancelled refund",
                          );
                        } catch (err) {
                          console.error("Error refunding tokens:", err);
                        }
                      }
                    }
                  }}
                  className="flex-1 px-4 py-2.5 text-white bg-red-600 hover:bg-red-500 rounded-xl text-sm font-medium transition"
                >
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Code Viewer Modal */}
        {showCodeViewer && project && (
          <CodeViewer
            files={project.files}
            onClose={() => setShowCodeViewer(false)}
          />
        )}
      </div>
    );
  }

  // Content for Create section (main generation UI)
  const CreateContent = () => {
    return (
      <CreateContentComponent
        user={user}
        status={status}
        isGenerationMinimized={isGenerationMinimized}
        generationPrompt={generationPrompt}
        progressMessages={progressMessages}
        error={error}
        prompt={prompt}
        uploadedFiles={uploadedFiles}
        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
        currentAppAuth={currentAppAuth}
        currentAppDatabase={currentAppDatabase}
        isRecording={isRecording}
        voiceError={voiceError}
        authPromptWarning={authPromptWarning}
        checkingAuthIntent={checkingAuthIntent}
        setIsGenerationMinimized={setIsGenerationMinimized}
        cancelGeneration={cancelGeneration}
        setShowSignInModal={setShowSignInModal}
        setPrompt={setPrompt}
        handleFileUpload={handleFileUpload}
        removeFile={removeFile}
        startRecording={startRecording}
        stopRecording={stopRecording}
        setVoiceError={setVoiceError}
        setShowAuthModal={setShowAuthModal}
        setCurrentAppAuth={setCurrentAppAuth}
        handleGenerate={handleGenerate}
        setShowDbModal={setShowDbModal}
        setAuthPromptWarning={setAuthPromptWarning}
        textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
      />
    );
  };

  // Projects content showing saved projects
  // ProjectsContent component is now extracted

  // SettingsContent component is now extracted

  // SupportContent component is now extracted
  const SupportContent = () => {
    return (
      <SupportContentComponent
        supportTickets={supportTickets}
        selectedTicketId={selectedTicketId}
        ticketSubmittedNotice={ticketSubmittedNotice}
        ticketCategory={ticketCategory}
        ticketProjectId={ticketProjectId}
        ticketSubject={ticketSubject}
        ticketDescription={ticketDescription}
        savedProjects={savedProjects}
        isSubmittingTicket={isSubmittingTicket}
        loadingTickets={loadingTickets}
        replyingToTicketId={replyingToTicketId}
        userReplyText={userReplyText}
        setTicketCategory={setTicketCategory}
        setTicketProjectId={setTicketProjectId}
        setTicketSubject={setTicketSubject}
        setTicketDescription={setTicketDescription}
        submitSupportTicket={submitSupportTicket}
        loadSupportTickets={loadSupportTickets}
        handleTicketClick={handleTicketClick}
        setReplyingToTicketId={setReplyingToTicketId}
        setUserReplyText={setUserReplyText}
        userReplyToTicket={userReplyToTicket}
      />
    );
  };

  // Admin Content (visible only to admin)
  const AdminContent = () => (
    <div className="max-w-3xl mx-auto w-full p-4 h-full flex flex-col overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        <button
          onClick={() => setAdminTab("support")}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            adminTab === "support"
              ? "bg-blue-600 text-white"
              : "bg-bg-tertiary text-text-tertiary hover:text-text-primary"
          }`}
        >
          Support Tickets
        </button>
        <button
          onClick={() => setAdminTab("maintenance")}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            adminTab === "maintenance"
              ? "bg-orange-600 text-white"
              : "bg-bg-tertiary text-text-tertiary hover:text-text-primary"
          }`}
        >
          Maintenance Mode
        </button>
      </div>

      {/* Tab Content */}
      {adminTab === "maintenance" ? (
        <div className="flex-1 overflow-y-auto">
          <MaintenanceToggle />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="text-xl font-semibold text-text-primary">
              Support Tickets
            </h2>
            <button
              onClick={loadAdminTickets}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary hover:bg-border-secondary text-text-secondary text-xs font-medium rounded-lg transition"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                />
              </svg>
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3 flex-shrink-0">
            <div className="bg-bg-secondary/50 border border-border-primary rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-blue-400">
                {adminTickets.filter((t) => t.status === "open").length}
              </p>
              <p className="text-[10px] text-text-tertiary">Open</p>
            </div>
            <div className="bg-bg-secondary/50 border border-border-primary rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-amber-400">
                {adminTickets.filter((t) => t.status === "in-progress").length}
              </p>
              <p className="text-[10px] text-text-tertiary">In Progress</p>
            </div>
            <div className="bg-bg-secondary/50 border border-border-primary rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-emerald-400">
                {adminTickets.filter((t) => t.status === "resolved").length}
              </p>
              <p className="text-[10px] text-text-tertiary">Resolved</p>
            </div>
          </div>

          {loadingTickets ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : adminTickets.length === 0 ? (
            <div className="bg-bg-secondary/50 border border-border-primary rounded-xl p-12 text-center">
              <p className="text-text-muted">No support tickets yet.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              {adminTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-bg-secondary/50 border border-border-primary rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-text-primary">
                        {ticket.subject}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] text-text-tertiary">
                          {ticket.userEmail}
                        </span>
                        <span className="text-[10px] text-text-faint">|</span>
                        <span className="text-[10px] text-text-tertiary capitalize">
                          {ticket.category.replace("-", " ")}
                        </span>
                        <span className="text-[10px] text-text-faint">|</span>
                        <span className="text-[10px] text-text-muted">
                          {ticket.createdAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {ticket.projectName && (
                        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-bg-tertiary rounded text-[10px] text-text-tertiary">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                            />
                          </svg>
                          {ticket.projectName}
                        </span>
                      )}
                    </div>
                    <span
                      className={`flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                        ticket.status === "resolved"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : ticket.status === "in-progress"
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-blue-500/15 text-blue-400"
                      }`}
                    >
                      {ticket.status === "in-progress"
                        ? "In Progress"
                        : ticket.status.charAt(0).toUpperCase() +
                          ticket.status.slice(1)}
                    </span>
                  </div>

                  {/* Conversation thread */}
                  <div className="mb-3 space-y-1.5 max-h-40 overflow-y-auto">
                    {ticket.messages && ticket.messages.length > 0 ? (
                      ticket.messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs ${
                              msg.sender === "admin"
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-text-secondary"
                                : "bg-blue-600/10 border border-blue-500/20 text-text-secondary"
                            }`}
                          >
                            <p className="text-[9px] font-medium mb-0.5 ${msg.sender === 'admin' ? 'text-emerald-400' : 'text-blue-400'}">
                              {msg.sender === "admin" ? "You" : ticket.userName}
                            </p>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <p className="text-[8px] text-text-muted mt-0.5 text-right">
                              {new Date(msg.timestamp).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-text-secondary whitespace-pre-wrap">
                        {ticket.description}
                      </p>
                    )}
                  </div>

                  {/* Response form */}
                  {respondingToTicketId === ticket.id ? (
                    <div className="space-y-2 border-t border-border-primary pt-3">
                      <textarea
                        value={adminResponse}
                        onChange={(e) => setAdminResponse(e.target.value)}
                        placeholder="Type your response..."
                        rows={2}
                        className="w-full px-3 py-2 bg-bg-tertiary/50 border border-border-secondary rounded-lg text-text-primary placeholder-text-muted text-xs focus:outline-none focus:border-blue-500/50 resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            respondToTicket(
                              ticket.id,
                              adminResponse,
                              "in-progress",
                            )
                          }
                          disabled={!adminResponse.trim()}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition disabled:opacity-40"
                        >
                          Send (In Progress)
                        </button>
                        <button
                          onClick={() =>
                            respondToTicket(
                              ticket.id,
                              adminResponse,
                              "resolved",
                            )
                          }
                          disabled={!adminResponse.trim()}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition disabled:opacity-40"
                        >
                          Send & Resolve
                        </button>
                        <button
                          onClick={() => {
                            setRespondingToTicketId(null);
                            setAdminResponse("");
                          }}
                          className="px-3 py-1.5 bg-border-secondary hover:bg-text-faint text-text-secondary text-xs font-medium rounded-lg transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 border-t border-border-primary pt-3">
                      <button
                        onClick={() => {
                          setRespondingToTicketId(ticket.id);
                          setAdminResponse("");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                          />
                        </svg>
                        Respond
                      </button>
                      {ticket.status !== "resolved" && (
                        <button
                          onClick={() =>
                            respondToTicket(ticket.id, "Resolved.", "resolved")
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  // AuthenticationContent and DatabaseContent are now modals, not page sections

  // Render content based on active section
  // Note: We call these as functions (not JSX components) to avoid remounting on every render,
  // which would cause focus loss in input fields
  const renderContent = () => {
    switch (activeSection) {
      case "create":
        return CreateContent();
      case "projects":
        return (
          <ProjectsContent
            loadingProjects={loadingProjects}
            savedProjects={savedProjects}
            onSectionChange={setActiveSection}
            onOpenProject={openSavedProject}
            onDeleteProject={(id) => {
              setProjectToDelete(id);
              setShowDeleteModal(true);
            }}
          />
        );
      case "settings":
        return <SettingsContent user={user} savedProjects={savedProjects} />;
      case "support":
        return SupportContent();
      case "admin":
        return user?.email === ADMIN_EMAIL ? AdminContent() : CreateContent();
      default:
        return CreateContent();
    }
  };

  // Show loading screen while auth state is being resolved
  if (authLoading) {
    return <LoadingScreen />;
  }

  // IDLE/ERROR STATE
  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Sidebar - only show when logged in */}
      {user && (
        <DashboardSidebar
          activeSection={activeSection}
          onSectionChange={(section) => {
            setActiveSection(section);
            if (section === "support") loadSupportTickets();
            if (section === "admin") loadAdminTickets();
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={setIsSidebarCollapsed}
          onBuyTokens={() => {
            setTokenPurchaseAmount(0);
            setShowTokenPurchaseModal(true);
          }}
          unreadTicketCount={unreadTicketCount}
        />
      )}

      {/* Floating theme toggle for non-logged-in users */}
      {!user && (
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        <BackgroundEffects />

        {/* Main content */}
        <main
          className={`flex-1 flex flex-col relative z-10 ${
            activeSection === "support" || activeSection === "admin"
              ? "overflow-hidden"
              : "items-center justify-center px-4 py-12"
          }`}
        >
          {renderContent()}
        </main>
      </div>

      {/* Sign In Modal */}
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => {
          setShowSignInModal(false);
          setPendingGeneration(false);
        }}
        onSuccess={handleSignInSuccess}
      />

      {/* Delete Confirmation Modal (projects list) */}
      {showDeleteModal && projectToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="relative px-6 pt-8 pb-4 text-center">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setProjectToDelete(null);
                }}
                className="absolute top-4 right-4 p-1 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-red-500/20 rounded-2xl">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">
                Delete Project?
              </h3>
              <p className="text-text-tertiary text-sm">
                This action cannot be undone. The project will be permanently
                deleted.
              </p>
            </div>
            <div className="px-6 pb-6 space-y-3">
              <button
                onClick={() => deleteProject(projectToDelete)}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-all"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete Project
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setProjectToDelete(null);
                }}
                className="w-full px-5 py-2.5 text-text-tertiary hover:text-text-primary text-sm font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal for New Users */}
      <WelcomeModal isOpen={isNewUser} onClose={clearNewUser} />

      {/* Token Confirmation Modal */}
      {showTokenConfirmModal &&
        (() => {
          const isGeneration = showTokenConfirmModal === "generation";
          const authCost = isGeneration
            ? getAuthAppCost(currentAppAuth)
            : getAuthAppCost(editAppAuth);
          const databaseCost = getDatabaseAppCost(currentAppDatabase);
          const baseCost = isGeneration
            ? BASE_GENERATION_APP_COST
            : BASE_EDIT_APP_COST;
          const totalCost = baseCost + authCost + databaseCost;
          const appBalance = userData?.appTokens || 0;

          const handleConfirm = () => {
            if (isGeneration) {
              setShowTokenConfirmModal(null);
              startGeneration();
            } else {
              proceedWithEdit();
            }
          };

          return (
            <TokenConfirmModal
              isOpen={true}
              onClose={() => setShowTokenConfirmModal(null)}
              confirmationType={isGeneration ? "generation" : "edit"}
              totalCost={totalCost}
              baseCost={baseCost}
              authCost={authCost}
              databaseCost={databaseCost}
              appBalance={appBalance}
              skipEditTokenConfirm={skipEditTokenConfirm}
              onSkipEditTokenConfirmChange={setSkipEditTokenConfirm}
              onConfirm={handleConfirm}
              currentAppAuth={currentAppAuth}
              editAppAuth={editAppAuth}
            />
          );
        })()}

      {/* Authentication Modal */}

      {/* Database Modal */}

      {/* Token Purchase Modal */}

      {/* Extracted Modals */}
      <CancelConfirmModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(null)}
        onConfirm={async () => {
          if (showCancelConfirm === "generation") {
            confirmCancelGeneration();
          } else {
            const withinRefundWindow =
              Date.now() - editStartTimeRef.current < 10000;
            setIsEditing(false);
            setEditProgressMessages([]);
            setShowCancelConfirm(null);
            if (withinRefundWindow && user) {
              try {
                const editCost = getEditAppCost();
                await adjustAppTokens(editCost, "Edit cancelled refund");
              } catch (err) {
                console.error("Error refunding tokens:", err);
              }
            }
          }
        }}
        editStartTime={editStartTimeRef.current}
        isEditing={isEditing}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        selectedAuth={currentAppAuth}
        onAuthChange={(auth) =>
          setCurrentAppAuth(
            currentAppAuth.includes(auth)
              ? currentAppAuth.filter((a) => a !== auth)
              : [...currentAppAuth, auth],
          )
        }
      />

      {showDbModal && (
        <DatabaseModal
          isOpen={showDbModal}
          onClose={() => setShowDbModal(false)}
          selectedDatabase={currentAppDatabase}
          onDatabaseChange={setCurrentAppDatabase}
        />
      )}

      <TokenPurchaseModal
        isOpen={showTokenPurchaseModal}
        onClose={() => setShowTokenPurchaseModal(false)}
        amount={tokenPurchaseAmount}
        onAmountChange={setTokenPurchaseAmount}
        appTokens={userData?.appTokens || 0}
        insufficientMessage={insufficientTokenMessage}
        isProcessing={isProcessingTokenPurchase}
        onPurchase={purchaseTokens}
      />

      {/* Floating generation progress indicator (when on other sections or minimized) */}
      {status === "loading" &&
        (activeSection !== "create" || isGenerationMinimized) && (
          <GenerationProgress
            prompt={generationPrompt}
            progressMessages={progressMessages}
            onCancel={cancelGeneration}
            isMinimized={true}
            onToggleMinimize={() => {
              setActiveSection("create");
              setIsGenerationMinimized(false);
            }}
          />
        )}

      {/* Floating edit progress indicator (when on other sections or minimized while editing) */}
      {isEditing && (activeSection !== "create" || isEditMinimized) && (
        <GenerationProgress
          prompt={`Editing: ${editPrompt}`}
          progressMessages={editProgressMessages}
          onCancel={() => {
            setIsEditing(false);
            setEditProgressMessages([]);
            setError("Edit cancelled");
          }}
          isMinimized={true}
          onToggleMinimize={() => {
            setActiveSection("create");
            setIsEditMinimized(false);
          }}
        />
      )}

      {/* Code Viewer Modal */}
      {showCodeViewer && project && (
        <CodeViewer
          files={project.files}
          onClose={() => setShowCodeViewer(false)}
        />
      )}
    </div>
  );
}

export default function ReactGenerator() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-primary flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <ReactGeneratorContent />
    </Suspense>
  );
}
