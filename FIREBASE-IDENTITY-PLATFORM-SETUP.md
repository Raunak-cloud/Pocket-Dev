# 🔒 Firebase Identity Platform Setup Guide

## Enable Multi-Tenancy for Complete Auth Isolation

---

## 🎯 Why Enable Identity Platform?

### Current Behavior (Without Identity Platform):
```
⚠️ All generated apps share the SAME authentication pool

Example Problem:
- User signs up on Generated App A: alice@example.com
- User tries to sign up on Generated App B: alice@example.com
- Firebase rejects: "Email already in use!"
- User is confused: "I never used App B before!"
```

### With Identity Platform Enabled:
```
✅ Each generated app has ISOLATED authentication

Example Solution:
- User signs up on Generated App A: alice@example.com ✅
- User signs up on Generated App B: alice@example.com ✅
- Both work! Different tenants = different user pools
- Complete isolation per generated app!
```

---

## 💰 Pricing

### Firebase Identity Platform Costs:

**Free Tier:**
- First **50 Monthly Active Users (MAU)** per tenant: **FREE**

**Paid:**
- Beyond 50 MAU: **$0.0025 per MAU** (very cheap!)

### Cost Examples:

**Scenario 1: 10 Generated Apps, 100 Users Each**
```
Total: 10 apps × 100 users = 1,000 MAU

Free tier: 10 apps × 50 users = 500 MAU = $0
Paid:      10 apps × 50 users = 500 MAU × $0.0025 = $1.25/month

Total Cost: $1.25/month ✅
```

**Scenario 2: 100 Generated Apps, 50 Users Each**
```
Total: 100 apps × 50 users = 5,000 MAU

All within free tier = $0/month ✅
```

**Scenario 3: 1,000 Generated Apps, 100 Users Each**
```
Total: 1,000 apps × 100 users = 100,000 MAU

Free tier: 1,000 × 50 = 50,000 MAU = $0
Paid:      1,000 × 50 = 50,000 MAU × $0.0025 = $125/month

Total Cost: $125/month
```

**Bottom Line**: Very affordable for the isolation benefits! 🎉

---

## 📋 Setup Steps

### Step 1: Enable Firebase Identity Platform

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: `pocket-dev-b77a4` (or your project)
3. **Navigate to Authentication**
4. **Click "Get Started"** if not already enabled
5. **Look for "Identity Platform"** banner/upgrade option
6. **Click "Upgrade"**

**Screenshot locations**:
- Authentication → Settings → Identity Platform
- Or search for "Identity Platform" in Firebase Console

### Step 2: Verify Multi-Tenancy is Enabled

After upgrading, verify:

1. **In Firebase Console**:
   - Go to Authentication
   - Look for "Tenants" tab
   - Should see option to create tenants

2. **Test the API**:
```bash
# In your terminal
npm run dev

# In another terminal, test tenant creation:
curl -X POST http://localhost:3000/api/create-firebase-app \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test123",
    "appName": "Test App",
    "prompt": "Create app with auth"
  }'

# Look for response:
{
  "multiTenancyEnabled": true,  // ← Should be true!
  "tenantId": "tenant-abc123...", // ← Should have tenant ID
  ...
}
```

### Step 3: Enable Sign-in Methods for Tenants

For each tenant (done automatically by our code):

1. **Email/Password**: Enabled by default ✅
2. **Google OAuth**:
   - Go to Authentication → Sign-in method
   - Enable Google provider
   - This applies to all tenants

### Step 4: Configure OAuth Redirect URLs

If using StackBlitz preview URLs:

1. **Firebase Console** → Authentication → Settings
2. **Authorized domains**:
   - Add: `*.webcontainer.io` (for StackBlitz)
   - Add: `localhost` (for local testing)

---

## 🧪 Testing Multi-Tenancy

### Test 1: Verify Tenant Creation

```bash
# Generate an app with auth
Prompt: "Create e-commerce app with user authentication"

# Check Firebase Console:
1. Go to Authentication → Tenants
2. Should see new tenant: "E-commerce app (Generated)"
3. Click tenant → Should show 0 users initially
```

### Test 2: Verify User Isolation

```bash
# Generate App A
Prompt: "Create e-commerce with auth"
→ Open in StackBlitz
→ Sign up: alice@test.com
→ Verify: User created in Tenant A

# Generate App B
Prompt: "Create blog with auth"
→ Open in StackBlitz
→ Sign up: alice@test.com ✅ Should work!
→ Verify: User created in Tenant B (different user)

# Result:
- App A has user: alice@test.com (Tenant A)
- App B has user: alice@test.com (Tenant B)
- Both exist! Complete isolation! ✅
```

### Test 3: Verify Data Isolation

```bash
# In App A (E-commerce):
- Sign in as alice@test.com
- Add items to cart
- Data saved: users/aliceUID-tenantA/cart/

# In App B (Blog):
- Sign in as alice@test.com (different Alice!)
- Create blog post
- Data saved: users/aliceUID-tenantB/posts/

# Verify:
- Two different Alice users
- Completely separate data
- No leakage between tenants ✅
```

---

## 🔍 Monitoring

### Check Tenant Usage

**Firebase Console**:
```
Authentication → Tenants
→ Click tenant name
→ See user count, sign-in methods, etc.
```

**Firestore Query**:
```typescript
// Get all generated apps with tenants
const apps = await getDocs(
  query(
    collection(db, 'generatedApps'),
    where('tenantId', '!=', null)
  )
);

console.log(`Apps with multi-tenancy: ${apps.size}`);
```

### Monitor Costs

**Firebase Console**:
```
Usage and billing → Identity Platform
→ See Monthly Active Users (MAU) per tenant
→ See projected costs
```

---

## ⚠️ If Identity Platform is NOT Enabled

### Fallback Behavior:

Our code handles this gracefully:

```typescript
// In /api/create-firebase-app
try {
  const tenant = await admin.auth().tenantManager().createTenant(...);
  // ✅ Multi-tenancy enabled
} catch (error) {
  console.warn('Tenant creation failed - using shared auth pool');
  // ⚠️ Falls back to shared authentication
}
```

**User sees**:
```
Progress messages:
"✅ Firebase authentication ready!"
"ℹ️ Note: Using shared auth pool (upgrade to Identity Platform for isolation)"
```

**Impact**:
- Auth still works
- But users share auth pool across apps
- Same email can't be used across different generated apps

---

## 🚀 Migration Path

### Already Have Generated Apps (Without Multi-Tenancy)?

**Option 1: Start Fresh**
- Delete old apps (or mark as legacy)
- Enable Identity Platform
- New apps will have isolated auth

**Option 2: Migrate Users**
```typescript
// For each existing app:
1. Create tenant for the app
2. Export users from main auth pool
3. Import users into tenant
4. Update app config with tenantId
5. Re-deploy to StackBlitz
```

*Note: Migration script not included - contact support if needed*

---

## 🎯 Recommendation

### When to Enable:

**Enable Now If**:
- You expect > 10 generated apps
- Apps will have real users (not just demos)
- User experience matters (no email conflicts)

**Can Wait If**:
- Testing/MVP stage
- Only generating a few apps
- All apps are demos/prototypes

**Cost**: $0-5/month initially (very affordable!)

---

## 📚 Resources

- [Firebase Identity Platform Docs](https://cloud.google.com/identity-platform/docs)
- [Multi-Tenancy Guide](https://cloud.google.com/identity-platform/docs/multi-tenancy-quickstart)
- [Pricing Calculator](https://firebase.google.com/pricing)

---

## ✅ Checklist

After enabling Identity Platform:

- [ ] Firebase Identity Platform upgraded
- [ ] "Tenants" tab visible in Authentication
- [ ] Test tenant creation via API
- [ ] Verify `multiTenancyEnabled: true` in response
- [ ] Test user sign-up in generated app
- [ ] Verify tenant shows in Firebase Console
- [ ] Check users are created in correct tenant
- [ ] Test email can be reused across apps
- [ ] Monitor costs in Usage dashboard

---

## 🐛 Troubleshooting

### Issue: "multiTenancyEnabled: false"

**Cause**: Identity Platform not enabled
**Solution**: Follow Step 1 above to enable

### Issue: "Insufficient permissions to create tenant"

**Cause**: Service account lacks permissions
**Solution**: In Google Cloud Console → IAM:
- Add role: `Firebase Admin`
- Add role: `Identity Platform Admin`

### Issue: "Tenant not visible in Firebase Console"

**Cause**: UI delay or wrong project
**Solution**:
- Refresh console
- Verify correct project selected
- Check `/generatedApps` collection for tenantId

---

**Status**: Implementation complete, ready to enable! 🎉
**Next Step**: Follow Step 1 to enable Firebase Identity Platform
**Cost**: ~$1-5/month for moderate use (very affordable!)
