import React from "react";

const stats = [
  { value: "200+", label: "Active resellers" },
  { value: "12+", label: "Years in market" },
  { value: "$480K", label: "Avg. annual partner revenue" },
];

export default function Hero({ onApplyClick, onLearnClick }) {
  return (
    <section className="relative min-h-screen flex items-center bg-gradient-to-br from-brand-navy via-navy-800 to-navy-700 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-brand-blue/5 blur-3xl" />
      </div>

      <div className="section-container relative z-10 pt-24 pb-16">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-blue/20 px-4 py-1.5 mb-8 border border-brand-blue/30">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-200">
              Now accepting applications
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-extrabold text-white sm:text-5xl lg:text-6xl leading-tight">
            Build a recurring revenue stream with the{" "}
            <span className="text-brand-blue">Apple Business Trade-In</span>
          </h1>

          {/* Sub-copy */}
          <p className="mt-6 text-lg text-blue-200 max-w-2xl mx-auto leading-relaxed">
            PCS gives qualified partners the tools, support, and margin
            structure to grow a predictable, high-margin technology business —
            backed by an enterprise-grade product and a team invested in your
            success.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={onApplyClick} className="btn-primary px-8 py-4 text-base">
              Apply for partnership
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <button onClick={onLearnClick} className="btn-outline-white px-8 py-4 text-base">
              Learn about the program
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {stats.map(({ value, label }) => (
              <div
                key={label}
                className="rounded-xl bg-white/5 border border-white/10 px-6 py-5 backdrop-blur-sm"
              >
                <div className="text-3xl font-extrabold text-white">{value}</div>
                <div className="mt-1 text-sm text-blue-300">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-blue-400">
        <span className="text-xs uppercase tracking-widest">Scroll</span>
        <div className="h-8 w-px bg-blue-400/40" />
      </div>
    </section>
  );
}
