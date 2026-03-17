import React from "react";

export default function LeadershipQuote() {
  return (
    <section className="py-24 bg-brand-navy">
      <div className="section-container">
        <div className="mx-auto max-w-3xl text-center">
          {/* Quote mark */}
          <svg
            className="mx-auto mb-8 h-12 w-12 text-brand-blue/50"
            fill="currentColor"
            viewBox="0 0 32 32"
          >
            <path d="M10 8C5.582 8 2 11.582 2 16s3.582 8 8 8h2v-4h-2a4 4 0 110-8h2V8h-2zm14 0h-2v4h2a4 4 0 110 8h-2v4h2c4.418 0 8-3.582 8-8s-3.582-8-8-8z" />
          </svg>

          <blockquote className="text-2xl font-medium text-white leading-relaxed sm:text-3xl">
            "Our reseller partners aren't a sales channel — they are the primary
            way we bring value to our customers. We've built our entire go-to-market
            model around making them successful, and that means treating their
            business as seriously as we treat our own."
          </blockquote>

          <div className="mt-10 flex flex-col items-center gap-4">
            {/* Avatar placeholder */}
            <div className="h-14 w-14 rounded-full bg-brand-blue/30 flex items-center justify-center ring-2 ring-brand-blue/50">
              <svg className="h-7 w-7 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white">Executive Leadership</p>
              <p className="text-sm text-blue-300">PCS</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
