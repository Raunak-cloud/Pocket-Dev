interface GeneratedFile {
  path: string;
  content: string;
}

export function normalizeGeneratedImageSources(
  files: GeneratedFile[],
): GeneratedFile[] {
  return files;
}

export async function persistGeneratedImages(
  files: GeneratedFile[],
): Promise<GeneratedFile[]> {
  if (files.length === 0) return files;

  const response = await fetch("/api/images/persist-generated", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });

  if (!response.ok) {
    let errorMessage = "Failed to persist generated images";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) errorMessage = payload.error;
    } catch {
      // Ignore JSON parse issues and keep default message.
    }
    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as { files?: GeneratedFile[] };
  if (!Array.isArray(payload.files)) {
    throw new Error("Invalid API response while persisting generated images");
  }

  return payload.files;
}
