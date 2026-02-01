import { allTemplates } from "@/lib/templates";
import { generateEmbedding } from "@/lib/embedder";
import { upsertDocuments } from "@/lib/pinecone";

async function uploadTemplates() {
  try {
    console.log("Starting template upload...");

    const documents = await Promise.all(
      allTemplates.map(async (template) => {
        // Generate embedding for template description (not HTML)
        const embedding = await generateEmbedding(template.description);

        return {
          id: template.id,
          text: template.description,
          embedding,
          metadata: {
            category: "template",
            templateType: template.type,
            htmlContent: template.htmlContent,
            author: template.author,
            features: template.features.join(", "),
          },
        };
      })
    );

    await upsertDocuments(documents);
    console.log(`✓ Successfully upserted ${documents.length} website templates!`);
  } catch (error) {
    console.error("Error uploading templates:", error);
    process.exit(1);
  }
}

uploadTemplates();
