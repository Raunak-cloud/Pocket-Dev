import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const htmlContent = formData.get("html") as string;

    if (!htmlContent) {
      return NextResponse.json(
        { error: "No HTML content provided" },
        { status: 400 }
      );
    }

    // Try 0x0.st - simple and reliable
    try {
      const uploadFormData = new FormData();
      const blob = new Blob([htmlContent], { type: "text/html" });
      uploadFormData.append("file", blob, "index.html");

      const response = await fetch("https://0x0.st", {
        method: "POST",
        body: uploadFormData,
      });

      if (response.ok) {
        const url = await response.text();
        if (url && url.trim().startsWith("http")) {
          return NextResponse.json({
            success: true,
            url: url.trim(),
            service: "0x0.st",
            expiresIn: "365 days"
          });
        }
      }
    } catch (error) {
      console.error("0x0.st failed:", error);
    }

    // Fallback to tmpfiles.org
    try {
      const uploadFormData = new FormData();
      const blob = new Blob([htmlContent], { type: "text/html" });
      uploadFormData.append("file", blob, "index.html");

      const response = await fetch("https://tmpfiles.org/api/v1/upload", {
        method: "POST",
        body: uploadFormData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && data.data?.url) {
          // tmpfiles.org requires URL transformation
          const url = data.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
          return NextResponse.json({
            success: true,
            url,
            service: "tmpfiles.org",
            expiresIn: "1 hour"
          });
        }
      }
    } catch (error) {
      console.error("tmpfiles.org failed:", error);
    }

    // Fallback to file.io
    try {
      const uploadFormData = new FormData();
      const blob = new Blob([htmlContent], { type: "text/html" });
      uploadFormData.append("file", blob, "index.html");

      const response = await fetch("https://file.io", {
        method: "POST",
        body: uploadFormData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.link) {
          return NextResponse.json({
            success: true,
            url: data.link,
            service: "file.io",
            expiresIn: "14 days"
          });
        }
      }
    } catch (error) {
      console.error("file.io failed:", error);
    }

    return NextResponse.json(
      { error: "All upload services failed" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
