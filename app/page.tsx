"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { editReact } from "./react-actions";
import { generateCodeWithInngest } from "@/lib/inngest-helpers";
import Logo from "./components/Logo";
import CodeViewer from "./components/CodeViewer";
import E2BPreview from "./components/E2BPreview";
import LoadingScreen from "./components/LoadingScreen";
import BackgroundEffects from "./components/BackgroundEffects";
import SettingsContent from "./components/Settings";
import ProjectsContent from "./components/Projects";
import { createSandboxServer } from "./sandbox-actions";
import { cancelGenerationJob } from "./inngest-actions";
import { prepareE2BFiles } from "@/lib/e2b-utils";
import { useAuth } from "./contexts/AuthContext";
import JSZip from "jszip";
import SignInModal from "./components/SignInModal";
import DashboardSidebar from "./components/DashboardSidebar";
import GenerationProgress from "./components/GenerationProgress";
import MaintenanceToggle from "./components/MaintenanceToggle";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { persistPollinationsImages } from "@/lib/persist-images";
import ThemeToggle from "./components/ThemeToggle";
import {
  DeleteConfirmModal,
  CancelConfirmModal,
  AuthModal,
  DatabaseModal,
  TokenPurchaseModal,
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
  TicketMessage,
} from "./types";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

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
  const [editProgressMessages, setEditProgressMessages] = useState<string[]>(
    [],
  );
  const [isEditMinimized, setIsEditMinimized] = useState(false);
  const [editFiles, setEditFiles] = useState<UploadedFile[]>([]);
  const [showTokenPurchaseModal, setShowTokenPurchaseModal] = useState(false);
  const [purchaseTokenType, setPurchaseTokenType] = useState<
    "app" | "integration"
  >("app");
  const [tokenPurchaseAmount, setTokenPurchaseAmount] = useState(0);
  const [isProcessingTokenPurchase, setIsProcessingTokenPurchase] =
    useState(false);
  const [showTokenConfirmModal, setShowTokenConfirmModal] = useState<
    "app" | "integration" | null
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
    deploymentId,
    hasUnpublishedChanges,
    showDomainModal,
    customDomain,
    setIsPublishing,
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
    setGithubExportStatus,
    setGithubExportMessage,
    setGithubRepoUrl,
    exportToGitHub,
    pushToGitHub,
  } = githubExportHook;

  const {
    showExportDropdown,
    isExporting,
    exportSuccessMessage,
    setShowExportDropdown,
    setIsExporting,
    setExportSuccessMessage,
    exportToVSCode,
    exportToCursor,
  } = editorExportHook;

  // Uses Gemini to detect if a prompt has authentication intent
  async function detectAuthInPrompt(text: string): Promise<boolean> {
    try {
      const res = await fetch("/api/check-auth-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.hasAuthIntent === true;
    } catch {
      return false;
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
  const [typingPlaceholder, setTypingPlaceholder] = useState("");
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

  // Close export dropdown when clicking outside
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
        const tokenType = searchParams.get("tokenType") || "tokens";
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
            // Load saved projects, find the one we were editing, and reopen it
            const projectsQuery = query(
              collection(db, "projects"),
              where("userId", "==", user.uid),
              orderBy("createdAt", "desc"),
            );
            const snapshot = await getDocs(projectsQuery);
            const projects: SavedProject[] = snapshot.docs
              .filter((d) => !d.data().deleted)
              .map((d) => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate() || new Date(),
                updatedAt: d.data().updatedAt?.toDate() || new Date(),
              })) as SavedProject[];
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

  // Save project to Firestore
  const saveProjectToFirestore = async (
    projectData: ReactProject,
    projectPrompt: string,
    authIntegrationCost: number = 0,
  ): Promise<string> => {
    if (!user) throw new Error("User not logged in");

    const projectDoc: any = {
      userId: user.uid,
      prompt: projectPrompt,
      files: projectData.files,
      dependencies: projectData.dependencies || {},
      lintReport: projectData.lintReport || {
        passed: true,
        errors: 0,
        warnings: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(projectData.config ? { config: projectData.config } : {}),
    };

    const docRef = await addDoc(collection(db, "projects"), projectDoc);

    // Update user's project count, deduct 2 app tokens, and deduct integration tokens for auth if applicable
    const userRef = doc(db, "users", user.uid);
    const updateData: Record<string, any> = {
      projectCount: increment(1),
      appTokens: increment(-2),
    };
    if (authIntegrationCost > 0) {
      updateData.integrationTokens = increment(-authIntegrationCost);
    }
    await updateDoc(userRef, updateData);

    // Refresh user data to get updated balances
    await refreshUserData();

    return docRef.id;
  };

  // Update existing project in Firestore
  const updateProjectInFirestore = async (
    projectId: string,
    projectData: ReactProject,
  ): Promise<void> => {
    if (!user) throw new Error("User not logged in");

    const projectRef = doc(db, "projects", projectId);
    await updateDoc(projectRef, {
      files: projectData.files,
      dependencies: projectData.dependencies || {},
      lintReport: projectData.lintReport || {
        passed: true,
        errors: 0,
        warnings: 0,
      },
      updatedAt: serverTimestamp(),
      ...(projectData.config ? { config: projectData.config } : {}),
    });
  };

  // Load saved projects from Firestore
  const loadSavedProjects = async () => {
    if (!user) return;

    setLoadingProjects(true);
    try {
      const projectsQuery = query(
        collection(db, "projects"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(projectsQuery);
      const projects: SavedProject[] = snapshot.docs
        .filter((doc) => !doc.data().deleted) // Filter out deleted projects
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as SavedProject[];
      setSavedProjects(projects);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Load support tickets for current user
  const loadSupportTickets = async () => {
    if (!user) return;
    setLoadingTickets(true);
    try {
      const ticketsQuery = query(
        collection(db, "supportTickets"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(ticketsQuery);
      const tickets: SupportTicket[] = snapshot.docs.map((d) => {
        const data = d.data();
        const messages = (data.messages || []).map((m: any) => ({
          ...m,
          timestamp: m.timestamp?.toDate
            ? m.timestamp.toDate()
            : new Date(m.timestamp),
        }));

        // Calculate unread admin message count
        const lastReadByUserAt = data.lastReadByUserAt?.toDate() || new Date(0);
        const unreadAdminMessageCount = messages.filter(
          (m: TicketMessage) =>
            m.sender === "admin" && m.timestamp > lastReadByUserAt,
        ).length;

        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          respondedAt: data.respondedAt?.toDate() || null,
          lastReadByUserAt,
          messages,
          unreadAdminMessageCount,
        };
      }) as SupportTicket[];
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
      const ticketsQuery = query(
        collection(db, "supportTickets"),
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(ticketsQuery);
      const tickets: SupportTicket[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          respondedAt: data.respondedAt?.toDate() || null,
          messages: (data.messages || []).map((m: any) => ({
            ...m,
            timestamp: m.timestamp?.toDate
              ? m.timestamp.toDate()
              : new Date(m.timestamp),
          })),
        };
      }) as SupportTicket[];
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
      const ticketData: any = {
        userId: user.uid,
        userEmail: user.email || "",
        userName: user.displayName || user.email || "User",
        category: ticketCategory,
        subject: ticketSubject.trim(),
        description: ticketDescription.trim(),
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (ticketProjectId) {
        const proj = savedProjects.find((p) => p.id === ticketProjectId);
        ticketData.projectId = ticketProjectId;
        ticketData.projectName = proj
          ? proj.prompt.substring(0, 60)
          : ticketProjectId;
      }
      ticketData.messages = [
        {
          sender: "user",
          text: ticketDescription.trim(),
          timestamp: new Date(),
        },
      ];
      await addDoc(collection(db, "supportTickets"), ticketData);
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
      const ticketRef = doc(db, "supportTickets", ticketId);
      const ticketSnap = await getDoc(ticketRef);
      const ticketData = ticketSnap.data();
      const existing = ticketData?.messages || [];

      await updateDoc(ticketRef, {
        adminResponse: response.trim(),
        status: newStatus,
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        messages: [
          ...existing,
          { sender: "admin", text: response.trim(), timestamp: new Date() },
        ],
      });

      // Send email notification (don't block if it fails)
      try {
        const ticketUrl = `${window.location.origin}?section=support&ticket=${ticketId}`;
        await fetch("/api/send-ticket-response-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId,
            userEmail: ticketData?.userEmail,
            userName: ticketData?.userName || "User",
            ticketSubject: ticketData?.subject,
            adminResponse: response.trim(),
            ticketUrl,
          }),
        });
        console.log("Email notification sent successfully");
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        // Continue anyway - ticket update succeeded
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
        const ticketRef = doc(db, "supportTickets", ticketId);
        await updateDoc(ticketRef, {
          lastReadByUserAt: serverTimestamp(),
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
      const ticketRef = doc(db, "supportTickets", ticketId);
      const ticketSnap = await getDoc(ticketRef);
      const existing = ticketSnap.data()?.messages || [];
      await updateDoc(ticketRef, {
        status: "open",
        updatedAt: serverTimestamp(),
        messages: [
          ...existing,
          { sender: "user", text: userReplyText.trim(), timestamp: new Date() },
        ],
      });
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
    try {
      const historyQuery = query(
        collection(db, "projects", projectId, "editHistory"),
        orderBy("timestamp", "asc"),
      );
      const snapshot = await getDocs(historyQuery);
      const history: EditHistoryEntry[] = snapshot.docs.map((d) => ({
        id: d.id,
        prompt: d.data().prompt,
        files: d.data().files || [],
        dependencies: d.data().dependencies || {},
        timestamp:
          d.data().timestamp instanceof Timestamp
            ? d.data().timestamp.toDate()
            : new Date(),
      }));
      setEditHistory(history);
    } catch (error) {
      console.error("Error loading edit history:", error);
      setEditHistory([]);
    }
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
      // Delete from Firestore
      const projectRef = doc(db, "projects", projectId);
      await updateDoc(projectRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
      });

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
          tokenType: purchaseTokenType,
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

      for (const file of Array.from(files)) {
        try {
          // Create a unique filename with timestamp
          const timestamp = Date.now();
          const filename = `${user.uid}/${timestamp}-${file.name}`;
          const storageRef = ref(storage, `user-images/${filename}`);

          // Upload file to Firebase Storage
          const snapshot = await uploadBytes(storageRef, file);

          // Get download URL
          const downloadUrl = await getDownloadURL(snapshot.ref);

          // Also keep dataUrl for vision API (sending to AI)
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setUploadedFiles((prev) => [
              ...prev,
              { name: file.name, type: file.type, dataUrl, downloadUrl },
            ]);
          };
          reader.readAsDataURL(file);
        } catch (error) {
          console.error("Error uploading file:", error);
          setError(`Failed to upload ${file.name}. Please try again.`);
        }
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [user],
  );

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleEditFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !user) return;

      for (const file of Array.from(files)) {
        try {
          // Create a unique filename with timestamp
          const timestamp = Date.now();
          const filename = `${user.uid}/${timestamp}-${file.name}`;
          const storageRef = ref(storage, `user-images/${filename}`);

          // Upload file to Firebase Storage
          const snapshot = await uploadBytes(storageRef, file);

          // Get download URL
          const downloadUrl = await getDownloadURL(snapshot.ref);

          // Also keep dataUrl for vision API (sending to AI)
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setEditFiles((prev) => [
              ...prev,
              { name: file.name, type: file.type, dataUrl, downloadUrl },
            ]);
          };
          reader.readAsDataURL(file);
        } catch (error) {
          console.error("Error uploading file:", error);
          setError(`Failed to upload ${file.name}. Please try again.`);
        }
      }

      if (editFileInputRef.current) editFileInputRef.current.value = "";
    },
    [user],
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

  // Calculate integration token cost for generation based on auth selection
  const getGenerationIntegrationCost = () => {
    let cost = 0;
    if (currentAppAuth.includes("username-password")) cost += 30;
    if (currentAppAuth.includes("google")) cost += 30;
    return cost;
  };

  // Calculate integration token cost for edit based on auth selection
  const getEditIntegrationCost = () => {
    let cost = 0;
    if (editAppAuth.includes("username-password")) cost += 30;
    if (editAppAuth.includes("google")) cost += 30;
    return cost > 0 ? cost : 3; // Minimum 3 for regular edits
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (!editPrompt.trim() && editAppAuth.length === 0) ||
      isEditing ||
      !project ||
      checkingAuthIntent
    )
      return;

    // Use Gemini to detect auth intent in edit prompt
    if (editPrompt.trim() && editAppAuth.length === 0) {
      setCheckingAuthIntent(true);
      const hasAuth = await detectAuthInPrompt(editPrompt);
      setCheckingAuthIntent(false);
      if (hasAuth) {
        setAuthPromptWarning(
          "Authentication detected in your prompt! To add login/signup, click the 🔒 lock icon below the edit box to select your authentication method. Authentication is a premium integration and cannot be added via text prompts.",
        );
        return;
      }
    }
    setAuthPromptWarning(null);

    // Check integration token balance based on auth selection
    const editCost = getEditIntegrationCost();
    const integrationBalance = userData?.integrationTokens || 0;
    if (integrationBalance < editCost) {
      const deficit = editCost - integrationBalance;
      const authNames = [
        ...(editAppAuth.includes("username-password")
          ? ["Username/Password"]
          : []),
        ...(editAppAuth.includes("google") ? ["Google OAuth"] : []),
      ];
      const reason =
        authNames.length > 0
          ? `This edit with ${authNames.join(" + ")} authentication requires ${editCost} integration tokens`
          : `This edit requires ${editCost} integration tokens`;
      setInsufficientTokenMessage(
        `${reason} but you only have ${integrationBalance}. Please purchase at least ${deficit} more integration token${deficit > 1 ? "s" : ""} to continue.`,
      );
      setPurchaseTokenType("integration");
      setTokenPurchaseAmount(0);
      setShowTokenPurchaseModal(true);
      return;
    }

    // Skip confirmation if user opted out
    if (skipEditTokenConfirm) {
      proceedWithEdit();
      return;
    }

    // Show confirmation modal before deducting token
    setShowTokenConfirmModal("integration");
    return;
  };

  // Actually start the edit after user confirms token deduction
  const proceedWithEdit = async () => {
    if (!project) return;
    setShowTokenConfirmModal(null);
    setIsEditing(true);
    editStartTimeRef.current = Date.now();
    setError("");
    setEditProgressMessages([]);
    setIsEditMinimized(false);

    // Deduct integration tokens upfront (refundable if cancelled within 10s)
    if (user) {
      try {
        const editCost = getEditIntegrationCost();
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { integrationTokens: increment(-editCost) });
        await refreshUserData();
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
    const userRequest = editPrompt.trim()
      ? editPrompt
      : authLabels.length > 0
        ? `Add ${authLabels.join(" and ")} to the app`
        : editPrompt;

    let editFullPrompt = `I have an existing React app with the following files:

${currentFiles}

USER'S EDIT REQUEST:
${userRequest}

🎯 CRITICAL INSTRUCTIONS:
1. Do EXACTLY what the user requested - nothing more, nothing less
2. DO NOT add features, components, or changes the user did not ask for
3. DO NOT refactor, reorganize, or "improve" code unless specifically asked
4. DO NOT change styling, colors, or layout unless specifically asked
5. DO NOT add comments, documentation, or explanations unless asked
6. DO NOT remove or modify content/features the user didn't mention
7. Only modify the specific parts needed to fulfill the user's exact request
8. Keep everything else EXACTLY as it was before

📦 PACKAGE CONSTRAINT (CRITICAL - DO NOT VIOLATE):
The app currently uses ONLY these packages: ${allowedPackagesList}
- DO NOT import any npm package that is not in the list above
- DO NOT add framer-motion, gsap, three, @react-three/fiber, or any other new package
- Use Tailwind CSS classes for animations (animate-*, transition, hover:, etc.)
- Use inline SVGs or existing lucide-react icons for icons
- If the user's request absolutely requires a new package, use ONLY packages from this list: lucide-react, react, react-dom, next, firebase
- Any import of a package NOT listed above will cause a build error

🎨 TAILWIND CSS RULES (CRITICAL - VIOLATIONS CAUSE BUILD ERRORS):
- NEVER use @apply with custom class names like bg-primary, text-secondary, bg-accent — these WILL crash the build
- ONLY use @apply with built-in Tailwind utilities: @apply px-4 py-2 bg-blue-600 text-white rounded-lg
- Use standard Tailwind color classes (blue-600, gray-900, emerald-500, etc.) instead of custom names
- Keep globals.css simple — just @tailwind base/components/utilities. Put styles in className attributes.`;

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
        editFullPrompt += `\n\n📷 CRITICAL - User has uploaded ${imageFiles.length} image(s) that MUST be displayed in the website:

${imageUrlList}

🚨 YOU MUST:
1. Use these EXACT image URLs in your img src attributes
2. Example: <img src="${imageFiles[0]?.downloadUrl || ""}" alt="User uploaded image" className="..." />
3. Replace existing placeholder images with these actual images
4. Embed these images prominently in the relevant sections
5. DO NOT use placeholder images - use ONLY the URLs listed above

The user expects to see their ACTUAL uploaded images in the updated website.`;
      }

      if (pdfFiles.length > 0) {
        const pdfUrlList = pdfFiles
          .map(
            (f, i) => `PDF ${i + 1} (${f.name}): ${f.downloadUrl || f.dataUrl}`,
          )
          .join("\n");
        editFullPrompt += `\n\n📄 CRITICAL - User has uploaded ${pdfFiles.length} PDF file(s):

${pdfUrlList}

🚨 YOU MUST:
1. The PDFs are uploaded for reference/context - analyze their content if shown visually
2. If the user wants to link to the PDFs, use these EXACT URLs: <a href="${pdfFiles[0]?.downloadUrl || ""}" download>Download PDF</a>
3. If the PDF contains design references, use them to inform the visual design changes
4. The user has uploaded these PDFs to provide context for the edit request`;
      }
    }

    // Add authentication requirements if selected for this edit
    if (editAppAuth.includes("username-password")) {
      editFullPrompt += `\n\n🔐 AUTHENTICATION REQUIREMENT (ADD TO EXISTING APP):
Implement a complete username/password authentication system into this existing app:
1. User Registration (Sign Up) - with email/username and password
2. User Login with session management
3. Password Reset/Forgot Password functionality
4. Logout functionality
5. Protected routes that require authentication
6. User profile display
7. Use Firebase Authentication or a similar service for backend
8. Include proper form validation and error handling
9. Store user sessions securely
10. Add authentication UI components (login form, signup form, password reset form)

Integrate the authentication seamlessly into the existing app design and layout.`;
    }
    if (editAppAuth.includes("google")) {
      editFullPrompt += `\n\n🔐 AUTHENTICATION REQUIREMENT (ADD TO EXISTING APP):
Implement Google OAuth authentication into this existing app:
1. "Sign in with Google" button with proper Google branding
2. OAuth 2.0 integration using Firebase Authentication or similar
3. Automatic user profile creation with Google account data
4. Session management for logged-in users
5. Logout functionality
6. Protected routes that require authentication
7. Display user's Google profile picture and name
8. Handle OAuth errors gracefully
9. Add loading states during authentication

Integrate the Google OAuth seamlessly into the existing app design and layout.`;
    }

    editFullPrompt += `\n\n🚨 CRITICAL REQUIREMENT:
You MUST return ALL of these exact files in your response: ${existingFilePaths}

Even if you only modify 1-2 files, you must include ALL files in the output JSON.
Do not skip any files. Keep unmodified files exactly as they are.`;

    // Save current project state as a snapshot before applying the edit
    if (currentProjectId && user) {
      try {
        const editPromptText =
          editPrompt.trim() ||
          (authLabels.length > 0 ? `Add ${authLabels.join(" and ")}` : "Edit");
        const historyRef = collection(
          db,
          "projects",
          currentProjectId,
          "editHistory",
        );
        const historyDoc = await addDoc(historyRef, {
          prompt: editPromptText,
          files: project.files,
          dependencies: project.dependencies || {},
          timestamp: serverTimestamp(),
        });
        setEditHistory((prev) => [
          ...prev,
          {
            id: historyDoc.id,
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
      // Use config-level edit if project has a config (much faster/cheaper)
      const result = project.config
        ? await editReact(
            editPrompt.trim(),
            project.config,
            project.files,
            project.imageCache,
          )
        : await generateCodeWithInngest(
            editFullPrompt,
            user?.uid || "anonymous",
            (message) => {
              setEditProgressMessages((prev) => [...prev, message]);
            },
          );

      // Store projectId for cancellation tracking (if using Inngest)
      if (!project.config && "projectId" in result && result.projectId) {
        setCurrentGenerationProjectId(result.projectId);
      }

      setEditProgressMessages((prev) => [...prev, "💾 Merging changes..."]);

      // AI code generation: persist images and use generated files
      const persistedFiles = await persistPollinationsImages(
        result.files,
        user?.uid ?? "anonymous",
      );
      const mergedProject = { ...result, files: persistedFiles };

      setProject(mergedProject);
      setEditPrompt("");
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
      fullPrompt += `\n\n🔐 AUTHENTICATION REQUIREMENT:
Implement a complete username/password authentication system with the following features:
1. User Registration (Sign Up) - with email/username and password
2. User Login with session management
3. Password Reset/Forgot Password functionality
4. Logout functionality
5. Protected routes that require authentication
6. User profile display
7. Use Firebase Authentication or a similar service for backend
8. Include proper form validation and error handling
9. Store user sessions securely
10. Add authentication UI components (login form, signup form, password reset form)

Make sure the authentication is fully functional and integrated throughout the app.`;
    }
    if (currentAppAuth.includes("google")) {
      fullPrompt += `\n\n🔐 AUTHENTICATION REQUIREMENT:
Implement Google OAuth authentication with the following features:
1. "Sign in with Google" button with proper Google branding
2. OAuth 2.0 integration using Firebase Authentication or similar
3. Automatic user profile creation with Google account data
4. Session management for logged-in users
5. Logout functionality
6. Protected routes that require authentication
7. Display user's Google profile picture and name
8. Handle OAuth errors gracefully
9. Add loading states during authentication

Make sure the Google OAuth is fully functional and integrated throughout the app.`;
    }

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
        fullPrompt += `\n\n📷 CRITICAL - User has uploaded ${imageFiles.length} image(s) that MUST be displayed in the website:

${imageUrlList}

🚨 YOU MUST:
1. Use these EXACT image URLs in your img src attributes
2. Example: <img src="${imageFiles[0]?.downloadUrl || ""}" alt="User uploaded image" className="..." />
3. Embed these images prominently in the website (hero sections, galleries, cards, etc.)
4. DO NOT use placeholder images like via.placeholder.com - use ONLY the URLs listed above
5. The user uploaded these images specifically to see them in the generated website

The user expects to see their ACTUAL uploaded images in the final website.`;
      }

      if (pdfFiles.length > 0) {
        const pdfUrlList = pdfFiles
          .map(
            (f, i) => `PDF ${i + 1} (${f.name}): ${f.downloadUrl || f.dataUrl}`,
          )
          .join("\n");
        fullPrompt += `\n\n📄 CRITICAL - User has uploaded ${pdfFiles.length} PDF file(s):

${pdfUrlList}

🚨 YOU MUST:
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

      setProgressMessages((prev) => [...prev, "💾 Saving project..."]);

      // Check if authentication was generated
      const hasAuth = result.files.some(
        (f) =>
          f.content.includes("firebase/auth") ||
          f.content.includes("firebase/firestore") ||
          f.content.includes("PLACEHOLDER_API_KEY"),
      );

      // Auto-create Firebase Web App if auth is detected
      if (hasAuth && user) {
        setProgressMessages((prev) => [
          ...prev,
          "🔐 Setting up Firebase authentication...",
        ]);

        try {
          const response = await fetch("/api/create-firebase-app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.uid,
              appName: generationPrompt.substring(0, 100),
              prompt: generationPrompt,
            }),
          });

          if (response.ok) {
            const { firebaseConfig, appId, tenantId, multiTenancyEnabled } =
              await response.json();

            // Inject Firebase config into the generated files
            result.files = result.files.map((file) => {
              if (
                file.path === "lib/firebase-config.ts" &&
                file.content.includes("PLACEHOLDER_API_KEY")
              ) {
                return {
                  ...file,
                  content: file.content
                    .replace("PLACEHOLDER_API_KEY", firebaseConfig.apiKey || "")
                    .replace(
                      "PLACEHOLDER_AUTH_DOMAIN",
                      firebaseConfig.authDomain || "",
                    )
                    .replace(
                      "PLACEHOLDER_PROJECT_ID",
                      firebaseConfig.projectId || "",
                    )
                    .replace(
                      "PLACEHOLDER_STORAGE_BUCKET",
                      firebaseConfig.storageBucket || "",
                    )
                    .replace(
                      "PLACEHOLDER_MESSAGING_SENDER_ID",
                      firebaseConfig.messagingSenderId || "",
                    )
                    .replace(
                      "PLACEHOLDER_APP_ID",
                      appId || firebaseConfig.appId || "",
                    )
                    .replace("PLACEHOLDER_TENANT_ID", tenantId || "null"),
                };
              }
              return file;
            });

            if (multiTenancyEnabled) {
              setProgressMessages((prev) => [
                ...prev,
                "✅ Firebase authentication ready (isolated tenant)!",
              ]);
            } else {
              setProgressMessages((prev) => [
                ...prev,
                "✅ Firebase authentication ready!",
              ]);
              setProgressMessages((prev) => [
                ...prev,
                "ℹ️ Note: Using shared auth pool (upgrade to Identity Platform for isolation)",
              ]);
            }
          } else {
            console.error("Failed to create Firebase app");
            setProgressMessages((prev) => [
              ...prev,
              "⚠️ Auth setup failed - using defaults",
            ]);
          }
        } catch (error) {
          console.error("Error creating Firebase app:", error);
          setProgressMessages((prev) => [
            ...prev,
            "⚠️ Auth setup failed - using defaults",
          ]);
        }
      }

      // Persist Pollinations AI images to Firebase Storage so they don't change on reload
      setProgressMessages((prev) => [...prev, "Persisting images..."]);
      const persistedFiles = await persistPollinationsImages(
        result.files,
        user?.uid ?? "anonymous",
      );
      result = { ...result, files: persistedFiles };
      setProject(result);

      // Save project to Firestore
      if (user) {
        try {
          const authCost = getGenerationIntegrationCost();
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

  // Calculate integration token cost for generation based on auth selection
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim() || status === "loading" || checkingAuthIntent) return;

    // Use Gemini to detect auth intent — auth must be added via the integration toggle (lock icon)
    if (currentAppAuth.length === 0) {
      setCheckingAuthIntent(true);
      const hasAuth = await detectAuthInPrompt(prompt);
      setCheckingAuthIntent(false);
      if (hasAuth) {
        setAuthPromptWarning(
          "Authentication detected in your prompt! To add login/signup, click the 🔒 lock icon below the prompt box to select your authentication method. Authentication is a premium integration and cannot be added via text prompts.",
        );
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

    // Check app token balance (every project costs 2 app tokens)
    const appTokenBalance = userData?.appTokens || 0;
    if (appTokenBalance < 2) {
      const deficit = 2 - appTokenBalance;
      setInsufficientTokenMessage(
        `You need 2 app tokens to create a project but only have ${appTokenBalance}. Please purchase at least ${deficit} more app token${deficit > 1 ? "s" : ""} to continue.`,
      );
      setPurchaseTokenType("app");
      setTokenPurchaseAmount(0);
      setShowTokenPurchaseModal(true);
      return;
    }

    // Check integration token balance if auth is selected
    const integrationCost = getGenerationIntegrationCost();
    if (integrationCost > 0) {
      const integrationBalance = userData?.integrationTokens || 0;
      if (integrationBalance < integrationCost) {
        const authNames = [
          ...(currentAppAuth.includes("username-password")
            ? ["Username/Password"]
            : []),
          ...(currentAppAuth.includes("google") ? ["Google OAuth"] : []),
        ].join(" + ");
        const deficit = integrationCost - integrationBalance;
        setInsufficientTokenMessage(
          `Adding ${authNames} authentication requires ${integrationCost} integration tokens but you only have ${integrationBalance}. Please purchase at least ${deficit} more integration token${deficit > 1 ? "s" : ""} to continue.`,
        );
        setPurchaseTokenType("integration");
        setTokenPurchaseAmount(0);
        setShowTokenPurchaseModal(true);
        return;
      }
    }

    // Show confirmation modal before deducting tokens
    setShowTokenConfirmModal("app");
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

    const files = prepareE2BFiles(project);

    try {
      const { sandboxId, url } = await createSandboxServer(files);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Error opening E2B sandbox:", err);
      setError("Failed to create sandbox. Please try again.");
    }
  };



  // Calculate total unread ticket count
  const unreadTicketCount = supportTickets.reduce(
    (total, ticket) => total + (ticket.unreadAdminMessageCount || 0),
    0,
  );

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
              }
              if (section === "support") loadSupportTickets();
              if (section === "admin") loadAdminTickets();
            }}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={setIsSidebarCollapsed}
            onBuyTokens={(tokenType) => {
              setPurchaseTokenType(tokenType);
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
                  Edit Tokens: {userData?.integrationTokens || 0}
                  <span className="hidden group-hover:block absolute top-full left-0 mt-2 w-52 p-2 bg-border-secondary text-text-secondary text-xs rounded-lg shadow-xl z-50">
                    Each AI edit costs 3 integration tokens. Buy more in the
                    Tokens section.
                  </span>
                </span>
                {project.lintReport.passed ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                    {project.lintReport.errors} issues
                  </span>
                )}
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

          {/* Main Content Area - Preview + Edit Panel */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Preview Area */}
            <div className="flex-1 overflow-hidden relative min-h-0 bg-bg-secondary/30">
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
                    : "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-bg-tertiary/20 to-transparent"
                }`}
              >
                <div
                  className={`h-full transition-all duration-300 ${
                    previewMode === "mobile"
                      ? "w-[375px] rounded-[2rem] border-[8px] border-border-secondary shadow-2xl shadow-black/50 overflow-hidden"
                      : previewMode === "tablet"
                        ? "w-[768px] rounded-[1.5rem] border-[6px] border-border-secondary shadow-2xl shadow-black/50 overflow-hidden"
                        : "w-full"
                  }`}
                >
                  {/* Device Notch for Mobile */}
                  {previewMode === "mobile" && (
                    <div className="bg-border-secondary h-6 flex items-center justify-center">
                      <div className="w-20 h-4 bg-bg-tertiary rounded-full" />
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
                    <E2BPreview project={project} previewKey={previewKey} />
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Panel - Right on desktop, Bottom on mobile/tablet */}
            <div className="flex-shrink-0 lg:w-56 xl:w-64 border-t lg:border-t-0 lg:border-l border-border-primary bg-bg-secondary/80 backdrop-blur-lg flex flex-col">
              {/* Panel Header - Desktop only */}
              <div className="hidden lg:flex items-center gap-2 px-4 py-3 border-b border-border-primary">
                <svg
                  className="w-4 h-4 text-text-tertiary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                <span className="text-sm font-medium text-text-secondary">
                  Edit App
                </span>
              </div>

              {/* Integration token balance indicator */}
              {(userData?.integrationTokens || 0) < 6 && (
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
                      Low Integration Tokens
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mb-2">
                    {userData?.integrationTokens || 0} token
                    {(userData?.integrationTokens || 0) !== 1 ? "s" : ""}{" "}
                    remaining. Each edit costs 3 tokens.
                  </p>
                  <button
                    onClick={() => {
                      setPurchaseTokenType("integration");
                      setTokenPurchaseAmount(0);
                      setShowTokenPurchaseModal(true);
                    }}
                    className="w-full px-3 py-1.5 bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 text-white text-xs font-medium rounded-lg transition"
                  >
                    Buy Integration Tokens
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
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
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
                <div className="mx-4 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"
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
                    <p className="text-xs text-amber-300 font-medium">
                      {authPromptWarning}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthPromptWarning(null)}
                    className="text-amber-400 hover:text-amber-300 transition"
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
                <div className="hidden lg:flex flex-col gap-3 flex-1">
                  {/* Prompt area with auth tags */}
                  <div className="flex-1 flex flex-col bg-bg-tertiary/50 border border-border-secondary rounded-xl focus-within:border-blue-500/50 overflow-hidden">
                    {/* Auth prefill tags (non-editable) */}
                    {editAppAuth.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1">
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
                          : "Describe changes you want to make...\n\nExamples:\n• Change the color scheme to blue\n• Add a contact form\n• Make the header sticky\n• Add dark mode toggle"
                      }
                      disabled={isEditing}
                      className="flex-1 min-h-[120px] px-4 py-3 bg-transparent text-text-primary placeholder-text-muted focus:outline-none resize-none text-sm disabled:opacity-50"
                    />
                  </div>
                  {/* Auth selector for edit */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Add Auth:</span>
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={isEditing}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-3 bg-bg-tertiary hover:bg-border-secondary text-text-secondary text-sm font-medium rounded-xl transition disabled:opacity-50"
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
                      disabled={
                        (!editPrompt.trim() && editAppAuth.length === 0) ||
                        isEditing ||
                        checkingAuthIntent
                      }
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isEditing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Updating...
                        </>
                      ) : checkingAuthIntent ? (
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
                    Press Enter to apply or Shift+Enter for new line
                  </p>
                </div>

                {/* Mobile/Tablet: Layout */}
                <div className="flex lg:hidden flex-col gap-2">
                  {/* Auth selector for mobile edit */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs text-text-muted">Add Auth:</span>
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
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition ${
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
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition ${
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
                  {/* Auth prefill tags for mobile */}
                  {editAppAuth.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1">
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={isEditing}
                      className="p-3 bg-bg-tertiary hover:bg-border-secondary text-text-tertiary rounded-xl transition disabled:opacity-50"
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
                        className="w-full px-4 py-3 bg-bg-tertiary/50 border border-border-secondary rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500/50 resize-none text-sm disabled:opacity-50"
                        style={{ minHeight: "46px", maxHeight: "120px" }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={
                        (!editPrompt.trim() && editAppAuth.length === 0) ||
                        isEditing ||
                        checkingAuthIntent
                      }
                      className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isEditing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span className="hidden sm:inline">Updating...</span>
                        </>
                      ) : checkingAuthIntent ? (
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
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Domain Modal */}
        {showDomainModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
                <h3 className="text-lg font-semibold text-text-primary">
                  Domain Settings
                </h3>
                <button
                  onClick={() => setShowDomainModal(false)}
                  className="p-1 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
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
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Published URL */}
                {publishedUrl && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-text-secondary">
                      Published URL
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-secondary font-mono truncate">
                        {publishedUrl}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(publishedUrl);
                        }}
                        className="px-3 py-2 text-text-tertiary hover:text-text-primary bg-bg-tertiary hover:bg-border-secondary border border-border-secondary rounded-lg transition"
                        title="Copy URL"
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
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                      <a
                        href={publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 text-text-tertiary hover:text-text-primary bg-bg-tertiary hover:bg-border-secondary border border-border-secondary rounded-lg transition"
                        title="Open in new tab"
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
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                )}

                {/* Connect Custom Domain */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-text-secondary">
                    Connect Custom Domain
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      placeholder="yourdomain.com"
                      className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm"
                    />
                    <button
                      onClick={() => connectDomain(customDomain)}
                      disabled={!customDomain.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Connect
                    </button>
                  </div>
                  <p className="text-xs text-text-muted">
                    Point your domain&apos;s CNAME record to{" "}
                    <span className="font-mono text-text-tertiary">
                      cname.pocketdev.app
                    </span>
                  </p>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border-secondary"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-bg-secondary text-text-muted">
                      or
                    </span>
                  </div>
                </div>

                {/* Buy Domain */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-text-secondary">
                    Buy a New Domain
                  </label>
                  <div className="p-4 bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-violet-500/20 rounded-lg">
                        <svg
                          className="w-5 h-5 text-violet-400"
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
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-text-primary mb-1">
                          Get a custom domain
                        </h4>
                        <p className="text-xs text-text-tertiary mb-3">
                          Search for available domains and purchase them
                          directly. Prices start from $9.99/year.
                        </p>
                        <button
                          onClick={() =>
                            window.open(
                              "https://domains.google.com/registrar/search",
                              "_blank",
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition"
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
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                          Search Domains
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-bg-tertiary/50 border-t border-border-primary flex gap-3">
                <button
                  onClick={() => setShowDomainModal(false)}
                  className="flex-1 px-4 py-2 text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-border-secondary border border-border-secondary rounded-lg transition text-sm font-medium"
                >
                  Close
                </button>
                {publishedUrl && (
                  <>
                    {hasUnpublishedChanges ? (
                      <button
                        onClick={publishProject}
                        disabled={isPublishing}
                        className="px-4 py-2 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPublishing ? "Publishing..." : "Publish Changes"}
                      </button>
                    ) : (
                      <button
                        onClick={unpublishProject}
                        className="px-4 py-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition text-sm font-medium"
                      >
                        Unpublish
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GitHub Export Modal */}
        {showGitHubModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-text-primary"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-text-primary">
                    Export to GitHub
                  </h3>
                </div>
                <button
                  onClick={() => setShowGitHubModal(false)}
                  className="p-1 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
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
              </div>

              {/* Success State */}
              {githubExportStatus === "success" ? (
                <div className="px-6 py-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-emerald-500/20 rounded-2xl">
                    <svg
                      className="w-8 h-8 text-emerald-400"
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
                  </div>
                  <h4 className="text-lg font-bold text-text-primary mb-2">
                    Pushed to GitHub!
                  </h4>
                  <p className="text-text-tertiary text-sm mb-4">
                    {githubExportMessage}
                  </p>
                  <a
                    href={githubRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition text-sm"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    Open Repository
                  </a>
                  <button
                    onClick={() => setShowGitHubModal(false)}
                    className="block w-full mt-3 text-sm text-text-tertiary hover:text-text-primary transition"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  {/* Form */}
                  <div className="px-6 py-5 space-y-4">
                    {/* Token */}
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">
                        Personal Access Token
                      </label>
                      <input
                        type="password"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        disabled={githubExportStatus === "exporting"}
                        className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-secondary rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                      <p className="mt-1 text-xs text-text-muted">
                        Needs{" "}
                        <span className="text-text-tertiary font-mono">
                          repo
                        </span>{" "}
                        scope.{" "}
                        <a
                          href="https://github.com/settings/tokens/new?scopes=repo&description=Pocket+Dev+Export"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline"
                        >
                          Create token
                        </a>
                      </p>
                    </div>

                    {/* Repo Name */}
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">
                        Repository Name
                      </label>
                      <input
                        type="text"
                        value={githubRepoName}
                        onChange={(e) =>
                          setGithubRepoName(
                            e.target.value.replace(/[^a-zA-Z0-9._-]/g, "-"),
                          )
                        }
                        placeholder="my-nextjs-app"
                        disabled={githubExportStatus === "exporting"}
                        className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-secondary rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                    </div>

                    {/* Visibility */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setGithubPrivate(false)}
                        disabled={githubExportStatus === "exporting"}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                          !githubPrivate
                            ? "bg-blue-600 text-white border border-blue-500"
                            : "bg-bg-tertiary/50 text-text-tertiary border border-border-primary hover:border-border-secondary"
                        }`}
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
                            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Public
                      </button>
                      <button
                        type="button"
                        onClick={() => setGithubPrivate(true)}
                        disabled={githubExportStatus === "exporting"}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                          githubPrivate
                            ? "bg-blue-600 text-white border border-blue-500"
                            : "bg-bg-tertiary/50 text-text-tertiary border border-border-primary hover:border-border-secondary"
                        }`}
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
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        Private
                      </button>
                    </div>

                    {/* Error */}
                    {githubExportStatus === "error" && (
                      <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-sm text-red-400">
                          {githubExportMessage}
                        </p>
                      </div>
                    )}

                    {/* Progress */}
                    {githubExportStatus === "exporting" && (
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
                        <p className="text-sm text-blue-400">
                          {githubExportMessage}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 pb-5 flex gap-3">
                    <button
                      onClick={() => setShowGitHubModal(false)}
                      disabled={githubExportStatus === "exporting"}
                      className="flex-1 px-4 py-2.5 text-text-secondary bg-bg-tertiary hover:bg-border-secondary rounded-xl text-sm font-medium transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={pushToGitHub}
                      disabled={
                        !githubToken ||
                        !githubRepoName ||
                        githubExportStatus === "exporting"
                      }
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {githubExportStatus === "exporting" ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Pushing...
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
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                          Push to GitHub
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

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

        {/* Token Deduction Confirmation Modal (success view) */}
        {showTokenConfirmModal &&
          (() => {
            const isGeneration = showTokenConfirmModal === "app";
            const genIntegrationCost = getGenerationIntegrationCost();
            const editIntCost = getEditIntegrationCost();
            const appCost = isGeneration ? 2 : 0;
            const integrationCost = isGeneration
              ? genIntegrationCost
              : editIntCost;
            const appBalance = userData?.appTokens || 0;
            const integrationBalance = userData?.integrationTokens || 0;

            return (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="relative px-6 pt-8 pb-4 text-center">
                    <button
                      onClick={() => setShowTokenConfirmModal(null)}
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
                    <div
                      className={`inline-flex items-center justify-center w-14 h-14 mb-4 rounded-2xl ${
                        isGeneration
                          ? "bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30"
                          : "bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30"
                      }`}
                    >
                      <svg
                        className={`w-7 h-7 ${isGeneration ? "text-blue-400" : "text-violet-400"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-text-primary mb-1">
                      {isGeneration ? "Create New Project" : "Edit Project"}
                    </h3>
                    <p className="text-text-tertiary text-sm">
                      {isGeneration
                        ? "This action will deduct tokens from your balance."
                        : "This edit will deduct tokens from your balance."}
                    </p>
                  </div>
                  <div className="px-6 pb-4 space-y-3">
                    {appCost > 0 && (
                      <div className="p-4 rounded-xl border bg-blue-500/5 border-blue-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">
                            App Tokens
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-text-secondary">
                            Project creation
                          </span>
                          <span className="text-sm font-bold text-blue-400">
                            -{appCost}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-text-tertiary pt-2 border-t border-border-secondary/50">
                          <span>Balance: {appBalance}</span>
                          <span>After: {appBalance - appCost}</span>
                        </div>
                      </div>
                    )}
                    {integrationCost > 0 && (
                      <div className="p-4 rounded-xl border bg-violet-500/5 border-violet-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">
                            Integration Tokens
                          </span>
                        </div>
                        {!isGeneration && (
                          <>
                            {editAppAuth.includes("username-password") && (
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-text-secondary">
                                  Username & Password auth
                                </span>
                                <span className="text-sm font-bold text-violet-400">
                                  -30
                                </span>
                              </div>
                            )}
                            {editAppAuth.includes("google") && (
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-text-secondary">
                                  Google OAuth auth
                                </span>
                                <span className="text-sm font-bold text-violet-400">
                                  -30
                                </span>
                              </div>
                            )}
                            {editAppAuth.length === 0 && (
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-text-secondary">
                                  Edit changes
                                </span>
                                <span className="text-sm font-bold text-violet-400">
                                  -3
                                </span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex items-center justify-between text-xs text-text-tertiary pt-2 border-t border-border-secondary/50">
                          <span>Balance: {integrationBalance}</span>
                          <span>
                            After: {integrationBalance - integrationCost}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <svg
                        className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        />
                      </svg>
                      <p className="text-xs text-amber-200/80">
                        Tokens are non-refundable once deducted, even if you
                        cancel during the process.
                      </p>
                    </div>
                    {!isGeneration && (
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={skipEditTokenConfirm}
                          onChange={(e) => {
                            setSkipEditTokenConfirm(e.target.checked);
                            localStorage.setItem(
                              "skipEditTokenConfirm",
                              String(e.target.checked),
                            );
                          }}
                          className="w-4 h-4 rounded border-text-faint bg-bg-tertiary text-violet-500 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="text-xs text-text-tertiary group-hover:text-text-secondary transition">
                          Don&apos;t show this again for edits
                        </span>
                      </label>
                    )}
                  </div>
                  <div className="px-6 pb-6 space-y-2">
                    <button
                      onClick={() => {
                        if (isGeneration) {
                          setShowTokenConfirmModal(null);
                          startGeneration();
                        } else {
                          proceedWithEdit();
                        }
                      }}
                      className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold rounded-xl transition-all text-white ${
                        isGeneration
                          ? "bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400"
                          : "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400"
                      }`}
                    >
                      {isGeneration ? "Create Project" : "Start Edit"}
                    </button>
                    <button
                      onClick={() => setShowTokenConfirmModal(null)}
                      className="w-full px-5 py-2.5 text-text-tertiary hover:text-text-primary text-sm font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Token Purchase Modal (success view) */}
        {showTokenPurchaseModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col my-auto">
              <div className="relative px-6 pt-8 pb-4 text-center flex-shrink-0">
                <button
                  onClick={() => {
                    setShowTokenPurchaseModal(false);
                    setInsufficientTokenMessage(null);
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
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl ${
                    purchaseTokenType === "app"
                      ? "bg-gradient-to-br from-blue-500 to-violet-500"
                      : "bg-gradient-to-br from-violet-500 to-purple-500"
                  }`}
                >
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-text-primary mb-2">
                  Buy {purchaseTokenType === "app" ? "App" : "Integration"}{" "}
                  Tokens
                </h3>
                {insufficientTokenMessage ? (
                  <div className="mt-1 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-left">
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        />
                      </svg>
                      <p className="text-sm text-red-300">
                        {insufficientTokenMessage}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-text-tertiary text-sm">
                    {purchaseTokenType === "app"
                      ? "App tokens are used to create new projects (2 tokens per project). New accounts start with 4 free tokens."
                      : "Integration tokens are used for AI edits and backend/API calls (3 tokens per edit)."}
                  </p>
                )}
                <p className="text-text-muted text-xs mt-2">
                  Current balance:{" "}
                  {purchaseTokenType === "app"
                    ? userData?.appTokens || 0
                    : userData?.integrationTokens || 0}{" "}
                  tokens
                </p>
              </div>
              <div className="px-6 pb-3 flex-shrink-0">
                <div className="flex bg-bg-tertiary rounded-lg p-1">
                  <button
                    onClick={() => {
                      setPurchaseTokenType("app");
                      setTokenPurchaseAmount(0);
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                      purchaseTokenType === "app"
                        ? "bg-blue-600 text-white"
                        : "text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    App Tokens
                  </button>
                  <button
                    onClick={() => {
                      setPurchaseTokenType("integration");
                      setTokenPurchaseAmount(0);
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                      purchaseTokenType === "integration"
                        ? "bg-violet-600 text-white"
                        : "text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    Integration Tokens
                  </button>
                </div>
              </div>
              <div className="px-6 py-4 overflow-y-auto flex-1">
                <p className="text-xs text-text-tertiary mb-3">
                  {purchaseTokenType === "app"
                    ? "1 AUD = 1 app token"
                    : "1 AUD = 10 integration tokens"}
                </p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {(purchaseTokenType === "app"
                    ? [
                        { aud: 2, tokens: 2, label: "2 tokens" },
                        { aud: 5, tokens: 5, label: "5 tokens" },
                        { aud: 10, tokens: 10, label: "10 tokens" },
                        { aud: 20, tokens: 20, label: "20 tokens" },
                      ]
                    : [
                        { aud: 1, tokens: 10, label: "10 tokens" },
                        { aud: 5, tokens: 50, label: "50 tokens" },
                        { aud: 10, tokens: 100, label: "100 tokens" },
                        { aud: 20, tokens: 200, label: "200 tokens" },
                      ]
                  ).map((option) => (
                    <button
                      key={option.aud}
                      onClick={() => setTokenPurchaseAmount(option.aud)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        tokenPurchaseAmount === option.aud
                          ? purchaseTokenType === "app"
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-violet-500 bg-violet-500/10"
                          : "border-border-secondary bg-bg-tertiary/50 hover:border-text-faint"
                      }`}
                    >
                      <div className="text-lg font-bold text-text-primary">
                        ${option.aud} AUD
                      </div>
                      <div
                        className={`text-xs ${purchaseTokenType === "app" ? "text-blue-400" : "text-violet-400"}`}
                      >
                        {option.label}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm font-medium">
                    $
                  </span>
                  <input
                    type="number"
                    min={1}
                    placeholder="Custom amount"
                    value={tokenPurchaseAmount || ""}
                    onChange={(e) =>
                      setTokenPurchaseAmount(
                        Math.max(0, parseInt(e.target.value) || 0),
                      )
                    }
                    className={`w-full pl-7 pr-16 py-2.5 bg-bg-tertiary/50 border rounded-xl text-text-primary text-sm font-medium focus:outline-none transition placeholder-text-muted ${
                      purchaseTokenType === "app"
                        ? "border-blue-500/30 focus:border-blue-500"
                        : "border-violet-500/30 focus:border-violet-500"
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                    AUD
                  </span>
                </div>
                {tokenPurchaseAmount > 0 && (
                  <div
                    className={`mt-3 p-3 rounded-xl border ${
                      purchaseTokenType === "app"
                        ? "bg-blue-500/5 border-blue-500/20"
                        : "bg-violet-500/5 border-violet-500/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">
                        You&apos;ll receive
                      </span>
                      <span
                        className={`text-lg font-bold ${purchaseTokenType === "app" ? "text-blue-400" : "text-violet-400"}`}
                      >
                        {purchaseTokenType === "app"
                          ? tokenPurchaseAmount
                          : tokenPurchaseAmount * 10}{" "}
                        tokens
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 pb-6 space-y-3 flex-shrink-0">
                {tokenPurchaseAmount > 0 && (
                  <button
                    onClick={purchaseTokens}
                    disabled={isProcessingTokenPurchase}
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                      purchaseTokenType === "app"
                        ? "bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400"
                        : "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400"
                    }`}
                  >
                    {isProcessingTokenPurchase ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
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
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                        Pay ${tokenPurchaseAmount} AUD -{" "}
                        {purchaseTokenType === "app"
                          ? tokenPurchaseAmount
                          : tokenPurchaseAmount * 10}{" "}
                        tokens
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowTokenPurchaseModal(false);
                    setInsufficientTokenMessage(null);
                  }}
                  className="w-full px-5 py-2.5 text-text-tertiary hover:text-text-primary text-sm font-medium transition"
                >
                  Cancel
                </button>
                {tokenPurchaseAmount > 0 && (
                  <p className="text-xs text-text-muted text-center">
                    Secure payment powered by Stripe
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

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
                        Cancelling now will refund your integration tokens.
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
                          const editCost = getEditIntegrationCost();
                          const userRef = doc(db, "users", user.uid);
                          await updateDoc(userRef, {
                            integrationTokens: increment(editCost),
                          });
                          await refreshUserData();
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
        setError={setError}
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
          onBuyTokens={(tokenType) => {
            setPurchaseTokenType(tokenType);
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
      {isNewUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <style>{`
            @keyframes welcome-modal-in {
              from { opacity: 0; transform: scale(0.9) translateY(20px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes welcome-logo-float {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-6px); }
            }
            @keyframes welcome-logo-glow-pulse {
              0%, 100% { opacity: 0.4; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(1.15); }
            }
            @keyframes welcome-ring-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes welcome-ring-spin-reverse {
              from { transform: rotate(360deg); }
              to { transform: rotate(0deg); }
            }
            @keyframes welcome-particle {
              0% { opacity: 0; transform: translate(0, 0) scale(0); }
              20% { opacity: 1; transform: scale(1); }
              100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
            }
            @keyframes welcome-shine-sweep {
              0% { transform: translateX(-100%) rotate(25deg); }
              100% { transform: translateX(200%) rotate(25deg); }
            }
            @keyframes welcome-bracket-blink {
              0%, 40%, 100% { opacity: 0.6; }
              20% { opacity: 1; }
            }
            @keyframes welcome-text-in {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes welcome-card-in {
              from { opacity: 0; transform: translateX(-12px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
          <div
            className="bg-bg-secondary border border-border-secondary/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            style={{
              animation:
                "welcome-modal-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          >
            {/* Animated Logo Header */}
            <div className="relative px-6 pt-10 pb-4 text-center overflow-hidden">
              {/* Background radial glow */}
              <div
                className="absolute inset-0 flex items-start justify-center pointer-events-none"
                style={{ top: "-20px" }}
              >
                <div
                  className="w-64 h-64 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)",
                    animation:
                      "welcome-logo-glow-pulse 3s ease-in-out infinite",
                  }}
                />
              </div>

              {/* Logo container with floating animation */}
              <div
                className="relative inline-block mb-5"
                style={{
                  animation: "welcome-logo-float 4s ease-in-out infinite",
                }}
              >
                {/* Outer orbiting ring */}
                <div
                  className="absolute -inset-5 rounded-full border border-blue-500/20 border-dashed"
                  style={{ animation: "welcome-ring-spin 12s linear infinite" }}
                />
                {/* Inner orbiting ring */}
                <div
                  className="absolute -inset-3 rounded-full border border-violet-500/25"
                  style={{
                    animation: "welcome-ring-spin-reverse 8s linear infinite",
                  }}
                />

                {/* Orbiting dots on the rings */}
                <div
                  className="absolute -inset-5"
                  style={{ animation: "welcome-ring-spin 12s linear infinite" }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 bg-violet-400 rounded-full shadow-lg shadow-violet-400/50" />
                </div>
                <div
                  className="absolute -inset-3"
                  style={{
                    animation: "welcome-ring-spin-reverse 8s linear infinite",
                  }}
                >
                  <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-lg shadow-indigo-400/50" />
                </div>

                {/* Floating particles */}
                {[
                  {
                    tx: "-30px",
                    ty: "-40px",
                    delay: "0s",
                    dur: "2.5s",
                    size: "3px",
                    color: "#60a5fa",
                  },
                  {
                    tx: "35px",
                    ty: "-25px",
                    delay: "0.4s",
                    dur: "3s",
                    size: "2px",
                    color: "#a78bfa",
                  },
                  {
                    tx: "-25px",
                    ty: "35px",
                    delay: "0.8s",
                    dur: "2.8s",
                    size: "2.5px",
                    color: "#818cf8",
                  },
                  {
                    tx: "40px",
                    ty: "30px",
                    delay: "1.2s",
                    dur: "3.2s",
                    size: "2px",
                    color: "#60a5fa",
                  },
                  {
                    tx: "-40px",
                    ty: "5px",
                    delay: "1.6s",
                    dur: "2.6s",
                    size: "3px",
                    color: "#c084fc",
                  },
                  {
                    tx: "20px",
                    ty: "-45px",
                    delay: "2s",
                    dur: "2.9s",
                    size: "2px",
                    color: "#818cf8",
                  },
                ].map((p, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2 rounded-full"
                    style={
                      {
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        boxShadow: `0 0 6px ${p.color}`,
                        "--tx": p.tx,
                        "--ty": p.ty,
                        animation: `welcome-particle ${p.dur} ease-out ${p.delay} infinite`,
                      } as React.CSSProperties
                    }
                  />
                ))}

                {/* The actual logo with glow shadow */}
                <div
                  className="relative"
                  style={{
                    filter:
                      "drop-shadow(0 0 20px rgba(99,102,241,0.4)) drop-shadow(0 0 40px rgba(139,92,246,0.2))",
                  }}
                >
                  <Logo size={72} animate />
                  {/* Shine sweep overlay */}
                  <div
                    className="absolute inset-0 overflow-hidden rounded-2xl"
                    style={{ borderRadius: "18px" }}
                  >
                    <div
                      className="absolute inset-0 w-[200%]"
                      style={{
                        background:
                          "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 60%)",
                        animation:
                          "welcome-shine-sweep 3s ease-in-out 0.5s infinite",
                      }}
                    />
                  </div>
                </div>
              </div>

              <h3
                className="text-2xl font-bold text-text-primary mb-2"
                style={{ animation: "welcome-text-in 0.5s ease-out 0.3s both" }}
              >
                Welcome to Pocket Dev!
              </h3>
              <p
                className="text-text-tertiary text-sm"
                style={{ animation: "welcome-text-in 0.5s ease-out 0.5s both" }}
              >
                We&apos;ve given you free tokens to get started. Here&apos;s how
                they work:
              </p>
            </div>

            {/* Token Explanation */}
            <div className="px-6 py-4 space-y-3">
              {/* App Tokens */}
              <div
                className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl"
                style={{ animation: "welcome-card-in 0.5s ease-out 0.6s both" }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/30 to-blue-600/20 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
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
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">
                      App Tokens
                    </h4>
                    <p className="text-xs text-blue-400 font-medium">
                      4 free tokens awarded
                    </p>
                  </div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  App tokens let you create new projects. Each new project costs{" "}
                  <span className="text-text-primary font-medium">
                    2 app tokens
                  </span>
                  , so you can create{" "}
                  <span className="text-text-primary font-medium">
                    2 projects
                  </span>{" "}
                  for free.
                </p>
              </div>

              {/* Integration Tokens */}
              <div
                className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl"
                style={{
                  animation: "welcome-card-in 0.5s ease-out 0.75s both",
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/30 to-violet-600/20 flex items-center justify-center flex-shrink-0 border border-violet-500/20">
                    <svg
                      className="w-4 h-4 text-violet-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">
                      Integration Tokens
                    </h4>
                    <p className="text-xs text-violet-400 font-medium">
                      10 free tokens awarded
                    </p>
                  </div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Integration tokens let you make AI-powered edits to your
                  projects. Each edit costs{" "}
                  <span className="text-text-primary font-medium">
                    1 integration token
                  </span>
                  , so you get{" "}
                  <span className="text-text-primary font-medium">
                    10 edits
                  </span>{" "}
                  for free.
                </p>
              </div>

              {/* Buy More Note */}
              <p
                className="text-xs text-text-muted text-center"
                style={{ animation: "welcome-text-in 0.5s ease-out 0.9s both" }}
              >
                Need more? You can buy additional tokens anytime from the
                sidebar or the Tokens page.
              </p>
            </div>

            {/* CTA */}
            <div
              className="px-6 pb-6"
              style={{ animation: "welcome-text-in 0.5s ease-out 1s both" }}
            >
              <button
                onClick={clearNewUser}
                className="w-full px-5 py-3 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                Got it, let&apos;s go!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Token Deduction Confirmation Modal */}
      {showTokenConfirmModal &&
        (() => {
          const isGeneration = showTokenConfirmModal === "app";
          const genIntegrationCost = getGenerationIntegrationCost();
          const editIntCost = getEditIntegrationCost();
          const appCost = isGeneration ? 2 : 0;
          const integrationCost = isGeneration
            ? genIntegrationCost
            : editIntCost;
          const appBalance = userData?.appTokens || 0;
          const integrationBalance = userData?.integrationTokens || 0;

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="relative px-6 pt-8 pb-4 text-center">
                  <button
                    onClick={() => setShowTokenConfirmModal(null)}
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
                  <div
                    className={`inline-flex items-center justify-center w-14 h-14 mb-4 rounded-2xl ${
                      isGeneration
                        ? "bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30"
                        : "bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30"
                    }`}
                  >
                    <svg
                      className={`w-7 h-7 ${isGeneration ? "text-blue-400" : "text-violet-400"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mb-1">
                    {isGeneration ? "Create New Project" : "Edit Project"}
                  </h3>
                  <p className="text-text-tertiary text-sm">
                    {isGeneration
                      ? "This action will deduct tokens from your balance."
                      : "This edit will deduct tokens from your balance."}
                  </p>
                </div>

                {/* Token Details */}
                <div className="px-6 pb-4 space-y-3">
                  {/* App Tokens section (generation only) */}
                  {appCost > 0 && (
                    <div className="p-4 rounded-xl border bg-blue-500/5 border-blue-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">
                          App Tokens
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-text-secondary">
                          Project creation
                        </span>
                        <span className="text-sm font-bold text-blue-400">
                          -{appCost}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-text-tertiary pt-2 border-t border-border-secondary/50">
                        <span>Balance: {appBalance}</span>
                        <span>After: {appBalance - appCost}</span>
                      </div>
                    </div>
                  )}

                  {/* Integration Tokens section */}
                  {integrationCost > 0 && (
                    <div className="p-4 rounded-xl border bg-violet-500/5 border-violet-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">
                          Integration Tokens
                        </span>
                      </div>
                      {isGeneration ? (
                        <>
                          {currentAppAuth.includes("username-password") && (
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-text-secondary">
                                Username & Password auth
                              </span>
                              <span className="text-sm font-bold text-violet-400">
                                -30
                              </span>
                            </div>
                          )}
                          {currentAppAuth.includes("google") && (
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-text-secondary">
                                Google OAuth auth
                              </span>
                              <span className="text-sm font-bold text-violet-400">
                                -30
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {editAppAuth.includes("username-password") && (
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-text-secondary">
                                Username & Password auth
                              </span>
                              <span className="text-sm font-bold text-violet-400">
                                -30
                              </span>
                            </div>
                          )}
                          {editAppAuth.includes("google") && (
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-text-secondary">
                                Google OAuth auth
                              </span>
                              <span className="text-sm font-bold text-violet-400">
                                -30
                              </span>
                            </div>
                          )}
                          {editAppAuth.length === 0 && (
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-text-secondary">
                                Edit changes
                              </span>
                              <span className="text-sm font-bold text-violet-400">
                                -3
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex items-center justify-between text-xs text-text-tertiary pt-2 border-t border-border-secondary/50">
                        <span>Balance: {integrationBalance}</span>
                        <span>
                          After: {integrationBalance - integrationCost}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                    <svg
                      className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                      />
                    </svg>
                    <p className="text-xs text-amber-200/80">
                      Tokens are non-refundable once deducted, even if you
                      cancel during the process.
                    </p>
                  </div>
                  {!isGeneration && (
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={skipEditTokenConfirm}
                        onChange={(e) => {
                          setSkipEditTokenConfirm(e.target.checked);
                          localStorage.setItem(
                            "skipEditTokenConfirm",
                            String(e.target.checked),
                          );
                        }}
                        className="w-4 h-4 rounded border-text-faint bg-bg-tertiary text-violet-500 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-xs text-text-tertiary group-hover:text-text-secondary transition">
                        Don&apos;t show this again for edits
                      </span>
                    </label>
                  )}
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 space-y-2">
                  <button
                    onClick={() => {
                      if (isGeneration) {
                        setShowTokenConfirmModal(null);
                        startGeneration();
                      } else {
                        proceedWithEdit();
                      }
                    }}
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold rounded-xl transition-all text-white ${
                      isGeneration
                        ? "bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400"
                        : "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400"
                    }`}
                  >
                    {isGeneration ? "Create Project" : "Start Edit"}
                  </button>
                  <button
                    onClick={() => setShowTokenConfirmModal(null)}
                    className="w-full px-5 py-2.5 text-text-tertiary hover:text-text-primary text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
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
                const editCost = getEditIntegrationCost();
                const userRef = doc(db, "users", user.uid);
                await updateDoc(userRef, {
                  integrationTokens: increment(editCost),
                });
                await refreshUserData();
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

      <DatabaseModal
        isOpen={showDbModal}
        onClose={() => setShowDbModal(false)}
      />

      <TokenPurchaseModal
        isOpen={showTokenPurchaseModal}
        onClose={() => setShowTokenPurchaseModal(false)}
        tokenType={purchaseTokenType}
        onTokenTypeChange={setPurchaseTokenType}
        amount={tokenPurchaseAmount}
        onAmountChange={setTokenPurchaseAmount}
        appTokens={userData?.appTokens || 0}
        integrationTokens={userData?.integrationTokens || 0}
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
