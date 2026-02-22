"use client";

import { useState, useCallback } from "react";
import type { ReactProject } from "@/app/types";
import type { CompatibleUser } from "@/app/contexts/AuthContext";

interface UsePublishingProps {
  user: CompatibleUser | null;
  currentProjectId: string | null;
  project: ReactProject | null;
  generationPrompt: string;
  setError: (error: string) => void;
  loadSavedProjects: () => Promise<void>;
}

export function usePublishing({
  user,
  currentProjectId,
  project,
  generationPrompt,
  setError,
  loadSavedProjects,
}: UsePublishingProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [customDomain, setCustomDomain] = useState("");

  const sanitizeDomain = (input: string): string => {
    const cleaned = input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .replace(/\.+$/, "");
    return cleaned;
  };

  const publishProject = useCallback(async () => {
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

      const publishURLFromResponse = data.url;
      const newDeploymentId = data.deploymentId;

      const persistRes = await fetch("/api/projects/publish-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProjectId,
          isPublished: true,
          publishedUrl: publishURLFromResponse,
          deploymentId: newDeploymentId,
          publishedAt: new Date().toISOString(),
        }),
      });
      if (!persistRes.ok) throw new Error("Failed to persist publish state");

      setPublishedUrl(publishURLFromResponse);
      setDeploymentId(newDeploymentId);
      setHasUnpublishedChanges(false);
      await loadSavedProjects();
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
  }, [project, currentProjectId, user, generationPrompt, setError, loadSavedProjects]);

  const unpublishProject = useCallback(async () => {
    if (!currentProjectId || !user) return;

    setIsUnpublishing(true);
    setError("");
    try {
      // Delete the Cloudflare Pages project if we have a deployment ID
      if (deploymentId) {
        try {
          await fetch("/api/publish", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectName: deploymentId }),
          });
        } catch (deleteError) {
          console.error("Error deleting Cloudflare project:", deleteError);
          // Continue with unpublishing even if remote delete fails
        }
      }

      const persistRes = await fetch("/api/projects/publish-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProjectId,
          isPublished: false,
          publishedUrl: null,
          deploymentId: null,
          publishedAt: null,
          customDomain: null,
        }),
      });
      if (!persistRes.ok) throw new Error("Failed to persist publish state");
      setPublishedUrl(null);
      setDeploymentId(null);
      setCustomDomain("");
      setShowDomainModal(false);
      setHasUnpublishedChanges(false);
      await loadSavedProjects();
    } catch (error) {
      console.error("Error unpublishing project:", error);
      setError("Failed to unpublish project. Please try again.");
    } finally {
      setIsUnpublishing(false);
    }
  }, [currentProjectId, user, deploymentId, setError, loadSavedProjects]);

  const connectDomain = useCallback(
    async (domain: string) => {
      if (!currentProjectId || !user) return;

      try {
        if (!publishedUrl) {
          throw new Error("Publish the site first, then connect a custom domain.");
        }

        const normalized = sanitizeDomain(domain);
        if (!normalized || !normalized.includes(".")) {
          throw new Error("Please enter a valid domain (e.g., yourdomain.com)");
        }

        // We configure the www subdomain by default for external DNS providers.
        const connectDomainValue = normalized.startsWith("www.")
          ? normalized
          : `www.${normalized}`;

        const connectRes = await fetch("/api/publish/domain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: currentProjectId,
            domain: connectDomainValue,
          }),
        });
        const connectData = await connectRes.json();
        if (!connectRes.ok || connectData?.success !== true) {
          throw new Error(
            connectData?.error || "Failed to connect custom domain on Cloudflare",
          );
        }

        const persistRes = await fetch("/api/projects/publish-state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: currentProjectId,
            customDomain: normalized,
          }),
        });
        if (!persistRes.ok) throw new Error("Failed to save custom domain");
        setCustomDomain(normalized);
        await loadSavedProjects();
      } catch (error) {
        console.error("Error connecting domain:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to connect domain. Please try again.",
        );
      }
    },
    [currentProjectId, user, publishedUrl, setError, loadSavedProjects],
  );

  return {
    // State
    isPublishing,
    isUnpublishing,
    publishedUrl,
    deploymentId,
    hasUnpublishedChanges,
    showDomainModal,
    customDomain,
    // Setters
    setIsPublishing,
    setPublishedUrl,
    setDeploymentId,
    setHasUnpublishedChanges,
    setShowDomainModal,
    setCustomDomain,
    // Functions
    publishProject,
    unpublishProject,
    connectDomain,
  };
}
