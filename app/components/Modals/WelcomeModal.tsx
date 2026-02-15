"use client";

import Logo from "../Logo";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-center justify-center p-4">
      <style>{`
        @keyframes welcome-modal-in {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes welcome-logo-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes welcome-logo-glow-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }
        @keyframes welcome-ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes welcome-ring-spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes welcome-particle {
          0% { opacity: 0; transform: translate(0, 0) scale(0); }
          20% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
        }
        @keyframes welcome-shine-sweep {
          0% { transform: translateX(-100%) rotate(25deg); }
          100% { transform: translateX(200%) rotate(25deg); }
        }
        @keyframes welcome-bracket-blink {
          0%, 40%, 100% { opacity: 0.6; }
          20% { opacity: 1; }
        }
        @keyframes welcome-text-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes welcome-card-in {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div
        className="bg-bg-secondary border border-border-secondary/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{
          animation:
            "welcome-modal-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {/* Animated Logo Header */}
        <div className="relative px-6 pt-10 pb-4 text-center overflow-hidden">
          {/* Background radial glow */}
          <div
            className="absolute inset-0 flex items-start justify-center pointer-events-none"
            style={{ top: "-20px" }}
          >
            <div
              className="w-64 h-64 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)",
                animation:
                  "welcome-logo-glow-pulse 3s ease-in-out infinite",
              }}
            />
          </div>

          {/* Logo container with floating animation */}
          <div
            className="relative inline-block mb-5"
            style={{
              animation: "welcome-logo-float 4s ease-in-out infinite",
            }}
          >
            {/* Outer orbiting ring */}
            <div
              className="absolute -inset-5 rounded-full border border-blue-500/20 border-dashed"
              style={{ animation: "welcome-ring-spin 12s linear infinite" }}
            />
            {/* Inner orbiting ring */}
            <div
              className="absolute -inset-3 rounded-full border border-violet-500/25"
              style={{
                animation: "welcome-ring-spin-reverse 8s linear infinite",
              }}
            />

            {/* Orbiting dots on the rings */}
            <div
              className="absolute -inset-5"
              style={{ animation: "welcome-ring-spin 12s linear infinite" }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 bg-violet-400 rounded-full shadow-lg shadow-violet-400/50" />
            </div>
            <div
              className="absolute -inset-3"
              style={{
                animation: "welcome-ring-spin-reverse 8s linear infinite",
              }}
            >
              <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-lg shadow-indigo-400/50" />
            </div>

            {/* Floating particles */}
            {[
              {
                tx: "-30px",
                ty: "-40px",
                delay: "0s",
                dur: "2.5s",
                size: "3px",
                color: "#60a5fa",
              },
              {
                tx: "35px",
                ty: "-25px",
                delay: "0.4s",
                dur: "3s",
                size: "2px",
                color: "#a78bfa",
              },
              {
                tx: "-25px",
                ty: "35px",
                delay: "0.8s",
                dur: "2.8s",
                size: "2.5px",
                color: "#818cf8",
              },
              {
                tx: "40px",
                ty: "30px",
                delay: "1.2s",
                dur: "3.2s",
                size: "2px",
                color: "#60a5fa",
              },
              {
                tx: "-40px",
                ty: "5px",
                delay: "1.6s",
                dur: "2.6s",
                size: "3px",
                color: "#c084fc",
              },
              {
                tx: "20px",
                ty: "-45px",
                delay: "2s",
                dur: "2.9s",
                size: "2px",
                color: "#818cf8",
              },
            ].map((p, i) => (
              <div
                key={i}
                className="absolute top-1/2 left-1/2 rounded-full"
                style={
                  {
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    boxShadow: `0 0 6px ${p.color}`,
                    "--tx": p.tx,
                    "--ty": p.ty,
                    animation: `welcome-particle ${p.dur} ease-out ${p.delay} infinite`,
                  } as React.CSSProperties
                }
              />
            ))}

            {/* The actual logo with glow shadow */}
            <div
              className="relative"
              style={{
                filter:
                  "drop-shadow(0 0 20px rgba(99,102,241,0.4)) drop-shadow(0 0 40px rgba(139,92,246,0.2))",
              }}
            >
              <Logo size={72} animate />
              {/* Shine sweep overlay */}
              <div
                className="absolute inset-0 overflow-hidden rounded-2xl"
                style={{ borderRadius: "18px" }}
              >
                <div
                  className="absolute inset-0 w-[200%]"
                  style={{
                    background:
                      "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 60%)",
                    animation:
                      "welcome-shine-sweep 3s ease-in-out 0.5s infinite",
                  }}
                />
              </div>
            </div>
          </div>

          <h3
            className="text-2xl font-bold text-text-primary mb-2"
            style={{ animation: "welcome-text-in 0.5s ease-out 0.3s both" }}
          >
            Welcome to Pocket Dev!
          </h3>
          <p
            className="text-text-tertiary text-sm"
            style={{ animation: "welcome-text-in 0.5s ease-out 0.5s both" }}
          >
            We&apos;ve given you free tokens to get started. Here&apos;s how
            they work:
          </p>
        </div>

        {/* Token Explanation */}
        <div className="px-6 py-4 space-y-3">
          {/* App Tokens */}
          <div
            className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl"
            style={{ animation: "welcome-card-in 0.5s ease-out 0.6s both" }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/30 to-blue-600/20 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                <svg
                  className="w-4 h-4 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  App Tokens
                </h4>
                <p className="text-xs text-blue-400 font-medium">
                  4 free tokens awarded
                </p>
              </div>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              App tokens let you create new projects. Each new project costs{" "}
              <span className="text-text-primary font-medium">
                2 app tokens
              </span>
              , so you can create{" "}
              <span className="text-text-primary font-medium">
                2 projects
              </span>{" "}
              for free.
            </p>
          </div>

          {/* Integration Tokens */}
          <div
            className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl"
            style={{
              animation: "welcome-card-in 0.5s ease-out 0.75s both",
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/30 to-violet-600/20 flex items-center justify-center flex-shrink-0 border border-violet-500/20">
                <svg
                  className="w-4 h-4 text-violet-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Integration Tokens
                </h4>
                <p className="text-xs text-violet-400 font-medium">
                  10 free tokens awarded
                </p>
              </div>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Integration tokens let you make AI-powered edits to your
              projects. Each edit costs{" "}
              <span className="text-text-primary font-medium">
                1 integration token
              </span>
              , so you get{" "}
              <span className="text-text-primary font-medium">
                10 edits
              </span>{" "}
              for free.
            </p>
          </div>

          {/* Buy More Note */}
          <p
            className="text-xs text-text-muted text-center"
            style={{ animation: "welcome-text-in 0.5s ease-out 0.9s both" }}
          >
            Need more? You can buy additional tokens anytime from the
            sidebar or the Tokens page.
          </p>
        </div>

        {/* CTA */}
        <div
          className="px-6 pb-6"
          style={{ animation: "welcome-text-in 0.5s ease-out 1s both" }}
        >
          <button
            onClick={onClose}
            className="w-full px-5 py-3 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
          >
            Got it, let&apos;s go!
          </button>
        </div>
      </div>
    </div>
  );
}
