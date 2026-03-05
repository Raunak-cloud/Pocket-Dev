-- CreateTable
CREATE TABLE "custom_apis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "authHeaderName" TEXT,
    "authParamName" TEXT,
    "apiKey" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_apis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_apis_projectId_idx" ON "custom_apis"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_apis_projectId_slug_key" ON "custom_apis"("projectId", "slug");

-- AddForeignKey
ALTER TABLE "custom_apis" ADD CONSTRAINT "custom_apis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
