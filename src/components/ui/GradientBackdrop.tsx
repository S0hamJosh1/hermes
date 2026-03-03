"use client";

export default function GradientBackdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div className="absolute inset-0 app-gradient-bg" />

      {/* Floating orbs */}
      <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full app-orb app-orb-primary" />
      <div className="absolute top-1/3 -right-16 h-[28rem] w-[28rem] rounded-full app-orb app-orb-secondary" />
      <div className="absolute -bottom-20 left-1/3 h-80 w-80 rounded-full app-orb app-orb-tertiary" />

      {/* Abstract wave layer */}
      <div className="wave-layer">
        <svg className="wave-1" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="url(#waveGrad1)"
            d="M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,229.3C672,235,768,213,864,186.7C960,160,1056,128,1152,133.3C1248,139,1344,181,1392,202.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
          <defs>
            <linearGradient id="waveGrad1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(30, 64, 175, 0.35)" />
              <stop offset="50%" stopColor="rgba(59, 130, 246, 0.25)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0.30)" />
            </linearGradient>
          </defs>
        </svg>

        <svg className="wave-2" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="url(#waveGrad2)"
            d="M0,160L60,170.7C120,181,240,203,360,197.3C480,192,600,160,720,149.3C840,139,960,149,1080,170.7C1200,192,1320,224,1380,240L1440,256L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
          />
          <defs>
            <linearGradient id="waveGrad2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(6, 182, 212, 0.20)" />
              <stop offset="50%" stopColor="rgba(99, 102, 241, 0.18)" />
              <stop offset="100%" stopColor="rgba(30, 64, 175, 0.22)" />
            </linearGradient>
          </defs>
        </svg>

        <svg className="wave-3" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="url(#waveGrad3)"
            d="M0,288L48,272C96,256,192,224,288,218.7C384,213,480,235,576,245.3C672,256,768,256,864,234.7C960,213,1056,171,1152,160C1248,149,1344,171,1392,181.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
          <defs>
            <linearGradient id="waveGrad3" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.15)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0.12)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
