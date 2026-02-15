"use client";

interface CancelConfirmModalProps {
  isOpen: "generation" | "edit" | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  editStartTime: number;
  isEditing: boolean;
}

export function CancelConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  editStartTime,
  isEditing,
}: CancelConfirmModalProps) {
  if (!isOpen) return null;

  const withinRefundWindow = Date.now() - editStartTime < 10000;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="relative px-6 pt-8 pb-4 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
          >
            <svg
              className="w-5 h-5"
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
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-amber-500/20 rounded-2xl">
            <svg
              className="w-8 h-8 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">
            {isOpen === "generation" ? "Cancel Generation?" : "Cancel Editing?"}
          </h3>
          <p className="text-text-tertiary text-sm">
            {isOpen === "generation"
              ? "The AI is still generating your app. Are you sure you want to cancel? Progress will be lost."
              : "The AI is still applying your edits. Are you sure you want to cancel? Changes will be lost."}
          </p>
          {isOpen === "edit" && withinRefundWindow && (
            <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-xs text-emerald-300">
                Cancelling now will refund your integration tokens.
              </p>
            </div>
          )}
          {isOpen === "edit" && !withinRefundWindow && (
            <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-xs text-amber-300">
                More than 10 seconds have passed. Tokens cannot be refunded.
              </p>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-text-secondary bg-bg-tertiary hover:bg-border-secondary rounded-xl text-sm font-medium transition"
          >
            Keep Going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-white bg-red-600 hover:bg-red-500 rounded-xl text-sm font-medium transition"
          >
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
