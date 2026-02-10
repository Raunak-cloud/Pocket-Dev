import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface GeneratedFile {
  path: string;
  content: string;
}

const POLLINATIONS_URL_RE =
  /https:\/\/image\.pollinations\.ai\/prompt\/[^\s"'`)>]+/g;

/**
 * Scan generated files for Pollinations AI image URLs, fetch each image once,
 * upload to Firebase Storage, and replace the URLs so images are permanent.
 *
 * On per-image failure the original URL is kept (graceful degradation).
 */
export async function persistPollinationsImages(
  files: GeneratedFile[],
  userId: string,
): Promise<GeneratedFile[]> {
  // 1. Collect all unique Pollinations URLs across all files
  const urlSet = new Set<string>();
  for (const file of files) {
    const matches = file.content.match(POLLINATIONS_URL_RE);
    if (matches) {
      for (const m of matches) urlSet.add(m);
    }
  }

  if (urlSet.size === 0) return files;

  const uniqueUrls = Array.from(urlSet);
  const urlMap = new Map<string, string>(); // original → Firebase URL

  // 2. Fetch & upload with concurrency limit of 3
  const timestamp = Date.now();
  let index = 0;

  async function processUrl(url: string): Promise<void> {
    const i = index++;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const storagePath = `generated-images/${userId}/${timestamp}-${i}.png`;
      const storageRef = ref(storage, storagePath);
      const arrayBuf = await blob.arrayBuffer();
      await uploadBytes(storageRef, new Uint8Array(arrayBuf), {
        contentType: blob.type || "image/png",
      });
      const downloadUrl = await getDownloadURL(storageRef);
      urlMap.set(url, downloadUrl);
    } catch (err) {
      console.warn(`Failed to persist image, keeping original URL: ${url}`, err);
    }
  }

  // Process in batches of 3
  for (let start = 0; start < uniqueUrls.length; start += 3) {
    const batch = uniqueUrls.slice(start, start + 3);
    await Promise.all(batch.map(processUrl));
  }

  // 3. Replace URLs in all file contents
  if (urlMap.size === 0) return files;

  return files.map((file) => {
    let content = file.content;
    for (const [original, firebaseUrl] of urlMap) {
      content = content.split(original).join(firebaseUrl);
    }
    return content !== file.content ? { ...file, content } : file;
  });
}
