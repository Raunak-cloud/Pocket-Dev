# Maintenance Mode Setup Instructions

I've created a comprehensive maintenance mode system for your app. Here's what was added:

## Files Created:

1. **`/app/maintenance/page.tsx`** - Beautiful maintenance page shown to users
2. **`/lib/maintenance.ts`** - Helper functions to manage maintenance status
3. **`/app/components/MaintenanceToggle.tsx`** - Admin component to toggle maintenance mode
4. **`/app/components/MaintenanceCheck.tsx`** - Client-side checker that runs on every page

## Files Updated:

1. **`/app/layout.tsx`** - Added `<MaintenanceCheck />` component

## What You Need to Do:

### Step 1: Add Maintenance Toggle to Admin Section

You need to update your `app/page.tsx` file to show the Maintenance Toggle in the admin section.

Find the `AdminContent` function (around line 5404) and update it to include tabs for "Support Tickets" and "Maintenance":

```tsx
// Add this import at the top of app/page.tsx
import MaintenanceToggle from './components/MaintenanceToggle';

// Add state for admin tabs (add this with your other useState declarations)
const [adminTab, setAdminTab] = useState<'support' | 'maintenance'>('support');

// Then update the AdminContent function:
const AdminContent = () => (
  <div className="max-w-3xl mx-auto w-full p-4 h-full flex flex-col overflow-hidden">
    {/* Tab Navigation */}
    <div className="flex gap-2 mb-4 flex-shrink-0">
      <button
        onClick={() => setAdminTab('support')}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          adminTab === 'support'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        Support Tickets
      </button>
      <button
        onClick={() => setAdminTab('maintenance')}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          adminTab === 'maintenance'
            ? 'bg-orange-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        Maintenance Mode
      </button>
    </div>

    {/* Tab Content */}
    {adminTab === 'maintenance' ? (
      <div className="flex-1 overflow-y-auto">
        <MaintenanceToggle />
      </div>
    ) : (
      // ... rest of your existing support tickets UI
      <>
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white">Support Tickets</h2>
          {/* ... rest of existing code */}
        </div>
        {/* ... rest of existing support tickets code */}
      </>
    )}
  </div>
);
```

### Step 2: Set Up Firebase Admin Claims (Optional but Recommended)

For better security, you should use Firebase Admin Claims instead of checking email addresses.

Create a Firebase Cloud Function or use Firebase Admin SDK to set admin claims:

```javascript
// Example: Set admin claim for a user
admin.auth().setCustomUserClaims(uid, { admin: true });
```

Then update the admin check in `DashboardSidebar.tsx` from:
```tsx
{user.email === "raunak.vision@gmail.com" && (
```

To:
```tsx
{user && (await isUserAdmin(user)) && (
```

### Step 3: Create Firestore Security Rules

Add these security rules to your Firestore to protect the maintenance status:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // System maintenance - only admins can write
    match /system/maintenance {
      allow read: if true;  // Anyone can check maintenance status
      allow write: if request.auth != null &&
                   request.auth.token.admin == true;
    }
  }
}
```

## How It Works:

1. **Maintenance Check**: On every page load, `MaintenanceCheck` component checks if maintenance mode is enabled
2. **Admin Bypass**: Admins can always access the site, even during maintenance
3. **User Redirect**: Non-admin users are redirected to `/maintenance` page when maintenance mode is on
4. **Admin Control**: Admins can toggle maintenance mode and customize the message from the dashboard

## Testing:

1. Go to your dashboard admin section
2. Toggle maintenance mode ON
3. Open an incognito window and try to access the site
4. You should see the maintenance page
5. As an admin, you can still access everything normally

## UI Features:

- Beautiful animated maintenance page with gradient effects
- Real-time status indicator in admin panel
- Customizable maintenance message
- One-click toggle for enable/disable
- Visual feedback with success/error messages
- Responsive design works on all devices

That's it! Your maintenance mode system is now complete.
