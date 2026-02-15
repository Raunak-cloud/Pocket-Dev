import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

export const uploadRouter = {
  // Image uploader for user-uploaded images in projects
  imageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 5,
    },
  })
    .middleware(async ({ req }) => {
      // Authenticate user with Clerk
      const { userId } = await auth();

      if (!userId) {
        throw new UploadThingError("Unauthorized");
      }

      // Return userId to be available in onUploadComplete
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("[UploadThing] File uploaded by user:", metadata.userId);
      console.log("[UploadThing] File URL:", file.url);

      // Return data to the client
      return {
        url: file.url,
        userId: metadata.userId,
        name: file.name,
        size: file.size,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
