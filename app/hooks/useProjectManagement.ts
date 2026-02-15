import { useState } from "react";
import type { ReactProject, SavedProject } from "@/app/types";

interface UseProjectManagementProps {
  user: any; // Clerk user object
  userData: any; // UserData from Prisma
  refreshUserData: () => Promise<void>;
  currentProjectId: string | null;
  setProject: (project: ReactProject | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  setStatus: (status: "idle" | "loading" | "success" | "error") => void;
  setGenerationPrompt: (prompt: string) => void;
  setPublishedUrl: (url: string | null) => void;
  setDeploymentId: (id: string | null) => void;
  setHasUnpublishedChanges: (value: boolean) => void;
  setEditHistory: (history: any[]) => void;
  setError: (error: string) => void;
}

export function useProjectManagement(props: UseProjectManagementProps) {
  const {
    userData,
    refreshUserData,
    currentProjectId,
    setProject,
    setCurrentProjectId,
    setStatus,
    setGenerationPrompt,
    setPublishedUrl,
    setDeploymentId,
    setHasUnpublishedChanges,
    setEditHistory,
    setError,
  } = props;

  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const saveProjectToFirestore = async (
    projectData: ReactProject,
    projectPrompt: string,
    authIntegrationCost: number = 0,
  ): Promise<string> => {
    if (!userData) throw new Error("User not logged in");

    try {
      // Call API to create project (handles token deduction atomically)
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
          config: projectData.config || null,
          imageCache: projectData.imageCache || null,
          authIntegrationCost,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save project");
      }

      const { projectId } = await response.json();

      // Refresh user data to get updated balances
      await refreshUserData();

      return projectId;
    } catch (error) {
      console.error("Error saving project:", error);
      throw error;
    }
  };

  const updateProjectInFirestore = async (
    projectId: string,
    projectData: ReactProject,
  ): Promise<void> => {
    if (!userData) throw new Error("User not logged in");

    try {
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
          config: projectData.config || null,
          imageCache: projectData.imageCache || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update project");
      }
    } catch (error) {
      console.error("Error updating project:", error);
      throw error;
    }
  };

  const loadSavedProjects = async () => {
    if (!userData) return;

    setLoadingProjects(true);
    try {
      const response = await fetch("/api/projects/list");

      if (!response.ok) {
        throw new Error("Failed to load projects");
      }

      const projects: SavedProject[] = await response.json();
      setSavedProjects(projects);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!userData) return;

    try {
      const response = await fetch("/api/projects/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

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

      await loadSavedProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      setError("Failed to delete project. Please try again.");
    }
  };

  return {
    savedProjects,
    loadingProjects,
    setSavedProjects,
    saveProjectToFirestore,
    updateProjectInFirestore,
    loadSavedProjects,
    deleteProject,
  };
}
