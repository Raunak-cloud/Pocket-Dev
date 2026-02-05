"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { generateReact } from "./react-actions";
import Logo from "./components/Logo";
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react";
import sdk from "@stackblitz/sdk";
import { useAuth } from "./contexts/AuthContext";
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
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
  publishedAt?: Date;
  customDomain?: string;
  tier?: "free" | "premium";
  paidAt?: Date;
}

const EXAMPLES = [
  {
    icon: "🛍️",
    name: "E-Commerce",
    desc: "Product listings, cart & checkout",
    query:
      "Create a modern e-commerce React app with product listings, shopping cart, and checkout pages",
  },
  {
    icon: "🍕",
    name: "Restaurant",
    desc: "Menu, reservations & about",
    query:
      "Create a restaurant React app with menu, reservations, and about pages",
  },
  {
    icon: "🚀",
    name: "SaaS Landing",
    desc: "Features, pricing & signup",
    query:
      "Create a SaaS landing React app with features, pricing, and about pages",
  },
  {
    icon: "📸",
    name: "Portfolio",
    desc: "Projects gallery & contact",
    query:
      "Create a creative portfolio React app with projects gallery, about, and contact pages",
  },
  {
    icon: "📝",
    name: "Blog",
    desc: "Posts, categories & search",
    query:
      "Create a modern blog React app with post listings, categories, and search functionality",
  },
  {
    icon: "🏋️",
    name: "Fitness",
    desc: "Workouts, plans & progress",
    query:
      "Create a fitness tracker React app with workout plans, exercise library, and progress tracking",
  },
];

function ReactGeneratorContent() {
  const { user } = useAuth();
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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [currentProjectTier, setCurrentProjectTier] = useState<
    "free" | "premium"
  >("free");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "52px";
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 52), 150);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [prompt]);

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

  // Handle payment success redirect
  useEffect(() => {
    const payment = searchParams.get("payment");
    const projectId = searchParams.get("projectId");

    if (payment === "success" && projectId && user) {
      // Update the project tier locally and reload projects
      const updateProjectTier = async () => {
        try {
          const projectRef = doc(db, "projects", projectId);
          await updateDoc(projectRef, {
            tier: "premium",
            paidAt: serverTimestamp(),
          });

          // Reload projects to get the updated tier
          await loadSavedProjects();

          // Set the current project tier to premium
          setCurrentProjectTier("premium");

          // Find and open the upgraded project
          const updatedProjects = await getDocs(
            query(collection(db, "projects"), where("userId", "==", user.uid)),
          );
          const upgradedProject = updatedProjects.docs.find(
            (d) => d.id === projectId,
          );
          if (upgradedProject) {
            const projectData = upgradedProject.data();
            setProject({
              files: projectData.files,
              dependencies: projectData.dependencies,
              lintReport: projectData.lintReport,
            });
            setCurrentProjectId(projectId);
            setGenerationPrompt(projectData.prompt);
            setStatus("success");
            setActiveSection("create");
          }

          // Clear URL params and show success
          window.history.replaceState({}, "", "/");
          alert(
            "Payment successful! Your project is now Premium with unlimited edits.",
          );
        } catch (error) {
          console.error("Error updating project tier:", error);
          setError(
            "Payment received but failed to update project. Please refresh the page.",
          );
        }
      };

      updateProjectTier();
    } else if (payment === "cancelled") {
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams, user]);

  // Save project to Firestore
  const saveProjectToFirestore = async (
    projectData: ReactProject,
    projectPrompt: string,
  ): Promise<string> => {
    if (!user) throw new Error("User not logged in");

    const projectDoc = {
      userId: user.uid,
      prompt: projectPrompt,
      files: projectData.files,
      dependencies: projectData.dependencies,
      lintReport: projectData.lintReport,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "projects"), projectDoc);

    // Update user's project count
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      projectCount: increment(1),
    });

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
      dependencies: projectData.dependencies,
      lintReport: projectData.lintReport,
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

  // Open a saved project
  const openSavedProject = (savedProject: SavedProject) => {
    setProject({
      files: savedProject.files,
      dependencies: savedProject.dependencies,
      lintReport: savedProject.lintReport,
    });
    setCurrentProjectId(savedProject.id);
    setGenerationPrompt(savedProject.prompt);
    setPublishedUrl(savedProject.publishedUrl || null);
    setCustomDomain(savedProject.customDomain || "");
    setCurrentProjectTier(savedProject.tier || "free");
    setHasUnpublishedChanges(false);
    setStatus("success");
    setActiveSection("create");
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
        setHasUnpublishedChanges(false);
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

  // Upgrade project to premium
  const upgradeProject = async () => {
    if (!currentProjectId || !user) return;

    setIsProcessingPayment(true);
    setError("");
    try {
      // Create Stripe checkout session
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProjectId,
          userId: user.uid,
          userEmail: user.email,
        }),
      });

      // Check content type before parsing
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

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error("Error creating checkout:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Payment failed. Please try again.",
      );
      setIsProcessingPayment(false);
    }
  };

  // Publish the project to CodeSandbox
  const publishProject = async () => {
    if (!project || !currentProjectId || !user) return;

    setIsPublishing(true);
    setError("");
    try {
      // Build files for CodeSandbox
      const files: Record<string, string> = {};

      // Add all project files
      project.files.forEach((f) => {
        files[f.path] = f.content;
      });

      // Add package.json
      files["package.json"] = JSON.stringify(
        {
          name: "pocket-dev-app",
          version: "1.0.0",
          main: "index.js",
          dependencies: {
            ...project.dependencies,
            "react-scripts": "5.0.1",
          },
          scripts: {
            start: "react-scripts start",
            build: "react-scripts build",
          },
          browserslist: [
            ">0.2%",
            "not dead",
            "not ie <= 11",
            "not op_mini all",
          ],
        },
        null,
        2,
      );

      // Add index.html for CRA
      files["public/index.html"] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>React App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            animation: {
              'fade-in': 'fadeIn 0.5s ease-out',
              'slide-up': 'slideUp 0.5s ease-out',
            },
            keyframes: {
              fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
              slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
            },
          },
        },
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

      // Add src/index.js as entry point
      files["src/index.js"] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

      // Add basic styles
      files["src/styles.css"] =
        `*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }`;

      // Call our publish API
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to publish");
      }

      const publishUrl = data.url;

      // Update project in Firestore with publish info
      const projectRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectRef, {
        isPublished: true,
        publishedUrl: publishUrl,
        publishedAt: serverTimestamp(),
      });

      setPublishedUrl(publishUrl);
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
      const projectRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectRef, {
        isPublished: false,
        publishedUrl: null,
        publishedAt: null,
        customDomain: null,
      });
      setPublishedUrl(null);
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
    setStatus("idle");
    setProgressMessages([]);
    setGenerationPrompt("");
    setIsGenerationMinimized(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPrompt.trim() || isEditing || !project) return;

    // Check if project is premium
    if (currentProjectTier !== "premium") {
      setShowUpgradeModal(true);
      return;
    }

    setIsEditing(true);
    setError("");
    setEditProgressMessages([]);
    setIsEditMinimized(false);

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
    }, 2500);

    // Build context from current project
    const currentFiles = project.files
      .map((f) => `// ${f.path}\n${f.content}`)
      .join("\n\n---\n\n");

    // List all existing file paths
    const existingFilePaths = project.files.map((f) => f.path).join(", ");

    let editFullPrompt = `I have an existing React app with the following files:

${currentFiles}

USER'S EDIT REQUEST:
${editPrompt}

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
    }

    editFullPrompt += `\n\n🚨 CRITICAL REQUIREMENT:
You MUST return ALL of these exact files in your response: ${existingFilePaths}

Even if you only modify 1-2 files, you must include ALL files in the output JSON.
Do not skip any files. Keep unmodified files exactly as they are.`;

    try {
      // Filter for image files only (Anthropic API supports images)
      const imageFiles = editFiles.filter((f) => f.type.startsWith("image/"));

      const result = await generateReact(editFullPrompt, imageFiles);

      clearInterval(editProgressInterval);
      setEditProgressMessages([...editProgressSteps, "Merging changes..."]);

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

      // Images are now hosted on Firebase Storage with URLs embedded in code
      const mergedProject = {
        ...result,
        files: mergedFiles,
      };

      setProject(mergedProject);
      setEditPrompt("");
      setEditFiles([]); // Clear edit files after successful edit

      // Force preview refresh by updating key
      setPreviewKey((prev) => prev + 1);

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

  const startGeneration = async () => {
    setStatus("loading");
    setError("");
    setProject(null);
    setProgressMessages([]);
    setGenerationPrompt(prompt);
    setIsGenerationMinimized(false);

    let fullPrompt = prompt;
    if (uploadedFiles.length > 0) {
      const imageFiles = uploadedFiles.filter((f) =>
        f.type.startsWith("image/"),
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
    const progressInterval = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        setProgressMessages((prev) => [...prev, progressSteps[stepIndex]]);
        stepIndex++;
      }
    }, 2200);

    try {
      // Filter for image files only (Anthropic API supports images)
      const imageFiles = uploadedFiles.filter((f) =>
        f.type.startsWith("image/"),
      );

      const result = await generateReact(fullPrompt, imageFiles);
      clearInterval(progressInterval);
      setProgressMessages([...progressSteps, "Saving project..."]);

      // Images are now hosted on Firebase Storage with URLs embedded in code
      // No need for data URL injection - AI uses the Firebase URLs directly
      setProject(result);

      // Save project to Firestore
      if (user) {
        try {
          const projectId = await saveProjectToFirestore(result, prompt);
          setCurrentProjectId(projectId);
          // Refresh projects list
          loadSavedProjects();
        } catch (saveError) {
          console.error("Error saving project:", saveError);
        }
      }

      setStatus("success");
    } catch (err) {
      clearInterval(progressInterval);
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || status === "loading") return;

    // Check if user is logged in
    if (!user) {
      setPendingGeneration(true);
      setShowSignInModal(true);
      return;
    }

    startGeneration();
  };

  const openInStackBlitz = () => {
    if (!project) return;

    const files: Record<string, string> = {};
    project.files.forEach((f) => {
      files[f.path] = f.content;
    });

    files["package.json"] = JSON.stringify(
      {
        name: "generated-react-app",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
        dependencies: { ...project.dependencies },
        devDependencies: { vite: "^5.0.0", "@vitejs/plugin-react": "^4.2.0" },
      },
      null,
      2,
    );

    files["index.html"] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>`;

    files["main.jsx"] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

    files["index.css"] = `*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }`;

    files["vite.config.js"] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });`;

    sdk.openProject(
      {
        title: "Generated React App",
        description: "React app generated by Pocket Dev",
        template: "node",
        files,
      },
      { openFile: "App.jsx", newWindow: true },
    );
  };

  const sandpackFiles = project
    ? project.files.reduce(
        (acc, file) => {
          acc[`/${file.path}`] = file.content;
          return acc;
        },
        {} as Record<string, string>,
      )
    : {};

  const sandpackIndexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            animation: {
              'fade-in': 'fadeIn 0.5s ease-out',
              'slide-up': 'slideUp 0.5s ease-out',
            },
            keyframes: {
              fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
              slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
            },
          },
        },
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>`;

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
            }}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={setIsSidebarCollapsed}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 backdrop-blur-lg z-10">
            <div className="px-4 h-14 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-px bg-slate-700" />
                {currentProjectTier === "premium" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Premium
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 px-2.5 py-1 rounded-full">
                    Free
                  </span>
                )}
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
                <button
                  onClick={openInStackBlitz}
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
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  StackBlitz
                </button>
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
                    setCurrentProjectId(null);
                    setHasUnpublishedChanges(false);
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
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-20 flex items-center justify-center overflow-auto p-4">
                  <GenerationProgress
                    prompt={`Editing: ${editPrompt}`}
                    progressMessages={editProgressMessages}
                    onCancel={() => {
                      setIsEditing(false);
                      setEditProgressMessages([]);
                      setError("Edit cancelled");
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

                  {/* Sandpack Preview Only */}
                  <div
                    className={
                      previewMode !== "desktop"
                        ? "h-[calc(100%-24px)]"
                        : "h-full"
                    }
                  >
                    <SandpackProvider
                      key={previewKey}
                      template="vite-react"
                      files={{
                        ...sandpackFiles,
                        "/index.html": sandpackIndexHtml,
                        "/main.jsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
                        "/index.css": `*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }`,
                      }}
                      customSetup={{
                        dependencies: { ...project.dependencies },
                        entry: "/main.jsx",
                      }}
                      theme="dark"
                    >
                      <SandpackPreview
                        showNavigator={false}
                        showOpenInCodeSandbox={false}
                        showRefreshButton={false}
                        style={{ height: "85vh" }}
                      />
                    </SandpackProvider>
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

              {/* Upgrade Banner for Free Projects */}
              {currentProjectTier !== "premium" && (
                <div className="px-4 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <svg
                      className="w-4 h-4 text-amber-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-xs font-medium text-amber-300">
                      Upgrade to Edit
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Get unlimited edits for $60 AUD
                  </p>
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="w-full px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-medium rounded-lg transition"
                  >
                    Upgrade Now
                  </button>
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
                  <textarea
                    ref={editTextareaRef}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (editPrompt.trim() && !isEditing) handleEdit(e);
                      }
                    }}
                    placeholder="Describe changes you want to make...

Examples:
• Change the color scheme to blue
• Add a contact form
• Make the header sticky
• Add dark mode toggle"
                    disabled={isEditing}
                    className="flex-1 min-h-[120px] px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 resize-none text-sm disabled:opacity-50"
                  />
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
                      disabled={!editPrompt.trim() || isEditing}
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

                {/* Mobile/Tablet: Horizontal layout */}
                <div className="flex lg:hidden items-center gap-2">
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
                          if (editPrompt.trim() && !isEditing) handleEdit(e);
                        }
                      }}
                      placeholder="Describe changes..."
                      rows={1}
                      disabled={isEditing}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 resize-none text-sm disabled:opacity-50"
                      style={{ minHeight: "46px", maxHeight: "120px" }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!editPrompt.trim() || isEditing}
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

        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Modal Header */}
              <div className="relative px-6 pt-8 pb-4 text-center">
                <button
                  onClick={() => setShowUpgradeModal(false)}
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
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Upgrade to Premium
                </h3>
                <p className="text-slate-400 text-sm">
                  Unlock unlimited AI-powered edits for this project
                </p>
              </div>

              {/* Pricing */}
              <div className="px-6 py-4">
                <div className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-300 font-medium">
                      Premium Project
                    </span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-white">$60</span>
                      <span className="text-slate-400 text-sm ml-1">AUD</span>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-slate-300">
                      <svg
                        className="w-4 h-4 text-emerald-400"
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
                      Unlimited AI-powered edits
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-300">
                      <svg
                        className="w-4 h-4 text-emerald-400"
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
                      Upload images for design reference
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-300">
                      <svg
                        className="w-4 h-4 text-emerald-400"
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
                      One-time payment, lifetime access
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-300">
                      <svg
                        className="w-4 h-4 text-emerald-400"
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
                      Priority support
                    </li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 space-y-3">
                <button
                  onClick={upgradeProject}
                  disabled={isProcessingPayment}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessingPayment ? (
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
                      Upgrade Now - $60 AUD
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="w-full px-5 py-2.5 text-slate-400 hover:text-white text-sm font-medium transition"
                >
                  Maybe later
                </button>
                <p className="text-xs text-slate-500 text-center">
                  Secure payment powered by Stripe
                </p>
              </div>
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
          <form onSubmit={handleGenerate}>
            <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl shadow-slate-950/50 overflow-hidden focus-within:border-slate-700 transition-colors">
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
                placeholder="Describe the app you want to build..."
                rows={1}
                className="w-full px-4 pt-4 pb-14 bg-transparent text-white placeholder-slate-500 focus:outline-none resize-none text-base"
                style={{ minHeight: "52px", maxHeight: "150px" }}
              />

              {/* Bottom bar */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2.5 bg-slate-900/50">
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

            <p className="text-center text-xs text-slate-600 mt-3">
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
                  {savedProject.tier === "premium" && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-400 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-full">
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Premium
                    </span>
                  )}
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

        {/* Danger Zone */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
          <h3 className="text-lg font-medium text-red-400 mb-4">Danger Zone</h3>
          <p className="text-slate-400 text-sm mb-4">
            Once you delete your account, there is no going back.
          </p>
          <button className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg border border-red-500/30 transition">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );

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
      default:
        return CreateContent();
    }
  };

  // IDLE/ERROR STATE
  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar - only show when logged in */}
      {user && (
        <DashboardSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={setIsSidebarCollapsed}
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
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
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
