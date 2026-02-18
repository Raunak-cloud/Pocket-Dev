/**
 * Reusable Loading Component
 *
 * A static loading component that can be imported by both client and server components
 * to show loading states throughout the application.
 *
 * Usage:
 * import Loading from "@/app/components/Loading";
 *
 * <Loading /> // Default spinner
 * <Loading size="sm" /> // Small spinner
 * <Loading size="lg" /> // Large spinner
 * <Loading text="Loading..." /> // With custom text
 * <Loading fullScreen /> // Full screen loading overlay
 */

interface LoadingProps {
  /**
   * Size of the spinner
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Optional loading text to display
   */
  text?: string;

  /**
   * Whether to render as a full screen overlay
   * @default false
   */
  fullScreen?: boolean;

  /**
   * Optional className for customization
   */
  className?: string;
}

export default function Loading({
  size = "md",
  text,
  fullScreen = false,
  className = "",
}: LoadingProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const dotSizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  const spinner = (
    <div className="relative inline-flex items-center justify-center">
      {/* Spinner container */}
      <div className={`relative ${sizeClasses[size]}`}>
        {/* Outer rotating ring */}
        <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>

        {/* Spinning gradient ring */}
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-violet-500 rounded-full animate-spin"></div>

        {/* Middle ring */}
        <div
          className="absolute inset-2 border-4 border-transparent border-b-blue-400 border-l-violet-400 rounded-full animate-spin"
          style={{
            animationDirection: "reverse",
            animationDuration: "1.5s",
          }}
        ></div>

        {/* Inner pulsing dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`${dotSizeClasses[size]} bg-gradient-to-r from-blue-500 to-violet-500 rounded-full animate-pulse`}></div>
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/3 rounded-full blur-3xl" />
        </div>

        {/* Loading content */}
        <div className={`text-center relative z-10 ${className}`}>
          {spinner}
          {text && (
            <p className="mt-4 text-text-tertiary animate-pulse">{text}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      {spinner}
      {text && (
        <p className="text-text-tertiary animate-pulse text-sm">{text}</p>
      )}
    </div>
  );
}
