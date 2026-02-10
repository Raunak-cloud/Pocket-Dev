"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { generateReact } from "./react-actions";
import Logo from "./components/Logo";
import sdk from "@stackblitz/sdk";
import type { VM } from "@stackblitz/sdk";
import { prepareStackBlitzFiles, waitForPreview } from "@/lib/stackblitz-utils";
import { useAuth } from "./contexts/AuthContext";
import JSZip from "jszip";
import SignInModal from "./components/SignInModal";
import DashboardSidebar from "./components/DashboardSidebar";
import GenerationProgress from "./components/GenerationProgress";
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

interface GeneratedFile {
  path: string;
  content: string;
}

interface ReactProject {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintReport: {
    passed: boolean;
    errors: number;
    warnings: number;
  };
}

interface UploadedFile {
  name: string;
  type: string;
  dataUrl: string;
  downloadUrl?: string; // Firebase Storage URL
}

interface SavedProject {
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
}

interface EditHistoryEntry {
  id: string;
  prompt: string;
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  timestamp: Date;
}

const ADMIN_EMAIL = "raunak.vision@gmail.com";

interface TicketMessage {
  sender: "user" | "admin";
  text: string;
  timestamp: Date;
}

interface SupportTicket {
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

const EXAMPLES = [
  {
    icon: "🛍️",
    name: "E-Commerce",
    desc: "Product listings, cart & checkout",
    query:
      "Create a modern e-commerce Next.js app with product listings, shopping cart, and checkout pages using App Router and server components",
  },
  {
    icon: "🍕",
    name: "Restaurant",
    desc: "Menu, reservations & about",
    query:
      "Create a restaurant Next.js app with menu, reservations, and about pages using dynamic routes and App Router",
  },
  {
    icon: "🚀",
    name: "SaaS Landing",
    desc: "Features, pricing & signup",
    query:
      "Create a SaaS landing page Next.js app with features, pricing, and signup sections using App Router and optimized metadata",
  },
  {
    icon: "📸",
    name: "Portfolio",
    desc: "Projects gallery & contact",
    query:
      "Create a creative portfolio Next.js app with projects gallery, about, and contact pages using App Router and Next.js Image optimization",
  },
  {
    icon: "📝",
    name: "Blog",
    desc: "Posts, categories & search",
    query:
      "Create a modern blog Next.js app with post listings, categories, and search using App Router and dynamic routes",
  },
  {
    icon: "🏋️",
    name: "Fitness",
    desc: "Workouts, plans & progress",
    query:
      "Create a fitness tracker Next.js app with workout plans, exercise library, and progress tracking using App Router and client components",
  },
];

// StackBlitz preview component with loading state
function StackBlitzPreview({
  project,
  previewKey,
}: {
  project: ReactProject | null;
  previewKey: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const vmRef = useRef<VM | null>(null);
  const prevFilesRef = useRef<Record<string, string> | null>(null);
  const projectRef = useRef<ReactProject | null>(null);
  const [loadingState, setLoadingState] = useState<
    "initializing" | "loading" | "ready" | "error"
  >("initializing");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Keep project ref in sync for use in embed creation effect
  projectRef.current = project;

  // Effect 1: Full embed creation — only when previewKey changes (new generation / open project)
  useEffect(() => {
    if (!projectRef.current || !wrapperRef.current) return;

    let mounted = true;
    let initTimeout: NodeJS.Timeout;
    vmRef.current = null;

    const initializeEmbed = async () => {
      // Wait for React to finish rendering
      await new Promise((resolve) => {
        initTimeout = setTimeout(resolve, 1000);
      });

      if (!mounted || !wrapperRef.current || !projectRef.current) return;

      try {
        setLoadingState("initializing");
        setError(null);

        // Safely clear any previous StackBlitz embed from the DOM
        const wrapper = wrapperRef.current;
        while (wrapper.firstChild) {
          wrapper.removeChild(wrapper.firstChild);
        }

        // Create a fresh container element for the new embed
        const container = document.createElement("div");
        container.className = "w-full h-full min-h-[85vh]";
        wrapper.appendChild(container);

        const files = prepareStackBlitzFiles(projectRef.current);

        const vm = await sdk.embedProject(
          container,
          {
            title: "Generated Next.js App",
            description: "Next.js app generated by Pocket Dev",
            template: "node",
            files,
          },
          {
            height: "100%",
            view: "preview",
            theme: "dark",
            hideExplorer: true,
            hideDevTools: true,
            hideNavigation: true,
            forceEmbedLayout: true,
          },
        );

        if (!mounted) return;

        vmRef.current = vm;
        prevFilesRef.current = files;
        setLoadingState("loading");

        try {
          await waitForPreview(vm);
          if (mounted) {
            setLoadingState("ready");
          }
        } catch (waitErr) {
          if (mounted) {
            setLoadingState("ready");
          }
        }
      } catch (err) {
        console.error("StackBlitz embed error:", err);
        if (mounted) {
          setLoadingState("error");
          setError(
            err instanceof Error ? err.message : "Failed to load preview",
          );
        }
      }
    };

    initializeEmbed();

    return () => {
      mounted = false;
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      vmRef.current = null;
      // Safely clean up StackBlitz DOM on unmount
      if (wrapperRef.current) {
        try {
          while (wrapperRef.current.firstChild) {
            wrapperRef.current.removeChild(wrapperRef.current.firstChild);
          }
        } catch {
          // StackBlitz may have already cleaned up
        }
      }
    };
  }, [previewKey, retryCount]);

  // Effect 2: Apply file diffs on project change (edits / rollbacks) without recreating embed
  useEffect(() => {
    if (!project) return;

    const newFiles = prepareStackBlitzFiles(project);

    // If no VM yet (embed still initializing), just store files for future diffing
    if (!vmRef.current) {
      prevFilesRef.current = newFiles;
      return;
    }

    const oldFiles = prevFilesRef.current || {};

    // Compute diff
    const create: Record<string, string> = {};
    const destroy: string[] = [];

    for (const [path, content] of Object.entries(newFiles)) {
      if (oldFiles[path] !== content) {
        create[path] = content;
      }
    }
    for (const path of Object.keys(oldFiles)) {
      if (!(path in newFiles)) {
        destroy.push(path);
      }
    }

    if (Object.keys(create).length > 0 || destroy.length > 0) {
      vmRef.current
        .applyFsDiff({ create, destroy })
        .then(() => {
          prevFilesRef.current = newFiles;
        })
        .catch((err) => {
          console.error("Error applying file diff, falling back to full reload:", err);
          prevFilesRef.current = newFiles;
          setRetryCount((prev) => prev + 1);
        });
    } else {
      prevFilesRef.current = newFiles;
    }
  }, [project]);

  return (
    <div className="relative h-full">
      {/* Loading overlay */}
      {loadingState !== "ready" && loadingState !== "error" && (
        <div className="absolute inset-0 bg-slate-900 z-10 flex items-center justify-center">
          <div className="text-center">
            {/* Modern loading animation */}
            <div className="relative w-20 h-20 mx-auto mb-4">
              {/* Outer rotating ring */}
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              {/* Spinning gradient ring */}
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-violet-500 rounded-full animate-spin"></div>
              {/* Inner pulsing dot */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-300 mb-1">
              {loadingState === "initializing" && "Initializing..."}
              {loadingState === "loading" && "Starting Next.js dev server..."}
            </p>
            <p className="text-xs text-slate-500">
              {loadingState === "initializing" && "Setting up WebContainer"}
              {loadingState === "loading" &&
                "Installing dependencies and building"}
            </p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {loadingState === "error" && (
        <div className="absolute inset-0 bg-slate-900 z-10 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Preview Error
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {error ||
                "There was an issue loading the preview. Try refreshing the page or regenerating the project."}
            </p>
            <button
              onClick={() => {
                setRetryCount((prev) => prev + 1);
                setLoadingState("initializing");
                setError(null);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stable wrapper — StackBlitz containers are managed imperatively inside */}
      {/* Wrapper with overflow hidden to crop the bottom footer */}
      <div className="w-full h-full overflow-hidden">
        <div
          ref={wrapperRef}
          className="w-full"
          style={{ height: "calc(100% + 50px)" }}
        />
      </div>
    </div>
  );
}

function ReactGeneratorContent() {
  const { user, userData, loading: authLoading, refreshUserData, isNewUser, clearNewUser } = useAuth();
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
  const [isGenerationMinimized, setIsGenerationMinimized] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [previewMode, setPreviewMode] = useState<
    "mobile" | "tablet" | "desktop"
  >("desktop");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [editProgressMessages, setEditProgressMessages] = useState<string[]>(
    [],
  );
  const [isEditMinimized, setIsEditMinimized] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [editFiles, setEditFiles] = useState<UploadedFile[]>([]);
  const [showTokenPurchaseModal, setShowTokenPurchaseModal] = useState(false);
  const [purchaseTokenType, setPurchaseTokenType] = useState<"app" | "integration">("app");
  const [tokenPurchaseAmount, setTokenPurchaseAmount] = useState(0);
  const [isProcessingTokenPurchase, setIsProcessingTokenPurchase] = useState(false);
  const [showTokenConfirmModal, setShowTokenConfirmModal] = useState<"app" | "integration" | null>(null);
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
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentAppAuth, setCurrentAppAuth] = useState<string[]>([]);
  const [insufficientTokenMessage, setInsufficientTokenMessage] = useState<string | null>(null);
  const [editAppAuth, setEditAppAuth] = useState<string[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubRepoName, setGithubRepoName] = useState("");
  const [githubPrivate, setGithubPrivate] = useState(false);
  const [githubExportStatus, setGithubExportStatus] = useState<
    "idle" | "exporting" | "success" | "error"
  >("idle");
  const [githubExportMessage, setGithubExportMessage] = useState("");
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [exportSuccessMessage, setExportSuccessMessage] = useState("");
  // Support ticket state
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [adminTickets, setAdminTickets] = useState<SupportTicket[]>([]);
  const [ticketCategory, setTicketCategory] = useState<SupportTicket["category"]>("general");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketProjectId, setTicketProjectId] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [adminResponse, setAdminResponse] = useState("");
  const [respondingToTicketId, setRespondingToTicketId] = useState<string | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [userReplyText, setUserReplyText] = useState("");
  const [replyingToTicketId, setReplyingToTicketId] = useState<string | null>(null);
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
        const timeout = setTimeout(() => {
          setTypingPlaceholder(current.slice(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        }, 35 + Math.random() * 25);
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
        setPlaceholderIndex((placeholderIndex + 1) % placeholderExamples.length);
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

            const targetProject = projects.find(p => p.id === pendingEdit.projectId);
            if (targetProject) {
              // Reopen the project
              openSavedProject(targetProject);
              // Restore edit prompt and auth
              setEditPrompt(pendingEdit.editPrompt || "");
              setEditAppAuth(pendingEdit.editAppAuth || []);
              // Auto-trigger the edit after a short delay for UI to settle
              setTimeout(() => {
                alert(`Payment successful! ${amount} ${tokenType} tokens added. Your edit will now continue.`);
              }, 500);
              return;
            }
          } catch (e) {
            console.error("Error restoring pending edit:", e);
          }
        }

        alert(`Payment successful! ${amount} ${tokenType} tokens have been added to your account.`);
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
      lintReport: projectData.lintReport || { passed: true, errors: 0, warnings: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
      lintReport: projectData.lintReport || { passed: true, errors: 0, warnings: 0 },
      updatedAt: serverTimestamp(),
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
          timestamp: m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp),
        }));

        // Calculate unread admin message count
        const lastReadByUserAt = data.lastReadByUserAt?.toDate() || new Date(0);
        const unreadAdminMessageCount = messages.filter(
          (m: TicketMessage) => m.sender === "admin" && m.timestamp > lastReadByUserAt
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
            timestamp: m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp),
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
        const proj = savedProjects.find(p => p.id === ticketProjectId);
        ticketData.projectId = ticketProjectId;
        ticketData.projectName = proj ? proj.prompt.substring(0, 60) : ticketProjectId;
      }
      ticketData.messages = [{ sender: "user", text: ticketDescription.trim(), timestamp: new Date() }];
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
  const respondToTicket = async (ticketId: string, response: string, newStatus: SupportTicket["status"]) => {
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
        messages: [...existing, { sender: "admin", text: response.trim(), timestamp: new Date() }],
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
        messages: [...existing, { sender: "user", text: userReplyText.trim(), timestamp: new Date() }],
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
        timestamp: d.data().timestamp instanceof Timestamp
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
      // Preview updates via applyFsDiff (Effect 2 in StackBlitzPreview)
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
      lintReport: savedProject.lintReport || { passed: true, errors: 0, warnings: 0 },
    });
    setCurrentProjectId(savedProject.id);
    setGenerationPrompt(savedProject.prompt);
    setPublishedUrl(savedProject.publishedUrl || null);
    setDeploymentId(savedProject.deploymentId || null);
    setCustomDomain(savedProject.customDomain || "");
    setHasUnpublishedChanges(false);
    setStatus("success");
    setActiveSection("create");
    // Force StackBlitz to re-initialize with new project data
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
      if (currentProjectId && status === "success" && (editPrompt.trim() || editAppAuth.length > 0)) {
        sessionStorage.setItem("pendingEdit", JSON.stringify({
          projectId: currentProjectId,
          editPrompt: editPrompt.trim(),
          editAppAuth,
        }));
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

  // Publish the project to Vercel
  const publishProject = async () => {
    if (!project || !currentProjectId || !user) return;

    setIsPublishing(true);
    setError("");
    try {
      // Call our publish API with the original Next.js project files
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: project.files,
          dependencies: project.dependencies,
          projectId: currentProjectId,
          title: generationPrompt || "Pocket Dev App",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to publish");
      }

      const publishUrl = data.url;
      const newDeploymentId = data.deploymentId;

      // Update project in Firestore with publish info
      const projectRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectRef, {
        isPublished: true,
        publishedUrl: publishUrl,
        deploymentId: newDeploymentId,
        publishedAt: serverTimestamp(),
      });

      setPublishedUrl(publishUrl);
      setDeploymentId(newDeploymentId);
      setHasUnpublishedChanges(false);
      loadSavedProjects();
    } catch (error) {
      console.error("Error publishing project:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to publish project. Please try again.",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // Connect custom domain
  const connectDomain = async (domain: string) => {
    if (!currentProjectId || !user) return;

    try {
      const projectRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectRef, {
        customDomain: domain,
      });
      setCustomDomain(domain);
      setShowDomainModal(false);
      loadSavedProjects();
    } catch (error) {
      console.error("Error connecting domain:", error);
      setError("Failed to connect domain. Please try again.");
    }
  };

  // Unpublish the project
  const unpublishProject = async () => {
    if (!currentProjectId || !user) return;

    try {
      // Delete the Vercel deployment if we have a deployment ID
      if (deploymentId) {
        try {
          await fetch("/api/publish", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deploymentId }),
          });
        } catch (deleteError) {
          console.error("Error deleting Vercel deployment:", deleteError);
          // Continue with unpublishing even if Vercel delete fails
        }
      }

      const projectRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectRef, {
        isPublished: false,
        publishedUrl: null,
        deploymentId: null,
        publishedAt: null,
        customDomain: null,
      });
      setPublishedUrl(null);
      setDeploymentId(null);
      setCustomDomain("");
      setShowDomainModal(false);
      setHasUnpublishedChanges(false);
      loadSavedProjects();
    } catch (error) {
      console.error("Error unpublishing project:", error);
      setError("Failed to unpublish project. Please try again.");
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

  const confirmCancelGeneration = () => {
    generationCancelledRef.current = true;
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
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
    if ((!editPrompt.trim() && editAppAuth.length === 0) || isEditing || !project) return;

    // Check integration token balance based on auth selection
    const editCost = getEditIntegrationCost();
    const integrationBalance = userData?.integrationTokens || 0;
    if (integrationBalance < editCost) {
      const deficit = editCost - integrationBalance;
      const authNames = [
        ...(editAppAuth.includes("username-password") ? ["Username/Password"] : []),
        ...(editAppAuth.includes("google") ? ["Google OAuth"] : []),
      ];
      const reason = authNames.length > 0
        ? `This edit with ${authNames.join(" + ")} authentication requires ${editCost} integration tokens`
        : `This edit requires ${editCost} integration tokens`;
      setInsufficientTokenMessage(`${reason} but you only have ${integrationBalance}. Please purchase at least ${deficit} more integration token${deficit > 1 ? "s" : ""} to continue.`);
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
    const editProgressSteps = [
      "Analyzing current code structure...",
      "Understanding your edit request...",
      "Planning code modifications...",
      "Applying changes to components...",
      "Updating styles and layout...",
      "Validating code integrity...",
      "Finalizing changes...",
    ];

    let stepIndex = 0;
    const editProgressInterval = setInterval(() => {
      if (stepIndex < editProgressSteps.length) {
        setEditProgressMessages((prev) => [
          ...prev,
          editProgressSteps[stepIndex],
        ]);
        stepIndex++;
      }
    }, 10000); // 10 seconds per step

    // Build context from current project
    const currentFiles = project.files
      .map((f) => `// ${f.path}\n${f.content}`)
      .join("\n\n---\n\n");

    // List all existing file paths
    const existingFilePaths = project.files.map((f) => f.path).join(", ");

    // Build the user request text, including auth if selected
    const authLabels: string[] = [];
    if (editAppAuth.includes("username-password")) authLabels.push("Username/Password authentication");
    if (editAppAuth.includes("google")) authLabels.push("Google OAuth authentication");
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
8. Keep everything else EXACTLY as it was before`;

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
        const editPromptText = editPrompt.trim() || (authLabels.length > 0 ? `Add ${authLabels.join(" and ")}` : "Edit");
        const historyRef = collection(db, "projects", currentProjectId, "editHistory");
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
      // Filter for images and PDFs (Anthropic API supports both)
      const mediaFiles = editFiles.filter(
        (f) => f.type.startsWith("image/") || f.type === "application/pdf",
      );

      const result = await generateReact(editFullPrompt, mediaFiles);

      clearInterval(editProgressInterval);

      // Wait for all progress steps to complete before showing the updated website
      const currentStepCount = stepIndex;
      const remainingSteps = editProgressSteps.length - currentStepCount;

      if (remainingSteps > 0) {
        // Show remaining steps immediately one by one
        for (let i = currentStepCount; i < editProgressSteps.length; i++) {
          setEditProgressMessages((prev) => [...prev, editProgressSteps[i]]);
          if (i < editProgressSteps.length - 1) {
            // Wait 10 seconds between steps (except for the last one)
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }
        }
      }

      setEditProgressMessages((prev) => [...prev, "Merging changes..."]);

      // Validate and merge: ensure no files are lost
      const existingFileMap = new Map(project.files.map((f) => [f.path, f]));
      const newFileMap = new Map(result.files.map((f) => [f.path, f]));

      // Merge: keep all existing files, update with new versions if provided
      const mergedFiles = Array.from(existingFileMap.entries()).map(
        ([path, oldFile]) => {
          return newFileMap.get(path) || oldFile; // Use new version if exists, otherwise keep old
        },
      );

      // Add any completely new files from the result
      result.files.forEach((newFile) => {
        if (!existingFileMap.has(newFile.path)) {
          mergedFiles.push(newFile);
        }
      });

      // Persist Pollinations AI images to Firebase Storage so they don't change on reload
      setEditProgressMessages((prev) => [...prev, "Persisting images..."]);
      const persistedMergedFiles = await persistPollinationsImages(mergedFiles, user?.uid ?? "anonymous");
      const mergedProject = {
        ...result,
        files: persistedMergedFiles,
      };

      setProject(mergedProject);
      setEditPrompt("");
      setEditFiles([]); // Clear edit files after successful edit
      setEditAppAuth([]); // Reset edit auth after successful edit

      // Preview updates via applyFsDiff (Effect 2 in StackBlitzPreview)

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
      clearInterval(editProgressInterval);
      setError(err instanceof Error ? err.message : "Edit failed");
    } finally {
      setIsEditing(false);
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

    const progressSteps = [
      "Analyzing requirements...",
      "Designing architecture...",
      "Creating components...",
      "Building pages...",
      "Styling with Tailwind...",
      "Setting up routing...",
      "Running checks...",
    ];

    let stepIndex = 0;
    progressIntervalRef.current = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        setProgressMessages((prev) => [...prev, progressSteps[stepIndex]]);
        stepIndex++;
      }
    }, 10000); // 10 seconds per step
    const progressInterval = progressIntervalRef.current;

    try {
      // Filter for images and PDFs (Anthropic API supports both)
      const mediaFiles = uploadedFiles.filter(
        (f) => f.type.startsWith("image/") || f.type === "application/pdf",
      );

      let result = await generateReact(fullPrompt, mediaFiles);
      clearInterval(progressInterval);
      progressIntervalRef.current = null;

      // If user cancelled while awaiting, discard the result
      if (generationCancelledRef.current) {
        return;
      }

      // Wait for all progress steps to complete before showing the website
      const currentStepCount = stepIndex;
      const remainingSteps = progressSteps.length - currentStepCount;

      if (remainingSteps > 0) {
        // Show remaining steps immediately one by one
        for (let i = currentStepCount; i < progressSteps.length; i++) {
          setProgressMessages((prev) => [...prev, progressSteps[i]]);
          if (i < progressSteps.length - 1) {
            // Wait 10 seconds between steps (except for the last one)
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }
        }
      }

      setProgressMessages((prev) => [...prev, "Saving project..."]);

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
      const persistedFiles = await persistPollinationsImages(result.files, user?.uid ?? "anonymous");
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
    } catch (err) {
      clearInterval(progressInterval);
      progressIntervalRef.current = null;
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

    if (!prompt.trim() || status === "loading") return;

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
      setInsufficientTokenMessage(`You need 2 app tokens to create a project but only have ${appTokenBalance}. Please purchase at least ${deficit} more app token${deficit > 1 ? "s" : ""} to continue.`);
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
          ...(currentAppAuth.includes("username-password") ? ["Username/Password"] : []),
          ...(currentAppAuth.includes("google") ? ["Google OAuth"] : []),
        ].join(" + ");
        const deficit = integrationCost - integrationBalance;
        setInsufficientTokenMessage(`Adding ${authNames} authentication requires ${integrationCost} integration tokens but you only have ${integrationBalance}. Please purchase at least ${deficit} more integration token${deficit > 1 ? "s" : ""} to continue.`);
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

  const openInStackBlitz = () => {
    if (!project) return;

    const files = prepareStackBlitzFiles(project);

    sdk.openProject(
      {
        title: "Generated Next.js App",
        description: "Next.js app generated by Pocket Dev",
        template: "node", // Next.js requires Node.js runtime
        files,
      },
      { openFile: "app/page.tsx", newWindow: true }, // Open main Next.js page
    );
  };

  const exportToGitHub = () => {
    if (!project) return;
    setGithubRepoName("my-nextjs-app");
    setGithubExportStatus("idle");
    setGithubExportMessage("");
    setGithubRepoUrl("");
    // Restore saved token if available
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) setGithubToken(savedToken);
    setShowGitHubModal(true);
  };

  const pushToGitHub = async () => {
    if (!project || !githubToken || !githubRepoName) return;

    setGithubExportStatus("exporting");
    setGithubExportMessage("Creating repository...");

    const headers = {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    try {
      // Save token for future use
      localStorage.setItem("github_token", githubToken);

      // 1. Create the repository
      const createRepoRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: githubRepoName,
          description: "Next.js app generated by Pocket Dev",
          private: githubPrivate,
          auto_init: false,
        }),
      });

      if (!createRepoRes.ok) {
        const errData = await createRepoRes.json();
        if (
          createRepoRes.status === 422 &&
          errData.errors?.some((e: any) =>
            e.message?.includes("already exists"),
          )
        ) {
          throw new Error(
            `Repository "${githubRepoName}" already exists. Choose a different name.`,
          );
        }
        if (createRepoRes.status === 401) {
          throw new Error(
            "Invalid GitHub token. Please check your personal access token.",
          );
        }
        throw new Error(
          errData.message ||
            `Failed to create repository (${createRepoRes.status})`,
        );
      }

      const repo = await createRepoRes.json();
      const owner = repo.owner.login;
      const repoName = repo.name;

      setGithubExportMessage("Preparing files...");

      // Build all project files
      const allFiles = prepareStackBlitzFiles(project);

      allFiles[".gitignore"] =
        `node_modules\n.next\nout\nbuild\n.DS_Store\n*.pem\nnpm-debug.log*\n.env*.local\n.vercel\n*.tsbuildinfo\nnext-env.d.ts\n`;

      allFiles["README.md"] =
        `# ${githubRepoName}\n\nNext.js app generated by [Pocket Dev](https://pocketdev.app).\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000).\n\n## Deploy\n\nDeploy with [Vercel](https://vercel.com/new).\n`;

      // 2. Create blobs for each file
      setGithubExportMessage("Uploading files...");
      const blobs: Array<{ path: string; sha: string }> = [];

      for (const [path, content] of Object.entries(allFiles)) {
        const blobRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              content: btoa(unescape(encodeURIComponent(content))),
              encoding: "base64",
            }),
          },
        );

        if (!blobRes.ok) throw new Error(`Failed to create blob for ${path}`);
        const blob = await blobRes.json();
        blobs.push({ path, sha: blob.sha });
      }

      // 3. Create tree
      setGithubExportMessage("Creating commit...");
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            tree: blobs.map((b) => ({
              path: b.path,
              mode: "100644",
              type: "blob",
              sha: b.sha,
            })),
          }),
        },
      );

      if (!treeRes.ok) throw new Error("Failed to create tree");
      const tree = await treeRes.json();

      // 4. Create commit
      const commitRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: "Initial commit from Pocket Dev",
            tree: tree.sha,
          }),
        },
      );

      if (!commitRes.ok) throw new Error("Failed to create commit");
      const commit = await commitRes.json();

      // 5. Create main branch ref
      const refRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/refs`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            ref: "refs/heads/main",
            sha: commit.sha,
          }),
        },
      );

      if (!refRes.ok) throw new Error("Failed to create branch ref");

      setGithubRepoUrl(repo.html_url);
      setGithubExportStatus("success");
      setGithubExportMessage("Successfully pushed to GitHub!");
    } catch (error: any) {
      console.error("GitHub export error:", error);
      setGithubExportStatus("error");
      setGithubExportMessage(error.message || "Failed to export to GitHub");
    }
  };

  const downloadProject = async () => {
    if (!project) return;

    setIsExporting(true);

    try {
      const zip = new JSZip();
      const files = prepareStackBlitzFiles(project);

      Object.entries(files).forEach(([path, content]) => {
        zip.file(path, content);
      });

      zip.file(
        ".gitignore",
        `# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`,
      );

      zip.file(
        "README.md",
        `# Generated Next.js App

This Next.js application was generated by [Pocket Dev](https://pocketdev.app).

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy on Vercel

The easiest way to deploy is with [Vercel](https://vercel.com/new).
`,
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nextjs-app.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      setError("Failed to download project");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToVSCode = async () => {
    if (!project) return;

    setIsExporting(true);
    setShowExportDropdown(false);

    try {
      const files = prepareStackBlitzFiles(project);
      files[".gitignore"] = `# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`;

      // Try File System Access API to write files directly to a folder
      if ("showDirectoryPicker" in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({
            mode: "readwrite",
          });

          for (const [filePath, content] of Object.entries(files)) {
            const parts = filePath.split("/");
            let currentDir = dirHandle;

            for (let i = 0; i < parts.length - 1; i++) {
              currentDir = await currentDir.getDirectoryHandle(parts[i], {
                create: true,
              });
            }

            const fileHandle = await currentDir.getFileHandle(
              parts[parts.length - 1],
              { create: true },
            );
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
          }

          setExportSuccessMessage(
            "Project exported! Open the folder in VS Code to start coding.",
          );
          setTimeout(() => setExportSuccessMessage(""), 5000);
          return;
        } catch (fsError: any) {
          if (fsError.name === "AbortError") return;
          // Fall through to ZIP download
        }
      }

      // Fallback: ZIP download
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => {
        zip.file(path, content);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nextjs-app.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccessMessage(
        "Project downloaded! Extract the ZIP and open the folder in VS Code.",
      );
      setTimeout(() => setExportSuccessMessage(""), 5000);
    } catch (error) {
      console.error("VS Code export error:", error);
      setError("Failed to export to VS Code");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCursor = async () => {
    if (!project) return;

    setIsExporting(true);
    setShowExportDropdown(false);

    try {
      const files = prepareStackBlitzFiles(project);
      files[".gitignore"] = `# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`;

      // Try File System Access API to write files directly to a folder
      if ("showDirectoryPicker" in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({
            mode: "readwrite",
          });

          for (const [filePath, content] of Object.entries(files)) {
            const parts = filePath.split("/");
            let currentDir = dirHandle;

            for (let i = 0; i < parts.length - 1; i++) {
              currentDir = await currentDir.getDirectoryHandle(parts[i], {
                create: true,
              });
            }

            const fileHandle = await currentDir.getFileHandle(
              parts[parts.length - 1],
              { create: true },
            );
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
          }

          setExportSuccessMessage(
            "Project exported! Open the folder in Cursor to start coding.",
          );
          setTimeout(() => setExportSuccessMessage(""), 5000);
          return;
        } catch (fsError: any) {
          if (fsError.name === "AbortError") return;
          // Fall through to ZIP download
        }
      }

      // Fallback: ZIP download
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => {
        zip.file(path, content);
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nextjs-app.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccessMessage(
        "Project downloaded! Extract the ZIP and open the folder in Cursor.",
      );
      setTimeout(() => setExportSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Cursor export error:", error);
      setError("Failed to export to Cursor");
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate total unread ticket count
  const unreadTicketCount = supportTickets.reduce(
    (total, ticket) => total + (ticket.unreadAdminMessageCount || 0),
    0
  );

  // SUCCESS STATE
  if (status === "success" && project) {
    return (
      <div className="h-screen bg-slate-950 flex">
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
          <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 backdrop-blur-lg z-10">
            <div className="px-4 h-14 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-px bg-slate-700" />
                <span className="inline-flex items-center gap-1.5 text-xs text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-full group relative cursor-help">
                  <svg className="w-3 h-3 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  Edit Tokens: {userData?.integrationTokens || 0}
                  <span className="hidden group-hover:block absolute top-full left-0 mt-2 w-52 p-2 bg-slate-700 text-slate-200 text-xs rounded-lg shadow-xl z-50">
                    Each AI edit costs 3 integration tokens. Buy more in the Tokens section.
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
              <div className="hidden sm:flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
                <button
                  onClick={() => setPreviewMode("mobile")}
                  className={`p-1.5 rounded-md transition ${
                    previewMode === "mobile"
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-slate-300"
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
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-slate-300"
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
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-slate-300"
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
                {/* Open in StackBlitz Button */}
                <button
                  onClick={openInStackBlitz}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm hover:shadow-md"
                  title="Open in StackBlitz"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M10.797 14.182H3.635L16.728 0l-3.525 9.818h7.162L7.272 24l3.525-9.818z" />
                  </svg>
                  StackBlitz
                </button>

                {/* Export Dropdown */}
                <div className="relative export-dropdown">
                  <button
                    onClick={() => setShowExportDropdown(!showExportDropdown)}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                      <button
                        onClick={exportToGitHub}
                        disabled={isExporting}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed rounded-t-lg"
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
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed rounded-b-lg"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
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
            <div className="flex-1 overflow-hidden relative min-h-0 bg-slate-900/30">
              {/* Editing overlay */}
              {isEditing && !isEditMinimized && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-50">
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
                    <span className="text-sm text-white font-medium">
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
                    : "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800/20 to-transparent"
                }`}
              >
                <div
                  className={`h-full transition-all duration-300 ${
                    previewMode === "mobile"
                      ? "w-[375px] rounded-[2rem] border-[8px] border-slate-700 shadow-2xl shadow-black/50 overflow-hidden"
                      : previewMode === "tablet"
                        ? "w-[768px] rounded-[1.5rem] border-[6px] border-slate-700 shadow-2xl shadow-black/50 overflow-hidden"
                        : "w-full"
                  }`}
                >
                  {/* Device Notch for Mobile */}
                  {previewMode === "mobile" && (
                    <div className="bg-slate-700 h-6 flex items-center justify-center">
                      <div className="w-20 h-4 bg-slate-800 rounded-full" />
                    </div>
                  )}

                  {/* StackBlitz Preview */}
                  <div
                    className={
                      previewMode !== "desktop"
                        ? "h-[calc(100%-24px)]"
                        : "h-full"
                    }
                  >
                    <StackBlitzPreview
                      project={project}
                      previewKey={previewKey}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Panel - Right on desktop, Bottom on mobile/tablet */}
            <div className="flex-shrink-0 lg:w-56 xl:w-64 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/80 backdrop-blur-lg flex flex-col">
              {/* Panel Header - Desktop only */}
              <div className="hidden lg:flex items-center gap-2 px-4 py-3 border-b border-slate-800">
                <svg
                  className="w-4 h-4 text-slate-400"
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
                <span className="text-sm font-medium text-slate-300">
                  Edit App
                </span>
              </div>

              {/* Integration token balance indicator */}
              {(userData?.integrationTokens || 0) < 6 && (
                <div className="px-4 py-3 bg-gradient-to-r from-violet-500/10 to-blue-500/10 border-b border-violet-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span className="text-xs font-medium text-violet-300">
                      Low Integration Tokens
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    {userData?.integrationTokens || 0} token{(userData?.integrationTokens || 0) !== 1 ? "s" : ""} remaining. Each edit costs 3 tokens.
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
                <div className="border-b border-slate-800">
                  <button
                    onClick={() => setShowEditHistory(!showEditHistory)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-medium text-slate-300">
                        Edit History ({editHistory.length})
                      </span>
                    </div>
                    <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showEditHistory ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showEditHistory && (
                    <div className="max-h-48 overflow-y-auto">
                      {[...editHistory].reverse().map((entry, idx) => (
                        <div key={entry.id} className="px-4 py-2 border-t border-slate-800/50 hover:bg-slate-800/30 group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-300 truncate" title={entry.prompt}>
                                {entry.prompt}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {entry.timestamp.toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {idx === 0 && <span className="ml-1.5 text-blue-400">(latest)</span>}
                              </p>
                            </div>
                            <button
                              onClick={() => rollbackToVersion(entry)}
                              disabled={isRollingBack || isEditing}
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-md transition disabled:opacity-50"
                              title="Rollback to this version"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
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
                <div className="px-4 py-2 border-b border-slate-800">
                  <div className="flex flex-wrap gap-2">
                    {editFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 border border-slate-700 rounded-lg text-xs"
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
                        <span className="text-slate-300 max-w-[80px] truncate">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEditFile(idx)}
                          className="text-slate-500 hover:text-red-400 transition"
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

              {/* Edit Form */}
              <form onSubmit={handleEdit} className="flex-1 flex flex-col p-4">
                {/* Desktop: Vertical layout with taller textarea */}
                <div className="hidden lg:flex flex-col gap-3 flex-1">
                  {/* Prompt area with auth tags */}
                  <div className="flex-1 flex flex-col bg-slate-800/50 border border-slate-700 rounded-xl focus-within:border-blue-500/50 overflow-hidden">
                    {/* Auth prefill tags (non-editable) */}
                    {editAppAuth.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1">
                        {editAppAuth.includes("username-password") && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                            </svg>
                            Add Password Authentication
                            <button
                              type="button"
                              onClick={() => setEditAppAuth(editAppAuth.filter(a => a !== "username-password"))}
                              className="ml-0.5 text-blue-400/60 hover:text-blue-300 transition"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {editAppAuth.includes("google") && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Add Google Authentication
                            <button
                              type="button"
                              onClick={() => setEditAppAuth(editAppAuth.filter(a => a !== "google"))}
                              className="ml-0.5 text-blue-400/60 hover:text-blue-300 transition"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
                          if ((editPrompt.trim() || editAppAuth.length > 0) && !isEditing) handleEdit(e);
                        }
                      }}
                      placeholder={editAppAuth.length > 0
                        ? "Add additional instructions (optional)..."
                        : "Describe changes you want to make...\n\nExamples:\n• Change the color scheme to blue\n• Add a contact form\n• Make the header sticky\n• Add dark mode toggle"}
                      disabled={isEditing}
                      className="flex-1 min-h-[120px] px-4 py-3 bg-transparent text-white placeholder-slate-500 focus:outline-none resize-none text-sm disabled:opacity-50"
                    />
                  </div>
                  {/* Auth selector for edit */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Add Auth:</span>
                    <button
                      type="button"
                      onClick={() => setEditAppAuth(
                        editAppAuth.includes("username-password")
                          ? editAppAuth.filter(a => a !== "username-password")
                          : [...editAppAuth, "username-password"]
                      )}
                      disabled={isEditing}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        editAppAuth.includes("username-password")
                          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300"
                      } disabled:opacity-50`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                      </svg>
                      Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditAppAuth(
                        editAppAuth.includes("google")
                          ? editAppAuth.filter(a => a !== "google")
                          : [...editAppAuth, "google"]
                      )}
                      disabled={isEditing}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        editAppAuth.includes("google")
                          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300"
                      } disabled:opacity-50`}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
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
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition disabled:opacity-50"
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
                      disabled={(!editPrompt.trim() && editAppAuth.length === 0) || isEditing}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isEditing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Updating...
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
                  <p className="text-xs text-slate-500 text-center">
                    Press Enter to apply or Shift+Enter for new line
                  </p>
                </div>

                {/* Mobile/Tablet: Layout */}
                <div className="flex lg:hidden flex-col gap-2">
                  {/* Auth selector for mobile edit */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs text-slate-500">Add Auth:</span>
                    <button
                      type="button"
                      onClick={() => setEditAppAuth(
                        editAppAuth.includes("username-password")
                          ? editAppAuth.filter(a => a !== "username-password")
                          : [...editAppAuth, "username-password"]
                      )}
                      disabled={isEditing}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition ${
                        editAppAuth.includes("username-password")
                          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600"
                      } disabled:opacity-50`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                      </svg>
                      Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditAppAuth(
                        editAppAuth.includes("google")
                          ? editAppAuth.filter(a => a !== "google")
                          : [...editAppAuth, "google"]
                      )}
                      disabled={isEditing}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition ${
                        editAppAuth.includes("google")
                          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600"
                      } disabled:opacity-50`}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
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
                          <button type="button" onClick={() => setEditAppAuth(editAppAuth.filter(a => a !== "username-password"))} className="text-blue-400/60 hover:text-blue-300">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      )}
                      {editAppAuth.includes("google") && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-md text-xs">
                          Add Google Auth
                          <button type="button" onClick={() => setEditAppAuth(editAppAuth.filter(a => a !== "google"))} className="text-blue-400/60 hover:text-blue-300">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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
                      className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition disabled:opacity-50"
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
                            if ((editPrompt.trim() || editAppAuth.length > 0) && !isEditing) handleEdit(e);
                          }
                        }}
                        placeholder={editAppAuth.length > 0 ? "Additional instructions (optional)..." : "Describe changes..."}
                        rows={1}
                        disabled={isEditing}
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 resize-none text-sm disabled:opacity-50"
                        style={{ minHeight: "46px", maxHeight: "120px" }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={(!editPrompt.trim() && editAppAuth.length === 0) || isEditing}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                    {isEditing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="hidden sm:inline">Updating...</span>
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
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h3 className="text-lg font-semibold text-white">
                  Domain Settings
                </h3>
                <button
                  onClick={() => setShowDomainModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
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
                    <label className="block text-sm font-medium text-slate-300">
                      Published URL
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono truncate">
                        {publishedUrl}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(publishedUrl);
                        }}
                        className="px-3 py-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
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
                        className="px-3 py-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
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
                  <label className="block text-sm font-medium text-slate-300">
                    Connect Custom Domain
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      placeholder="yourdomain.com"
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                    />
                    <button
                      onClick={() => connectDomain(customDomain)}
                      disabled={!customDomain.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Connect
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Point your domain&apos;s CNAME record to{" "}
                    <span className="font-mono text-slate-400">
                      cname.pocketdev.app
                    </span>
                  </p>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-slate-900 text-slate-500">or</span>
                  </div>
                </div>

                {/* Buy Domain */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-300">
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
                        <h4 className="text-sm font-medium text-white mb-1">
                          Get a custom domain
                        </h4>
                        <p className="text-xs text-slate-400 mb-3">
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
              <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-800 flex gap-3">
                <button
                  onClick={() => setShowDomainModal(false)}
                  className="flex-1 px-4 py-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition text-sm font-medium"
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
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-white">
                    Export to GitHub
                  </h3>
                </div>
                <button
                  onClick={() => setShowGitHubModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
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
                  <h4 className="text-lg font-bold text-white mb-2">
                    Pushed to GitHub!
                  </h4>
                  <p className="text-slate-400 text-sm mb-4">
                    {githubExportMessage}
                  </p>
                  <a
                    href={githubRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black font-medium rounded-xl hover:bg-slate-200 transition text-sm"
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
                    className="block w-full mt-3 text-sm text-slate-400 hover:text-white transition"
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
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Personal Access Token
                      </label>
                      <input
                        type="password"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        disabled={githubExportStatus === "exporting"}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Needs{" "}
                        <span className="text-slate-400 font-mono">repo</span>{" "}
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
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
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
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
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
                            ? "bg-slate-700 text-white border border-slate-600"
                            : "bg-slate-800/50 text-slate-400 border border-slate-800 hover:border-slate-700"
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
                            ? "bg-slate-700 text-white border border-slate-600"
                            : "bg-slate-800/50 text-slate-400 border border-slate-800 hover:border-slate-700"
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
                      className="flex-1 px-4 py-2.5 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition disabled:opacity-50"
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

        {/* Delete Confirmation Modal */}
        {showDeleteModal && projectToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Modal Header */}
              <div className="relative px-6 pt-8 pb-4 text-center">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setProjectToDelete(null);
                  }}
                  className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
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
                <h3 className="text-xl font-bold text-white mb-2">
                  Delete Project?
                </h3>
                <p className="text-slate-400 text-sm">
                  This action cannot be undone. The project will be permanently
                  deleted.
                </p>
              </div>

              {/* Actions */}
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
                  className="w-full px-5 py-2.5 text-slate-400 hover:text-white text-sm font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Token Deduction Confirmation Modal (success view) */}
        {showTokenConfirmModal && (() => {
          const isGeneration = showTokenConfirmModal === "app";
          const genIntegrationCost = getGenerationIntegrationCost();
          const editIntCost = getEditIntegrationCost();
          const appCost = isGeneration ? 2 : 0;
          const integrationCost = isGeneration ? genIntegrationCost : editIntCost;
          const appBalance = userData?.appTokens || 0;
          const integrationBalance = userData?.integrationTokens || 0;

          return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="relative px-6 pt-8 pb-4 text-center">
                <button
                  onClick={() => setShowTokenConfirmModal(null)}
                  className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className={`inline-flex items-center justify-center w-14 h-14 mb-4 rounded-2xl ${
                  isGeneration
                    ? "bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30"
                    : "bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30"
                }`}>
                  <svg className={`w-7 h-7 ${isGeneration ? "text-blue-400" : "text-violet-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {isGeneration ? "Create New Project" : "Edit Project"}
                </h3>
                <p className="text-slate-400 text-sm">
                  {isGeneration
                    ? "This action will deduct tokens from your balance."
                    : "This edit will deduct tokens from your balance."}
                </p>
              </div>
              <div className="px-6 pb-4 space-y-3">
                {appCost > 0 && (
                  <div className="p-4 rounded-xl border bg-blue-500/5 border-blue-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">App Tokens</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-300">Project creation</span>
                      <span className="text-sm font-bold text-blue-400">-{appCost}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                      <span>Balance: {appBalance}</span>
                      <span>After: {appBalance - appCost}</span>
                    </div>
                  </div>
                )}
                {integrationCost > 0 && (
                  <div className="p-4 rounded-xl border bg-violet-500/5 border-violet-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">Integration Tokens</span>
                    </div>
                    {!isGeneration && (
                      <>
                        {editAppAuth.includes("username-password") && (
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-300">Username & Password auth</span>
                            <span className="text-sm font-bold text-violet-400">-30</span>
                          </div>
                        )}
                        {editAppAuth.includes("google") && (
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-300">Google OAuth auth</span>
                            <span className="text-sm font-bold text-violet-400">-30</span>
                          </div>
                        )}
                        {editAppAuth.length === 0 && (
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-300">Edit changes</span>
                            <span className="text-sm font-bold text-violet-400">-3</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                      <span>Balance: {integrationBalance}</span>
                      <span>After: {integrationBalance - integrationCost}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-xs text-amber-200/80">
                    Tokens are non-refundable once deducted, even if you cancel during the process.
                  </p>
                </div>
                {!isGeneration && (
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={skipEditTokenConfirm}
                      onChange={(e) => {
                        setSkipEditTokenConfirm(e.target.checked);
                        localStorage.setItem("skipEditTokenConfirm", String(e.target.checked));
                      }}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-400 group-hover:text-slate-300 transition">Don&apos;t show this again for edits</span>
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
                  className="w-full px-5 py-2.5 text-slate-400 hover:text-white text-sm font-medium transition"
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
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col my-auto">
              <div className="relative px-6 pt-8 pb-4 text-center flex-shrink-0">
                <button
                  onClick={() => { setShowTokenPurchaseModal(false); setInsufficientTokenMessage(null); }}
                  className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className={`inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl ${
                  purchaseTokenType === "app"
                    ? "bg-gradient-to-br from-blue-500 to-violet-500"
                    : "bg-gradient-to-br from-violet-500 to-purple-500"
                }`}>
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Buy {purchaseTokenType === "app" ? "App" : "Integration"} Tokens
                </h3>
                {insufficientTokenMessage ? (
                  <div className="mt-1 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-left">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <p className="text-sm text-red-300">{insufficientTokenMessage}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">
                    {purchaseTokenType === "app"
                      ? "App tokens are used to create new projects (2 tokens per project). New accounts start with 4 free tokens."
                      : "Integration tokens are used for AI edits and backend/API calls (3 tokens per edit)."}
                  </p>
                )}
                <p className="text-slate-500 text-xs mt-2">
                  Current balance: {purchaseTokenType === "app" ? (userData?.appTokens || 0) : (userData?.integrationTokens || 0)} tokens
                </p>
              </div>
              <div className="px-6 pb-3 flex-shrink-0">
                <div className="flex bg-slate-800 rounded-lg p-1">
                  <button
                    onClick={() => { setPurchaseTokenType("app"); setTokenPurchaseAmount(0); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                      purchaseTokenType === "app" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    App Tokens
                  </button>
                  <button
                    onClick={() => { setPurchaseTokenType("integration"); setTokenPurchaseAmount(0); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                      purchaseTokenType === "integration" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Integration Tokens
                  </button>
                </div>
              </div>
              <div className="px-6 py-4 overflow-y-auto flex-1">
                <p className="text-xs text-slate-400 mb-3">
                  {purchaseTokenType === "app" ? "1 AUD = 1 app token" : "1 AUD = 10 integration tokens"}
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
                          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                      }`}
                    >
                      <div className="text-lg font-bold text-white">${option.aud} AUD</div>
                      <div className={`text-xs ${purchaseTokenType === "app" ? "text-blue-400" : "text-violet-400"}`}>
                        {option.label}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="Custom amount"
                    value={tokenPurchaseAmount || ""}
                    onChange={(e) => setTokenPurchaseAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className={`w-full pl-7 pr-16 py-2.5 bg-slate-800/50 border rounded-xl text-white text-sm font-medium focus:outline-none transition placeholder-slate-500 ${
                      purchaseTokenType === "app"
                        ? "border-blue-500/30 focus:border-blue-500"
                        : "border-violet-500/30 focus:border-violet-500"
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">AUD</span>
                </div>
                {tokenPurchaseAmount > 0 && (
                  <div className={`mt-3 p-3 rounded-xl border ${
                    purchaseTokenType === "app" ? "bg-blue-500/5 border-blue-500/20" : "bg-violet-500/5 border-violet-500/20"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">You&apos;ll receive</span>
                      <span className={`text-lg font-bold ${purchaseTokenType === "app" ? "text-blue-400" : "text-violet-400"}`}>
                        {purchaseTokenType === "app" ? tokenPurchaseAmount : tokenPurchaseAmount * 10} tokens
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
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Pay ${tokenPurchaseAmount} AUD - {purchaseTokenType === "app" ? tokenPurchaseAmount : tokenPurchaseAmount * 10} tokens
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => { setShowTokenPurchaseModal(false); setInsufficientTokenMessage(null); }}
                  className="w-full px-5 py-2.5 text-slate-400 hover:text-white text-sm font-medium transition"
                >
                  Cancel
                </button>
                {tokenPurchaseAmount > 0 && (
                  <p className="text-xs text-slate-500 text-center">
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
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="relative px-6 pt-8 pb-4 text-center">
                <button
                  onClick={() => setShowCancelConfirm(null)}
                  className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-amber-500/20 rounded-2xl">
                  <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {showCancelConfirm === "generation" ? "Cancel Generation?" : "Cancel Editing?"}
                </h3>
                <p className="text-slate-400 text-sm">
                  {showCancelConfirm === "generation"
                    ? "The AI is still generating your app. Are you sure you want to cancel? Progress will be lost."
                    : "The AI is still applying your edits. Are you sure you want to cancel? Changes will be lost."}
                </p>
                {showCancelConfirm === "edit" && (Date.now() - editStartTimeRef.current) < 10000 && (
                  <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <p className="text-xs text-emerald-300">Cancelling now will refund your integration tokens.</p>
                  </div>
                )}
                {showCancelConfirm === "edit" && (Date.now() - editStartTimeRef.current) >= 10000 && (
                  <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <p className="text-xs text-amber-300">More than 10 seconds have passed. Tokens cannot be refunded.</p>
                  </div>
                )}
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(null)}
                  className="flex-1 px-4 py-2.5 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition"
                >
                  Keep Going
                </button>
                <button
                  onClick={async () => {
                    if (showCancelConfirm === "generation") {
                      confirmCancelGeneration();
                    } else {
                      const withinRefundWindow = (Date.now() - editStartTimeRef.current) < 10000;
                      setIsEditing(false);
                      setEditProgressMessages([]);
                      setShowCancelConfirm(null);
                      if (withinRefundWindow && user) {
                        try {
                          const editCost = getEditIntegrationCost();
                          const userRef = doc(db, "users", user.uid);
                          await updateDoc(userRef, { integrationTokens: increment(editCost) });
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
    // Show generation progress if loading and not minimized
    if (status === "loading" && !isGenerationMinimized) {
      return (
        <GenerationProgress
          prompt={generationPrompt}
          progressMessages={progressMessages}
          onCancel={cancelGeneration}
          isMinimized={false}
          onToggleMinimize={() => setIsGenerationMinimized(true)}
        />
      );
    }

    return (
      <>
        {/* Generation in progress banner (when minimized) */}
        {status === "loading" && isGenerationMinimized && (
          <div className="w-full max-w-2xl mb-6">
            <button
              onClick={() => setIsGenerationMinimized(false)}
              className="w-full flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/15 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Logo size={24} animate />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-blue-300">
                    Building your app...
                  </p>
                  <p className="text-xs text-blue-400/70">
                    Click to view progress
                  </p>
                </div>
              </div>
              <svg
                className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Hero - only show when not logged in */}
        {!user && (
          <div className="text-center mb-10 max-w-2xl">
            <div className="inline-flex items-center justify-center mb-6">
              <Logo size={56} animate />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
              Pocket Dev
            </h1>
            <p className="text-lg text-slate-400 max-w-md mx-auto mb-6">
              Describe your app and watch it come to life
            </p>
            <button
              onClick={() => setShowSignInModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-lg transition-all"
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
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 12l-3-3m0 0l3-3m-3 3h8.25"
                />
              </svg>
              Sign In to Get Started
            </button>
          </div>
        )}

        {/* Welcome for logged in users */}
        {user && !isGenerationMinimized && (
          <div className="text-center mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold text-white mb-2">
              Create a New App
            </h2>
            <p className="text-slate-400">
              Describe your app and we&apos;ll build it for you
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="w-full max-w-2xl mb-6">
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium">Generation failed</p>
                <p className="text-sm text-red-400/80 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Examples */}
        <div className="w-full max-w-3xl mb-8">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 text-center">
            Quick start
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.name}
                onClick={() => setPrompt(ex.query)}
                className="group p-3 bg-slate-900/50 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all duration-200"
              >
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-xl">{ex.icon}</span>
                  <span className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                    {ex.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 pl-8">{ex.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Uploaded files */}
        {uploadedFiles.length > 0 && (
          <div className="w-full max-w-2xl mb-4">
            <div className="flex flex-wrap gap-2 justify-center">
              {uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm"
                >
                  {file.type.startsWith("image/") ? (
                    <svg
                      className="w-4 h-4 text-blue-400"
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
                      className="w-4 h-4 text-red-400"
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
                  <span className="text-slate-300 max-w-[120px] truncate">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-slate-500 hover:text-red-400 transition"
                  >
                    <svg
                      className="w-4 h-4"
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

        {/* Input */}
        <div className="w-full max-w-2xl">
          {/* Voice error notification */}
          {voiceError && (
            <div className="mb-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
              <svg
                className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
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
              <div className="flex-1">
                <p className="text-sm text-red-300 font-medium">{voiceError}</p>
              </div>
              <button
                onClick={() => setVoiceError(null)}
                className="text-red-400 hover:text-red-300 transition"
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
          )}

          <form onSubmit={handleGenerate}>
            <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl shadow-slate-950/50 overflow-hidden focus-within:border-slate-700 transition-colors">
              {/* Animated typing placeholder */}
              {!prompt && (
                <div className="absolute top-0 left-0 right-0 px-4 pt-4 pb-14 pointer-events-none z-0">
                  <span className="text-slate-500 text-base">{typingPlaceholder}</span>
                  <span className="inline-block w-[1.5px] h-[18px] bg-slate-400/80 ml-[1px] align-middle rounded-full animate-blink" />
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (prompt.trim()) handleGenerate(e);
                  }
                }}
                rows={1}
                className="w-full px-4 pt-4 pb-14 bg-transparent text-white focus:outline-none resize-none text-base relative z-[1]"
                style={{ minHeight: "52px", maxHeight: "150px" }}
              />

              {/* Bottom bar */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2.5 bg-slate-900/50 z-[2]">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition"
                    title="Attach files"
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

                  {/* Voice input button */}
                  <button
                    type="button"
                    onClick={() =>
                      isRecording ? stopRecording() : startRecording()
                    }
                    className={`p-2 rounded-lg transition ${
                      isRecording
                        ? "text-red-500 bg-red-500/10 hover:text-red-400 hover:bg-red-500/20 animate-pulse"
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    }`}
                    title={isRecording ? "Stop recording" : "Voice input"}
                  >
                    {isRecording ? (
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    ) : (
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
                          d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                        />
                      </svg>
                    )}
                  </button>

                  <div className="w-px h-5 bg-slate-700 mx-0.5" />

                  {/* Authentication button */}
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className={`p-2 rounded-lg transition ${
                      currentAppAuth.length > 0
                        ? "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    }`}
                    title={currentAppAuth.length > 0 ? `Auth: ${currentAppAuth.map(a => a === "username-password" ? "Username/Password" : "Google OAuth").join(" + ")}` : "Add authentication"}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </button>

                  {/* Database button */}
                  <button
                    type="button"
                    onClick={() => setShowDbModal(true)}
                    className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition"
                    title="Database options"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                    </svg>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-violet-600"
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
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Generate
                </button>
              </div>
            </div>

            {/* Auth selection indicator */}
            {currentAppAuth.length > 0 && (
              <div className="flex items-center justify-center gap-2 mt-2.5 flex-wrap">
                {currentAppAuth.map((auth) => (
                  <div key={auth} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span className="text-xs text-blue-300 font-medium">
                      {auth === "username-password" ? "Username/Password" : "Google OAuth"}
                    </span>
                    <span className="text-xs text-violet-400">(30 tokens)</span>
                    <button
                      type="button"
                      onClick={() => setCurrentAppAuth(currentAppAuth.filter(a => a !== auth))}
                      className="ml-0.5 text-slate-400 hover:text-white transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-center text-xs text-slate-600 mt-2">
              Press Enter to generate or Shift+Enter for new line
            </p>
          </form>
        </div>
      </>
    );
  };

  // Projects content showing saved projects
  const ProjectsContent = () => {
    if (loadingProjects) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
          <p className="text-slate-400">Loading projects...</p>
        </div>
      );
    }

    if (savedProjects.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 mb-4 bg-slate-800 rounded-2xl flex items-center justify-center">
            <svg
              className="w-8 h-8 text-slate-500"
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
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">My Projects</h2>
          <p className="text-slate-400 mb-6 max-w-sm">
            Your generated projects will appear here. Create your first app to
            get started!
          </p>
          <button
            onClick={() => setActiveSection("create")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
          >
            Create Your First App
          </button>
        </div>
      );
    }

    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white">My Projects</h2>
          <button
            onClick={() => setActiveSection("create")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            New App
          </button>
        </div>
        <div className="grid gap-4">
          {savedProjects.map((savedProject) => (
            <div
              key={savedProject.id}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition cursor-pointer group"
              onClick={() => openSavedProject(savedProject)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate mb-1 group-hover:text-blue-400 transition">
                    {savedProject.prompt.length > 60
                      ? savedProject.prompt.substring(0, 60) + "..."
                      : savedProject.prompt}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{savedProject.files.length} files</span>
                    <span>•</span>
                    <span>
                      {savedProject.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {savedProject.lintReport.passed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
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
                      <span className="text-amber-400">
                        {savedProject.lintReport.errors} issues
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  {savedProject.isPublished && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-400 bg-teal-500/10 rounded-full">
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
                          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                        />
                      </svg>
                      Live
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectToDelete(savedProject.id);
                      setShowDeleteModal(true);
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                    title="Delete project"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                  <svg
                    className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SettingsContent = () => (
    <div className="max-w-2xl mx-auto w-full p-6">
      <h2 className="text-2xl font-semibold text-white mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-medium text-white mb-4">Profile</h3>
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                <span className="text-2xl font-semibold text-white">
                  {user?.displayName?.charAt(0) ||
                    user?.email?.charAt(0) ||
                    "U"}
                </span>
              </div>
            )}
            <div>
              <p className="text-white font-medium">
                {user?.displayName || "User"}
              </p>
              <p className="text-slate-400 text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-medium text-white mb-4">Account</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400">Plan</span>
              <span className="text-white">Free</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400">Projects Created</span>
              <span className="text-white">{savedProjects.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Support Content
  const SupportContent = () => {
    const selectedTicket = supportTickets.find(t => t.id === selectedTicketId);
    return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 12-hour notice banner */}
      {ticketSubmittedNotice && (
        <div className="flex-shrink-0 mx-4 mt-3 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-300">Sent! Expect a reply within <span className="font-semibold">12 hours</span>.</p>
        </div>
      )}

      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Left: Create Ticket + Ticket List */}
        <div className="w-[60%] flex-shrink-0 flex flex-col gap-3 min-h-0">
          {/* Create Ticket */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex-shrink-0">
            <h3 className="text-base font-semibold text-white mb-3">New Ticket</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { value: "project-issue", label: "Project", icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" },
                  { value: "billing", label: "Billing", icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" },
                  { value: "feature-request", label: "Feature", icon: "M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" },
                  { value: "general", label: "General", icon: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" },
                ] as const).map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setTicketCategory(cat.value)}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition border ${
                      ticketCategory === cat.value
                        ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                        : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                    </svg>
                    {cat.label}
                  </button>
                ))}
              </div>
              {ticketCategory === "project-issue" && savedProjects.length > 0 && (
                <select
                  value={ticketProjectId}
                  onChange={(e) => setTicketProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">Select project (optional)</option>
                  {savedProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.prompt.length > 50 ? p.prompt.substring(0, 50) + "..." : p.prompt}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Subject"
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50"
              />
              <textarea
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                placeholder="Describe your issue..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 resize-none"
              />
              <button
                onClick={submitSupportTicket}
                disabled={isSubmittingTicket || !ticketSubject.trim() || !ticketDescription.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmittingTicket ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </div>

          {/* Ticket List */}
          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-300">My Tickets</h3>
              <button onClick={loadSupportTickets} className="text-xs text-slate-500 hover:text-white transition">Refresh</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingTickets ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : supportTickets.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No tickets yet</p>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {supportTickets.map(ticket => (
                    <button
                      key={ticket.id}
                      onClick={() => handleTicketClick(ticket.id)}
                      className={`w-full text-left px-4 py-3 transition hover:bg-slate-800/40 ${
                        selectedTicketId === ticket.id ? "bg-slate-800/60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white truncate">{ticket.subject}</h4>
                          {ticket.unreadAdminMessageCount && ticket.unreadAdminMessageCount > 0 && (
                            <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          )}
                        </div>
                        <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          ticket.status === "resolved"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : ticket.status === "in-progress"
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-blue-500/15 text-blue-400"
                        }`}>
                          {ticket.status === "in-progress" ? "In Progress" : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-slate-500">
                          {ticket.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <span className="text-xs text-slate-600">-</span>
                        <span className="text-xs text-slate-500 capitalize">{ticket.category.replace("-", " ")}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Selected Ticket Detail / Conversation */}
        <div className="w-[40%] bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col min-h-0">
          {selectedTicket ? (
            <>
              {/* Ticket Header */}
              <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white truncate">{selectedTicket.subject}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{selectedTicket.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span className="text-xs text-slate-500 capitalize">{selectedTicket.category.replace("-", " ")}</span>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    selectedTicket.status === "resolved"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : selectedTicket.status === "in-progress"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-blue-500/15 text-blue-400"
                  }`}>
                    {selectedTicket.status === "in-progress" ? "In Progress" : selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Conversation Thread */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                {/* Original description as first message */}
                {!(selectedTicket.messages && selectedTicket.messages.length > 0) ? (
                  <>
                    <div className="flex justify-end">
                      <div className="max-w-[80%] px-3 py-2 bg-blue-600/20 border border-blue-500/20 rounded-xl rounded-tr-sm">
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">{selectedTicket.description}</p>
                        <p className="text-[11px] text-slate-500 mt-1 text-right">{selectedTicket.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                    {selectedTicket.adminResponse && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl rounded-tl-sm">
                          <p className="text-xs font-medium text-emerald-400 mb-0.5">Admin</p>
                          <p className="text-sm text-slate-200 whitespace-pre-wrap">{selectedTicket.adminResponse}</p>
                          {selectedTicket.respondedAt && (
                            <p className="text-[11px] text-slate-500 mt-1">{selectedTicket.respondedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  selectedTicket.messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-xl ${
                        msg.sender === "user"
                          ? "bg-blue-600/20 border border-blue-500/20 rounded-tr-sm"
                          : "bg-slate-800/80 border border-slate-700 rounded-tl-sm"
                      }`}>
                        {msg.sender === "admin" && <p className="text-xs font-medium text-emerald-400 mb-0.5">Admin</p>}
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">{msg.text}</p>
                        <p className="text-[11px] text-slate-500 mt-1 text-right">
                          {new Date(msg.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply input (if not resolved) */}
              {selectedTicket.status !== "resolved" ? (
                <div className="flex-shrink-0 px-4 py-3 border-t border-slate-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyingToTicketId === selectedTicket.id ? userReplyText : ""}
                      onChange={(e) => { setReplyingToTicketId(selectedTicket.id); setUserReplyText(e.target.value); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && userReplyText.trim() && replyingToTicketId === selectedTicket.id) userReplyToTicket(selectedTicket.id); }}
                      placeholder="Type a reply..."
                      className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50"
                    />
                    <button
                      onClick={() => { if (replyingToTicketId === selectedTicket.id) userReplyToTicket(selectedTicket.id); }}
                      disabled={!userReplyText.trim() || replyingToTicketId !== selectedTicket.id}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Expect a reply within 12 hours</p>
                </div>
              ) : (
                <div className="flex-shrink-0 px-4 py-2.5 border-t border-slate-800 bg-emerald-500/5">
                  <p className="text-sm text-emerald-400 text-center">This ticket has been resolved</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-10 h-10 text-slate-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <p className="text-sm text-slate-500">Select a ticket to view conversation</p>
                <p className="text-xs text-slate-600 mt-1">or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    );
  };

  // Admin Content (visible only to admin)
  const AdminContent = () => (
    <div className="max-w-3xl mx-auto w-full p-4 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-xl font-semibold text-white">Admin - Support Tickets</h2>
        <button
          onClick={loadAdminTickets}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3 flex-shrink-0">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-center">
          <p className="text-xl font-bold text-blue-400">{adminTickets.filter(t => t.status === "open").length}</p>
          <p className="text-[10px] text-slate-400">Open</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-center">
          <p className="text-xl font-bold text-amber-400">{adminTickets.filter(t => t.status === "in-progress").length}</p>
          <p className="text-[10px] text-slate-400">In Progress</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2.5 text-center">
          <p className="text-xl font-bold text-emerald-400">{adminTickets.filter(t => t.status === "resolved").length}</p>
          <p className="text-[10px] text-slate-400">Resolved</p>
        </div>
      </div>

      {loadingTickets ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : adminTickets.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <p className="text-slate-500">No support tickets yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {adminTickets.map(ticket => (
            <div key={ticket.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white">{ticket.subject}</h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] text-slate-400">{ticket.userEmail}</span>
                    <span className="text-[10px] text-slate-600">|</span>
                    <span className="text-[10px] text-slate-400 capitalize">{ticket.category.replace("-", " ")}</span>
                    <span className="text-[10px] text-slate-600">|</span>
                    <span className="text-[10px] text-slate-500">
                      {ticket.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {ticket.projectName && (
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                      {ticket.projectName}
                    </span>
                  )}
                </div>
                <span className={`flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                  ticket.status === "resolved"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : ticket.status === "in-progress"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-blue-500/15 text-blue-400"
                }`}>
                  {ticket.status === "in-progress" ? "In Progress" : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                </span>
              </div>

              {/* Conversation thread */}
              <div className="mb-3 space-y-1.5 max-h-40 overflow-y-auto">
                {ticket.messages && ticket.messages.length > 0 ? (
                  ticket.messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs ${
                        msg.sender === "admin"
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-slate-200"
                          : "bg-blue-600/10 border border-blue-500/20 text-slate-300"
                      }`}>
                        <p className="text-[9px] font-medium mb-0.5 ${msg.sender === 'admin' ? 'text-emerald-400' : 'text-blue-400'}">{msg.sender === "admin" ? "You" : ticket.userName}</p>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        <p className="text-[8px] text-slate-500 mt-0.5 text-right">{new Date(msg.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{ticket.description}</p>
                )}
              </div>

              {/* Response form */}
              {respondingToTicketId === ticket.id ? (
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <textarea
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    placeholder="Type your response..."
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500/50 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => respondToTicket(ticket.id, adminResponse, "in-progress")}
                      disabled={!adminResponse.trim()}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition disabled:opacity-40"
                    >
                      Send (In Progress)
                    </button>
                    <button
                      onClick={() => respondToTicket(ticket.id, adminResponse, "resolved")}
                      disabled={!adminResponse.trim()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition disabled:opacity-40"
                    >
                      Send & Resolve
                    </button>
                    <button
                      onClick={() => { setRespondingToTicketId(null); setAdminResponse(""); }}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
                  <button
                    onClick={() => { setRespondingToTicketId(ticket.id); setAdminResponse(""); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    Respond
                  </button>
                  {ticket.status !== "resolved" && (
                    <button
                      onClick={() => respondToTicket(ticket.id, "Resolved.", "resolved")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
        return ProjectsContent();
      case "settings":
        return SettingsContent();
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
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/3 rounded-full blur-3xl" />
        </div>

        {/* Loading animation */}
        <div className="text-center relative z-10">
          <div className="inline-flex items-center justify-center mb-6">
            <Logo size={64} animate />
          </div>

          {/* Modern spinner */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>
            {/* Spinning gradient ring */}
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-violet-500 rounded-full animate-spin"></div>
            {/* Middle ring */}
            <div
              className="absolute inset-2 border-4 border-transparent border-b-blue-400 border-l-violet-400 rounded-full animate-spin"
              style={{
                animationDirection: "reverse",
                animationDuration: "1.5s",
              }}
            ></div>
            {/* Inner pulsing dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full animate-pulse"></div>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Pocket Dev</h1>
          <p className="text-slate-400">Initializing...</p>
        </div>
      </div>
    );
  }

  // IDLE/ERROR STATE
  return (
    <div className="min-h-screen bg-slate-950 flex">
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

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/3 rounded-full blur-3xl" />
        </div>

        {/* Main content */}
        <main className={`flex-1 flex flex-col relative z-10 ${
          activeSection === "support" || activeSection === "admin"
            ? "overflow-hidden"
            : "items-center justify-center px-4 py-12"
        }`}>
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

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="relative px-6 pt-8 pb-4 text-center">
              <button
                onClick={() => setShowCancelConfirm(null)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-amber-500/20 rounded-2xl">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {showCancelConfirm === "generation"
                  ? "Cancel Generation?"
                  : "Cancel Editing?"}
              </h3>
              <p className="text-slate-400 text-sm">
                {showCancelConfirm === "generation"
                  ? "The AI is still generating your app. Are you sure you want to cancel? Progress will be lost."
                  : "The AI is still applying your edits. Are you sure you want to cancel? Changes will be lost."}
              </p>
              {showCancelConfirm === "edit" && (Date.now() - editStartTimeRef.current) < 10000 && (
                <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <p className="text-xs text-emerald-300">Cancelling now will refund your integration tokens.</p>
                </div>
              )}
              {showCancelConfirm === "edit" && (Date.now() - editStartTimeRef.current) >= 10000 && (
                <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-xs text-amber-300">More than 10 seconds have passed. Tokens cannot be refunded.</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(null)}
                className="flex-1 px-4 py-2.5 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition"
              >
                Keep Going
              </button>
              <button
                onClick={async () => {
                  if (showCancelConfirm === "generation") {
                    confirmCancelGeneration();
                  } else {
                    const withinRefundWindow = (Date.now() - editStartTimeRef.current) < 10000;
                    setIsEditing(false);
                    setEditProgressMessages([]);
                    setShowCancelConfirm(null);
                    if (withinRefundWindow && user) {
                      try {
                        const editCost = getEditIntegrationCost();
                        const userRef = doc(db, "users", user.uid);
                        await updateDoc(userRef, { integrationTokens: increment(editCost) });
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
            className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            style={{ animation: "welcome-modal-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both" }}
          >
            {/* Animated Logo Header */}
            <div className="relative px-6 pt-10 pb-4 text-center overflow-hidden">
              {/* Background radial glow */}
              <div className="absolute inset-0 flex items-start justify-center pointer-events-none" style={{ top: "-20px" }}>
                <div
                  className="w-64 h-64 rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)",
                    animation: "welcome-logo-glow-pulse 3s ease-in-out infinite",
                  }}
                />
              </div>

              {/* Logo container with floating animation */}
              <div
                className="relative inline-block mb-5"
                style={{ animation: "welcome-logo-float 4s ease-in-out infinite" }}
              >
                {/* Outer orbiting ring */}
                <div
                  className="absolute -inset-5 rounded-full border border-blue-500/20 border-dashed"
                  style={{ animation: "welcome-ring-spin 12s linear infinite" }}
                />
                {/* Inner orbiting ring */}
                <div
                  className="absolute -inset-3 rounded-full border border-violet-500/25"
                  style={{ animation: "welcome-ring-spin-reverse 8s linear infinite" }}
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
                  style={{ animation: "welcome-ring-spin-reverse 8s linear infinite" }}
                >
                  <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-lg shadow-indigo-400/50" />
                </div>

                {/* Floating particles */}
                {[
                  { tx: "-30px", ty: "-40px", delay: "0s", dur: "2.5s", size: "3px", color: "#60a5fa" },
                  { tx: "35px", ty: "-25px", delay: "0.4s", dur: "3s", size: "2px", color: "#a78bfa" },
                  { tx: "-25px", ty: "35px", delay: "0.8s", dur: "2.8s", size: "2.5px", color: "#818cf8" },
                  { tx: "40px", ty: "30px", delay: "1.2s", dur: "3.2s", size: "2px", color: "#60a5fa" },
                  { tx: "-40px", ty: "5px", delay: "1.6s", dur: "2.6s", size: "3px", color: "#c084fc" },
                  { tx: "20px", ty: "-45px", delay: "2s", dur: "2.9s", size: "2px", color: "#818cf8" },
                ].map((p, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2 rounded-full"
                    style={{
                      width: p.size,
                      height: p.size,
                      backgroundColor: p.color,
                      boxShadow: `0 0 6px ${p.color}`,
                      "--tx": p.tx,
                      "--ty": p.ty,
                      animation: `welcome-particle ${p.dur} ease-out ${p.delay} infinite`,
                    } as React.CSSProperties}
                  />
                ))}

                {/* The actual logo with glow shadow */}
                <div className="relative" style={{ filter: "drop-shadow(0 0 20px rgba(99,102,241,0.4)) drop-shadow(0 0 40px rgba(139,92,246,0.2))" }}>
                  <Logo size={72} animate />
                  {/* Shine sweep overlay */}
                  <div className="absolute inset-0 overflow-hidden rounded-2xl" style={{ borderRadius: "18px" }}>
                    <div
                      className="absolute inset-0 w-[200%]"
                      style={{
                        background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 60%)",
                        animation: "welcome-shine-sweep 3s ease-in-out 0.5s infinite",
                      }}
                    />
                  </div>
                </div>
              </div>

              <h3
                className="text-2xl font-bold text-white mb-2"
                style={{ animation: "welcome-text-in 0.5s ease-out 0.3s both" }}
              >
                Welcome to Pocket Dev!
              </h3>
              <p
                className="text-slate-400 text-sm"
                style={{ animation: "welcome-text-in 0.5s ease-out 0.5s both" }}
              >
                We&apos;ve given you free tokens to get started. Here&apos;s how they work:
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
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">App Tokens</h4>
                    <p className="text-xs text-blue-400 font-medium">4 free tokens awarded</p>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  App tokens let you create new projects. Each new project costs <span className="text-white font-medium">2 app tokens</span>, so you can create <span className="text-white font-medium">2 projects</span> for free.
                </p>
              </div>

              {/* Integration Tokens */}
              <div
                className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl"
                style={{ animation: "welcome-card-in 0.5s ease-out 0.75s both" }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/30 to-violet-600/20 flex items-center justify-center flex-shrink-0 border border-violet-500/20">
                    <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Integration Tokens</h4>
                    <p className="text-xs text-violet-400 font-medium">10 free tokens awarded</p>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Integration tokens let you make AI-powered edits to your projects. Each edit costs <span className="text-white font-medium">1 integration token</span>, so you get <span className="text-white font-medium">10 edits</span> for free.
                </p>
              </div>

              {/* Buy More Note */}
              <p
                className="text-xs text-slate-500 text-center"
                style={{ animation: "welcome-text-in 0.5s ease-out 0.9s both" }}
              >
                Need more? You can buy additional tokens anytime from the sidebar or the Tokens page.
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
      {showTokenConfirmModal && (() => {
        const isGeneration = showTokenConfirmModal === "app";
        const genIntegrationCost = getGenerationIntegrationCost();
        const editIntCost = getEditIntegrationCost();
        const appCost = isGeneration ? 2 : 0;
        const integrationCost = isGeneration ? genIntegrationCost : editIntCost;
        const appBalance = userData?.appTokens || 0;
        const integrationBalance = userData?.integrationTokens || 0;

        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="relative px-6 pt-8 pb-4 text-center">
              <button
                onClick={() => setShowTokenConfirmModal(null)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className={`inline-flex items-center justify-center w-14 h-14 mb-4 rounded-2xl ${
                isGeneration
                  ? "bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30"
                  : "bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30"
              }`}>
                <svg className={`w-7 h-7 ${isGeneration ? "text-blue-400" : "text-violet-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                {isGeneration ? "Create New Project" : "Edit Project"}
              </h3>
              <p className="text-slate-400 text-sm">
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
                    <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">App Tokens</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">Project creation</span>
                    <span className="text-sm font-bold text-blue-400">-{appCost}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                    <span>Balance: {appBalance}</span>
                    <span>After: {appBalance - appCost}</span>
                  </div>
                </div>
              )}

              {/* Integration Tokens section */}
              {integrationCost > 0 && (
                <div className="p-4 rounded-xl border bg-violet-500/5 border-violet-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">Integration Tokens</span>
                  </div>
                  {isGeneration ? (
                    <>
                      {currentAppAuth.includes("username-password") && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300">Username & Password auth</span>
                          <span className="text-sm font-bold text-violet-400">-30</span>
                        </div>
                      )}
                      {currentAppAuth.includes("google") && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300">Google OAuth auth</span>
                          <span className="text-sm font-bold text-violet-400">-30</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {editAppAuth.includes("username-password") && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300">Username & Password auth</span>
                          <span className="text-sm font-bold text-violet-400">-30</span>
                        </div>
                      )}
                      {editAppAuth.includes("google") && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300">Google OAuth auth</span>
                          <span className="text-sm font-bold text-violet-400">-30</span>
                        </div>
                      )}
                      {editAppAuth.length === 0 && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300">Edit changes</span>
                          <span className="text-sm font-bold text-violet-400">-3</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                    <span>Balance: {integrationBalance}</span>
                    <span>After: {integrationBalance - integrationCost}</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-200/80">
                  Tokens are non-refundable once deducted, even if you cancel during the process.
                </p>
              </div>
              {!isGeneration && (
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={skipEditTokenConfirm}
                    onChange={(e) => {
                      setSkipEditTokenConfirm(e.target.checked);
                      localStorage.setItem("skipEditTokenConfirm", String(e.target.checked));
                    }}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 transition">Don&apos;t show this again for edits</span>
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
                className="w-full px-5 py-2.5 text-slate-400 hover:text-white text-sm font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="relative px-6 pt-6 pb-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Authentication</h3>
                  <p className="text-xs text-slate-400">Select auth for your next app</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Options */}
            <div className="p-4 space-y-2.5">
              {/* Username/Password */}
              <button
                onClick={() => setCurrentAppAuth(
                  currentAppAuth.includes("username-password")
                    ? currentAppAuth.filter(a => a !== "username-password")
                    : [...currentAppAuth, "username-password"]
                )}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  currentAppAuth.includes("username-password")
                    ? "bg-blue-600/15 border-blue-500/40 ring-1 ring-blue-500/20"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${currentAppAuth.includes("username-password") ? "bg-blue-500/20" : "bg-slate-800"}`}>
                    <svg className={`w-5 h-5 ${currentAppAuth.includes("username-password") ? "text-blue-400" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${currentAppAuth.includes("username-password") ? "text-blue-300" : "text-white"}`}>Username & Password</p>
                    <p className="text-xs text-slate-400 mt-0.5">Email/password sign up, login & protected routes</p>
                  </div>
                  <span className="text-xs font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full flex-shrink-0">30 tokens</span>
                  {currentAppAuth.includes("username-password") && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>

              {/* Google OAuth */}
              <button
                onClick={() => setCurrentAppAuth(
                  currentAppAuth.includes("google")
                    ? currentAppAuth.filter(a => a !== "google")
                    : [...currentAppAuth, "google"]
                )}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  currentAppAuth.includes("google")
                    ? "bg-blue-600/15 border-blue-500/40 ring-1 ring-blue-500/20"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${currentAppAuth.includes("google") ? "bg-blue-500/20" : "bg-slate-800"}`}>
                    <svg className={`w-5 h-5 ${currentAppAuth.includes("google") ? "text-blue-400" : "text-slate-400"}`} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${currentAppAuth.includes("google") ? "text-blue-300" : "text-white"}`}>Google OAuth</p>
                    <p className="text-xs text-slate-400 mt-0.5">Sign in with Google, profile & protected routes</p>
                  </div>
                  <span className="text-xs font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full flex-shrink-0">30 tokens</span>
                  {currentAppAuth.includes("google") && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            </div>

            {/* Info footer */}
            {currentAppAuth.length > 0 && (
              <div className="mx-4 mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-300">
                    <span className="font-medium">{currentAppAuth.map(a => a === "username-password" ? "Username & Password" : "Google OAuth").join(" + ")}</span> auth will be included in your next app. Costs <span className="font-medium text-violet-400">{currentAppAuth.length * 30} integration tokens</span> + 2 app tokens.
                  </p>
                </div>
              </div>
            )}

            {/* Done button */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowAuthModal(false)}
                className="w-full px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Modal */}
      {showDbModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="relative px-6 pt-6 pb-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Database</h3>
                  <p className="text-xs text-slate-400">Configure database for your app</p>
                </div>
              </div>
              <button
                onClick={() => setShowDbModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Coming Soon */}
            <div className="p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-800 flex items-center justify-center">
                <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-white mb-2">Coming Soon</h3>
              <p className="text-slate-400 text-sm mb-1">Database integration will cost <span className="text-violet-400 font-medium">50 integration tokens</span>.</p>
              <p className="text-slate-500 text-xs">Choose database providers and schema settings for your generated apps.</p>
            </div>

            <div className="px-6 pb-5">
              <button
                onClick={() => setShowDbModal(false)}
                className="w-full px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Token Purchase Modal */}
      {showTokenPurchaseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="relative px-6 pt-8 pb-4 text-center flex-shrink-0">
              <button
                onClick={() => { setShowTokenPurchaseModal(false); setInsufficientTokenMessage(null); }}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className={`inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl ${
                purchaseTokenType === "app"
                  ? "bg-gradient-to-br from-blue-500 to-violet-500"
                  : "bg-gradient-to-br from-violet-500 to-purple-500"
              }`}>
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Buy {purchaseTokenType === "app" ? "App" : "Integration"} Tokens
              </h3>
              {insufficientTokenMessage ? (
                <div className="mt-1 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-left">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-sm text-red-300">{insufficientTokenMessage}</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">
                  {purchaseTokenType === "app"
                    ? "App tokens are used to create new projects (2 tokens per project). New accounts start with 4 free tokens."
                    : "Integration tokens are used for AI edits and backend/API calls (3 tokens per edit)."}
                </p>
              )}
              <p className="text-slate-500 text-xs mt-2">
                Current balance: {purchaseTokenType === "app" ? (userData?.appTokens || 0) : (userData?.integrationTokens || 0)} tokens
              </p>
            </div>

            {/* Token Type Tabs */}
            <div className="px-6 pb-3 flex-shrink-0">
              <div className="flex bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => {
                    setPurchaseTokenType("app");
                    setTokenPurchaseAmount(0);
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                    purchaseTokenType === "app"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
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
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Integration Tokens
                </button>
              </div>
            </div>

            {/* Amount Selection */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <p className="text-xs text-slate-400 mb-3">
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
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-lg font-bold text-white">${option.aud} AUD</div>
                    <div className={`text-xs ${
                      purchaseTokenType === "app" ? "text-blue-400" : "text-violet-400"
                    }`}>
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                <input
                  type="number"
                  min={1}
                  placeholder="Custom amount"
                  value={tokenPurchaseAmount || ""}
                  onChange={(e) => setTokenPurchaseAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className={`w-full pl-7 pr-16 py-2.5 bg-slate-800/50 border rounded-xl text-white text-sm font-medium focus:outline-none transition placeholder-slate-500 ${
                    purchaseTokenType === "app"
                      ? "border-blue-500/30 focus:border-blue-500"
                      : "border-violet-500/30 focus:border-violet-500"
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">AUD</span>
              </div>
              {tokenPurchaseAmount > 0 && (
                <div className={`mt-3 p-3 rounded-xl border ${
                  purchaseTokenType === "app" ? "bg-blue-500/5 border-blue-500/20" : "bg-violet-500/5 border-violet-500/20"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">You&apos;ll receive</span>
                    <span className={`text-lg font-bold ${purchaseTokenType === "app" ? "text-blue-400" : "text-violet-400"}`}>
                      {purchaseTokenType === "app" ? tokenPurchaseAmount : tokenPurchaseAmount * 10} tokens
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
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
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Pay ${tokenPurchaseAmount} AUD - {purchaseTokenType === "app" ? tokenPurchaseAmount : tokenPurchaseAmount * 10} tokens
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => { setShowTokenPurchaseModal(false); setInsufficientTokenMessage(null); }}
                className="w-full px-5 py-2.5 text-slate-400 hover:text-white text-sm font-medium transition"
              >
                Cancel
              </button>
              {tokenPurchaseAmount > 0 && (
                <p className="text-xs text-slate-500 text-center">
                  Secure payment powered by Stripe
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

export default function ReactGenerator() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <ReactGeneratorContent />
    </Suspense>
  );
}
