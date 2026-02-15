import type { CompatibleUser } from "@/app/contexts/AuthContext";
import type { SavedProject } from "@/app/types";

interface SettingsContentProps {
  user: CompatibleUser | null;
  savedProjects: SavedProject[];
}

export default function SettingsContent({ user, savedProjects }: SettingsContentProps) {
  return (
    <div className="max-w-2xl mx-auto w-full p-6">
      <h2 className="text-2xl font-semibold text-text-primary mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-bg-secondary/50 border border-border-primary rounded-xl p-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">Profile</h3>
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                <span className="text-2xl font-semibold text-text-primary">
                  {user?.displayName?.charAt(0) ||
                    user?.email?.charAt(0) ||
                    "U"}
                </span>
              </div>
            )}
            <div>
              <p className="text-text-primary font-medium">
                {user?.displayName || "User"}
              </p>
              <p className="text-text-tertiary text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-bg-secondary/50 border border-border-primary rounded-xl p-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">Account</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-text-tertiary">Plan</span>
              <span className="text-text-primary">Free</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-text-tertiary">Projects Created</span>
              <span className="text-text-primary">{savedProjects.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
