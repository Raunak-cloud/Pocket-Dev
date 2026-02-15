import Logo from "../Logo";

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/3 rounded-full blur-3xl" />
      </div>

      {/* Loading animation */}
      <div className="text-center relative z-10">
        <div className="inline-flex items-center justify-center mb-6">
          <Logo size={64} animate />
        </div>

        {/* Modern spinner */}
        <div className="relative w-24 h-24 mx-auto mb-6">
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
            <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full animate-pulse"></div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-2">Pocket Dev</h1>
        <p className="text-text-tertiary">Initializing...</p>
      </div>
    </div>
  );
}
