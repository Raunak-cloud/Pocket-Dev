import { useState, useCallback, useRef } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import type { UploadedFile } from "@/app/types";

interface UseFileUploadProps {
  user: any; // Clerk user object
  setError: (error: string) => void;
}

export function useFileUpload({ user, setError }: UseFileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [editFiles, setEditFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("imageUploader");

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !user) return;

      try {
        const fileArray = Array.from(files);

        // Read files as data URLs for preview
        const filePromises = fileArray.map((file) => {
          return new Promise<{ file: File; dataUrl: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              resolve({ file, dataUrl });
            };
            reader.readAsDataURL(file);
          });
        });

        const filesWithDataUrls = await Promise.all(filePromises);

        // Upload to UploadThing
        const uploadedResults = await startUpload(fileArray);

        if (!uploadedResults) {
          throw new Error("Upload failed");
        }

        // Add uploaded files to state
        const newFiles: UploadedFile[] = uploadedResults.map((result, index) => ({
          name: result.name,
          type: filesWithDataUrls[index].file.type,
          dataUrl: filesWithDataUrls[index].dataUrl,
          downloadUrl: result.url,
        }));

        setUploadedFiles((prev) => [...prev, ...newFiles]);
      } catch (error) {
        console.error("Error uploading files:", error);
        setError(`Failed to upload files. Please try again.`);
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [user, setError, startUpload],
  );

  const handleEditFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !user) return;

      try {
        const fileArray = Array.from(files);

        // Read files as data URLs for preview
        const filePromises = fileArray.map((file) => {
          return new Promise<{ file: File; dataUrl: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              resolve({ file, dataUrl });
            };
            reader.readAsDataURL(file);
          });
        });

        const filesWithDataUrls = await Promise.all(filePromises);

        // Upload to UploadThing
        const uploadedResults = await startUpload(fileArray);

        if (!uploadedResults) {
          throw new Error("Upload failed");
        }

        // Add uploaded files to state
        const newFiles: UploadedFile[] = uploadedResults.map((result, index) => ({
          name: result.name,
          type: filesWithDataUrls[index].file.type,
          dataUrl: filesWithDataUrls[index].dataUrl,
          downloadUrl: result.url,
        }));

        setEditFiles((prev) => [...prev, ...newFiles]);
      } catch (error) {
        console.error("Error uploading files:", error);
        setError(`Failed to upload files. Please try again.`);
      }

      if (editFileInputRef.current) editFileInputRef.current.value = "";
    },
    [user, setError, startUpload],
  );

  const removeFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeEditFile = useCallback((index: number) => {
    setEditFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    uploadedFiles,
    editFiles,
    fileInputRef,
    editFileInputRef,
    setUploadedFiles,
    setEditFiles,
    handleFileUpload,
    handleEditFileUpload,
    removeFile,
    removeEditFile,
    isUploading, // Expose upload state
  };
}
