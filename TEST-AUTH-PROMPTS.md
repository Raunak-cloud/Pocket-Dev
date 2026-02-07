# 🔥 Firebase Authentication Test Guide

## ⚡ ZERO SETUP - Authentication Works Immediately!

---

## Test Cases for Firebase Authentication

### ✅ Should Generate Auth (Positive Cases)

1. **Basic Auth Keywords:**
   - "Create a Next.js app with authentication"
   - "Build a dashboard with user login"
   - "Add authentication to my app"
   - "Make an app with sign in and sign up"

2. **OAuth Specific:**
   - "Create app with Google login"
   - "Build SaaS app with OAuth authentication"
   - "E-commerce site with Google sign-in"

3. **App Types + Auth:**
   - "E-commerce site with user accounts"
   - "Portfolio with protected admin panel"
   - "Blog with user authentication"
   - "Social media app with user profiles"

4. **Database + Auth:**
   - "Create a dashboard with user data storage"
   - "Build an app with user profiles and saved preferences"
   - "E-commerce with shopping cart for logged-in users"

### ❌ Should NOT Generate Auth (Negative Cases)

1. "Simple restaurant website"
2. "Landing page for startup"
3. "Portfolio website"
4. "E-commerce product catalog" (no explicit auth mention)
5. "Blog website" (unless auth is mentioned)

---

## Expected Behavior When Auth is Generated

### Files Generated:
- ✅ `lib/firebase-config.ts` - With **REAL config** (not placeholders!)
- ✅ `lib/auth.ts` - Auth helper functions
- ✅ `app/components/AuthProvider.tsx` - Auth context
- ✅ `app/components/Navbar.tsx` - With auth UI
- ✅ `app/sign-in/page.tsx` - Sign-in page (email + Google)
- ✅ `app/sign-up/page.tsx` - Sign-up page
- ✅ `app/profile/page.tsx` - Protected profile page
- ✅ `app/components/ProtectedRoute.tsx` - Route protection
- ✅ `README.md` - Usage guide (no setup instructions!)

### Dependencies:
- ✅ `"firebase": "^10.13.0"` in package.json

### Firebase Config Injection:
Check `lib/firebase-config.ts` should have:
```typescript
const firebaseConfig = {
  apiKey: "AIzaSyA..." // Real API key, NOT "PLACEHOLDER_API_KEY"
  authDomain: "pocket-dev-b77a4.firebaseapp.com", // Real domain
  projectId: "pocket-dev-b77a4", // Real project ID
  appId: "gen-abc123-1706789..." // Unique generated app ID
  // ... more real values
};
```

### Progress Messages:
After generation, should show:
- ✅ "Saving project..."
- ✅ "🔐 Setting up Firebase authentication..."
- ✅ "✅ Firebase authentication ready!"

---

## Manual Testing Steps

### Test 1: Basic Auth Generation

```
1. Open Pocket Dev
2. Enter prompt: "Create an e-commerce app with user authentication"
3. Click Generate
4. Wait for generation (~30-60 seconds)

VERIFY:
✅ Progress shows "🔐 Setting up Firebase authentication..."
✅ Progress shows "✅ Firebase authentication ready!"
✅ Files include lib/firebase-config.ts with REAL config
✅ No PLACEHOLDER_ values in firebase-config.ts
```

### Test 2: StackBlitz Integration

```
1. Generate app with auth (use test above)
2. Click "Open in StackBlitz"
3. Wait for StackBlitz to load
4. Navigate to /sign-up in preview

VERIFY:
✅ Sign-up page loads without errors
✅ Can create account with email + password
✅ Can sign in with Google (prompts for Google auth)
✅ After sign-up, redirects to home page
✅ Navbar shows "Sign Out" button when logged in
```

### Test 3: Profile Page (Protected Route)

```
1. In StackBlitz preview, ensure you're logged in
2. Navigate to /profile

VERIFY:
✅ Profile page shows user data (name, email, user ID)
✅ User avatar or initial is displayed
✅ Member since date is shown

3. Sign out
4. Try to visit /profile again

VERIFY:
✅ Redirects to /sign-in automatically
```

### Test 4: Firestore Database

```
1. Generate app with auth + shopping cart
   Prompt: "Create e-commerce with user authentication and shopping cart"

2. Open in StackBlitz
3. Sign in
4. Add items to cart

VERIFY:
✅ Cart persists across page refreshes
✅ Cart data saved in Firestore (check Firebase console)
✅ Different users have separate carts
```

### Test 5: Multiple Generated Apps Isolation

```
1. Generate App A: "E-commerce with auth"
2. Generate App B: "Blog with auth"
3. Open both in StackBlitz
4. Create user in App A
5. Try to sign in to App B with same credentials

VERIFY:
✅ Cannot sign into App B with App A credentials
✅ Each app has independent user pool
✅ Data doesn't leak between apps
```

---

## Automated Test Checklist

For each auth-enabled generation:

### File Verification:
- [ ] `lib/firebase-config.ts` exists
- [ ] Firebase config has REAL values (no PLACEHOLDER_)
- [ ] `lib/auth.ts` exists with helper functions
- [ ] `app/components/AuthProvider.tsx` exists
- [ ] `app/sign-in/page.tsx` exists
- [ ] `app/sign-up/page.tsx` exists
- [ ] `app/profile/page.tsx` exists
- [ ] `app/components/Navbar.tsx` has auth UI

### Dependency Verification:
- [ ] `package.json` includes `"firebase": "^10.13.0"`

### Code Quality:
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] All imports resolve correctly

### Functional Testing:
- [ ] Sign-up works in StackBlitz
- [ ] Sign-in works in StackBlitz
- [ ] Google OAuth prompts correctly
- [ ] Profile page is protected
- [ ] Sign-out works correctly
- [ ] Navbar updates based on auth state

---

## Firestore Verification

Check Firebase Console:

### After Generating App:
```
1. Open Firebase Console
2. Navigate to Firestore Database
3. Check collections:

Firestore/
  generatedApps/
    gen-{userId}-{timestamp}/
      ✅ userId: "abc123..."
      ✅ appName: "E-commerce..."
      ✅ prompt: "Create..."
      ✅ firebaseConfig: {...}
      ✅ createdAt: timestamp
```

### After User Signs Up in Generated App:
```
Firestore/
  users/
    {newUserId}/
      (User data will be created here when they use the app)
```

---

## Performance Testing

### Generation Time:
- Without auth: ~30-45 seconds
- With auth: ~35-50 seconds (+5-10 seconds for Firebase setup)

### StackBlitz Load Time:
- First load: ~10-15 seconds
- Auth should work immediately (no additional setup)

---

## Error Scenarios to Test

### Test 1: Firebase API Failure
```
Simulate: Temporarily disable FIREBASE_SERVICE_ACCOUNT env var
Expected: Auth still generates but uses placeholder values
Verify: Shows warning "⚠️ Auth setup failed - using defaults"
```

### Test 2: Invalid Email/Password
```
1. Generate app with auth
2. Try to sign up with invalid email (e.g., "notanemail")
3. Try password less than 6 characters

VERIFY:
✅ Shows validation error
✅ Doesn't crash
✅ Error message is user-friendly
```

### Test 3: Already Registered Email
```
1. Sign up with test@example.com
2. Sign out
3. Try to sign up again with test@example.com

VERIFY:
✅ Shows "Email already in use" error
✅ Suggests signing in instead
```

---

## Regression Testing

Ensure non-auth apps still work:

```
1. Generate simple landing page (no auth keywords)
2. Verify NO auth files are generated
3. Verify firebase is NOT in dependencies
4. Verify app loads normally in StackBlitz
```

---

## Success Metrics

### For Each Test:

✅ **Setup Time**: 0 seconds (auto-configured)
✅ **User Action Required**: None for auth setup
✅ **Auth Working in StackBlitz**: < 10 seconds after open
✅ **Sign-up Success Rate**: > 95%
✅ **Protected Routes Working**: 100%
✅ **Data Isolation**: 100% (no cross-app leaks)

---

## Common Issues & Solutions

### Issue 1: "Firebase config has PLACEHOLDER values"
**Cause**: API route failed to create Firebase app
**Solution**: Check FIREBASE_SERVICE_ACCOUNT env var
**Check**: `/api/create-firebase-app` logs for errors

### Issue 2: "Can't sign in with Google"
**Cause**: Google OAuth not enabled in Firebase
**Solution**: Enable Google provider in Firebase Console → Authentication → Sign-in methods

### Issue 3: "Profile page redirects to sign-in when logged in"
**Cause**: Auth state not persisting
**Solution**: Check browser doesn't block cookies, check IndexedDB quota

### Issue 4: "Data not saving to Firestore"
**Cause**: Firestore security rules blocking writes
**Solution**: Update Firestore rules to allow user writes to their own data

---

## Quick Test Command

```bash
# Test prompt to copy-paste:
Create a modern e-commerce website with user authentication, Google login, shopping cart, and user profiles. Include a products page, cart page, and protected checkout page.
```

**Expected**:
- ✅ 15-20 files generated
- ✅ Firebase auth auto-configured
- ✅ Works immediately in StackBlitz
- ✅ Shopping cart persists in Firestore
- ✅ Protected routes work correctly

---

**Last Updated**: 2026-02-07
**Test Status**: ✅ All tests passing
**Auth Type**: Firebase (auto-configured)
**Setup Time**: 0 seconds (instant!)
