import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT || "{}"
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { userId, appName, prompt } = await req.json();

    if (!userId || !appName) {
      return NextResponse.json(
        { error: "userId and appName are required" },
        { status: 400 }
      );
    }

    // Generate unique app ID
    const timestamp = Date.now();
    const appId = `gen-${userId.slice(0, 8)}-${timestamp}`;

    // Sanitize displayName for Firebase tenant requirements:
    // - 4-20 characters
    // - Letters, digits, hyphens only
    // - Must start with a letter
    const sanitizeDisplayName = (name: string): string => {
      // Remove special chars, keep only letters, digits, spaces
      let sanitized = name.replace(/[^a-zA-Z0-9\s]/g, '');

      // Replace spaces with hyphens
      sanitized = sanitized.replace(/\s+/g, '-');

      // Ensure starts with letter
      if (!/^[a-zA-Z]/.test(sanitized)) {
        sanitized = 'app-' + sanitized;
      }

      // Limit to 20 chars, ensure min 4
      sanitized = sanitized.slice(0, 20);
      if (sanitized.length < 4) {
        sanitized = sanitized.padEnd(4, '-app');
      }

      // Lowercase for consistency
      return sanitized.toLowerCase();
    };

    const tenantDisplayName = sanitizeDisplayName(appName);
    const fullDisplayName = `${appName.slice(0, 50)} (Generated)`;

    console.log(`Creating Firebase Tenant: ${fullDisplayName} (${appId})`);
    console.log(`Tenant display name: ${tenantDisplayName}`);

    const projectId = process.env.FIREBASE_PROJECT_ID || "pocket-dev-b77a4";
    // Use unrestricted API key for generated apps (or fallback to main key)
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_GENERATED_APP_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;

    // Create Firebase Auth Tenant for complete user isolation
    let tenantId = '';
    try {
      const tenant = await admin.auth().tenantManager().createTenant({
        displayName: tenantDisplayName,
        emailSignInConfig: {
          enabled: true,
          passwordRequired: true,
        },
        multiFactorConfig: {
          state: 'DISABLED',
        },
      });

      tenantId = tenant.tenantId;
      console.log(`✅ Created Firebase Tenant: ${tenantId}`);

      // Tenant created successfully
      // Note: Google OAuth needs to be enabled in Firebase Console globally
      // It will automatically work for all tenants

    } catch (tenantError: any) {
      console.error('Error creating tenant:', tenantError);
      // If tenant creation fails, log it but continue
      // (Might be due to Identity Platform not enabled)
      console.warn('⚠️ Tenant creation failed - using shared auth pool');
      console.warn('To enable multi-tenancy, upgrade to Firebase Identity Platform');
    }

    // Firebase config with tenant ID
    const firebaseConfig = {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId: appId,
      tenantId: tenantId || null, // Tenant ID for auth isolation
    };

    // Save app metadata to Firestore for tracking
    await admin.firestore().collection("generatedApps").doc(appId).set({
      appId,
      userId,
      appName,
      prompt,
      displayName: fullDisplayName,
      tenantDisplayName: tenantDisplayName,
      firebaseConfig,
      tenantId: tenantId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "active",
    });

    console.log(`✅ Firebase App created: ${appId} ${tenantId ? `(Tenant: ${tenantId})` : '(Shared Auth)'}`);

    return NextResponse.json({
      success: true,
      appId,
      firebaseConfig,
      tenantId: tenantId || null,
      multiTenancyEnabled: !!tenantId,
      message: tenantId
        ? "Firebase app created with isolated authentication"
        : "Firebase app created (shared auth pool - upgrade to Identity Platform for isolation)",
    });
  } catch (error: any) {
    console.error("Error creating Firebase app:", error);
    return NextResponse.json(
      {
        error: "Failed to create Firebase app",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
