"use client";

import { useCallback, useState } from "react";

type UploadResult = {
  name: string;
  url: string;
  size?: number;
};

export function useSupabaseUploads() {
  const [isUploading, setIsUploading] = useState(false);

  const startUpload = useCallback(async (files: File[]) => {
    if (!files.length) return null;
    setIsUploading(true);
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }

      const data = (await response.json()) as { files: UploadResult[] };
      return data.files;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { startUpload, isUploading };
}

