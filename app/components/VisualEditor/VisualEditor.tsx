"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type VisualTheme = {
  primaryColor: string;
  radiusPx: number;
  textScale: number;
  sectionPadY: number;
};

interface VisualEditorProps {
  theme: VisualTheme;
  onThemeChange: (theme: VisualTheme) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  canSave: boolean;
}

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export default function VisualEditor({
  theme,
  onThemeChange,
  onSave,
  onClose,
  isSaving,
  canSave,
}: VisualEditorProps) {
  const [localTheme, setLocalTheme] = useState(theme);
  const [hasChanges, setHasChanges] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync with parent theme
  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  // Track changes
  useEffect(() => {
    const changed =
      localTheme.primaryColor !== theme.primaryColor ||
      localTheme.radiusPx !== theme.radiusPx ||
      localTheme.textScale !== theme.textScale ||
      localTheme.sectionPadY !== theme.sectionPadY;
    setHasChanges(changed);
  }, [localTheme, theme]);

  const showToast = (message: string, type: ToastType = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const handleThemeChange = (updates: Partial<VisualTheme>) => {
    const newTheme = { ...localTheme, ...updates };
    setLocalTheme(newTheme);
    onThemeChange(newTheme);
  };

  const handleSave = async () => {
    try {
      await onSave();
      setSaveSuccess(true);
      showToast("Visual changes saved successfully!", "success");
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      showToast("Failed to save changes. Please try again.", "error");
    }
  };

  const handleReset = () => {
    setLocalTheme(theme);
    onThemeChange(theme);
    showToast("Changes reset", "info");
  };

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "error":
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="absolute top-4 right-4 z-30 w-80 bg-bg-secondary/98 backdrop-blur-xl border border-border-secondary rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-5 py-4 border-b border-border-secondary bg-gradient-to-r from-blue-500/5 to-purple-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Visual Editor
                </h3>
                <p className="text-xs text-text-muted">Customize your design</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="group p-1.5 rounded-lg hover:bg-bg-tertiary transition-all duration-200"
              aria-label="Close visual editor"
            >
              <svg
                className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Live Preview Indicator */}
          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-5 right-5 mt-2"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                  <span>Live preview active</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="p-5 space-y-5 max-h-[calc(100vh-16rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border-secondary scrollbar-track-transparent">
          {/* Primary Color */}
          <div className="space-y-2.5">
            <label className="flex items-center justify-between text-xs font-medium text-text-secondary">
              <span>Primary Color</span>
              <span className="text-text-muted font-mono">
                {localTheme.primaryColor}
              </span>
            </label>
            <div className="flex items-center gap-3">
              <div className="relative group">
                <input
                  type="color"
                  value={localTheme.primaryColor}
                  onChange={(e) =>
                    handleThemeChange({ primaryColor: e.target.value })
                  }
                  className="w-12 h-12 rounded-xl border-2 border-border-secondary bg-transparent cursor-pointer transition-all hover:scale-105 hover:border-blue-500"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              </div>
              <input
                type="text"
                value={localTheme.primaryColor}
                onChange={(e) =>
                  handleThemeChange({ primaryColor: e.target.value })
                }
                className="flex-1 px-3 py-2.5 text-sm bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="#2563eb"
              />
            </div>
          </div>

          {/* Corner Radius */}
          <div className="space-y-2.5">
            <label className="flex items-center justify-between text-xs font-medium text-text-secondary">
              <span>Corner Radius</span>
              <span className="px-2 py-0.5 bg-bg-tertiary rounded-md text-text-primary font-mono">
                {localTheme.radiusPx}px
              </span>
            </label>
            <div className="relative">
              <input
                type="range"
                min={0}
                max={32}
                step={1}
                value={localTheme.radiusPx}
                onChange={(e) =>
                  handleThemeChange({ radiusPx: Number(e.target.value) })
                }
                className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${(localTheme.radiusPx / 32) * 100}%, rgb(30 41 59) ${(localTheme.radiusPx / 32) * 100}%, rgb(30 41 59) 100%)`,
                }}
              />
              <div className="flex justify-between mt-1.5 text-xs text-text-muted">
                <span>Sharp</span>
                <span>Rounded</span>
              </div>
            </div>
          </div>

          {/* Text Scale */}
          <div className="space-y-2.5">
            <label className="flex items-center justify-between text-xs font-medium text-text-secondary">
              <span>Text Scale</span>
              <span className="px-2 py-0.5 bg-bg-tertiary rounded-md text-text-primary font-mono">
                {localTheme.textScale.toFixed(2)}x
              </span>
            </label>
            <div className="relative">
              <input
                type="range"
                min={0.85}
                max={1.25}
                step={0.01}
                value={localTheme.textScale}
                onChange={(e) =>
                  handleThemeChange({ textScale: Number(e.target.value) })
                }
                className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${((localTheme.textScale - 0.85) / 0.4) * 100}%, rgb(30 41 59) ${((localTheme.textScale - 0.85) / 0.4) * 100}%, rgb(30 41 59) 100%)`,
                }}
              />
              <div className="flex justify-between mt-1.5 text-xs text-text-muted">
                <span>Smaller</span>
                <span>Larger</span>
              </div>
            </div>
          </div>

          {/* Section Spacing */}
          <div className="space-y-2.5">
            <label className="flex items-center justify-between text-xs font-medium text-text-secondary">
              <span>Section Spacing</span>
              <span className="px-2 py-0.5 bg-bg-tertiary rounded-md text-text-primary font-mono">
                {localTheme.sectionPadY}px
              </span>
            </label>
            <div className="relative">
              <input
                type="range"
                min={24}
                max={120}
                step={2}
                value={localTheme.sectionPadY}
                onChange={(e) =>
                  handleThemeChange({ sectionPadY: Number(e.target.value) })
                }
                className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${((localTheme.sectionPadY - 24) / 96) * 100}%, rgb(30 41 59) ${((localTheme.sectionPadY - 24) / 96) * 100}%, rgb(30 41 59) 100%)`,
                }}
              />
              <div className="flex justify-between mt-1.5 text-xs text-text-muted">
                <span>Compact</span>
                <span>Spacious</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-border-secondary bg-bg-tertiary/50">
          <div className="flex gap-2">
            {hasChanges && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleReset}
                className="px-3 py-2 text-xs font-medium text-text-muted hover:text-text-primary bg-bg-secondary border border-border-secondary rounded-lg transition-all duration-200 hover:border-border-primary"
              >
                Reset
              </motion.button>
            )}
            <button
              onClick={handleSave}
              disabled={!canSave || isSaving || !hasChanges}
              className="flex-1 relative px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-purple-600 overflow-hidden group"
            >
              <AnimatePresence mode="wait">
                {isSaving ? (
                  <motion.div
                    key="saving"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Saving...</span>
                  </motion.div>
                ) : saveSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Saved!</span>
                  </motion.div>
                ) : (
                  <motion.span
                    key="save"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {hasChanges ? "Save Changes" : "No Changes"}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Shimmer effect on hover */}
              {!isSaving && hasChanges && canSave && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-xl border pointer-events-auto ${
                toast.type === "success"
                  ? "bg-green-500/90 border-green-400 text-white"
                  : toast.type === "error"
                    ? "bg-red-500/90 border-red-400 text-white"
                    : "bg-blue-500/90 border-blue-400 text-white"
              }`}
            >
              {getToastIcon(toast.type)}
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
