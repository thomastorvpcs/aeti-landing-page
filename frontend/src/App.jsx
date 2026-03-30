import React, { useState } from "react";
import OnboardingForm from "./components/form/OnboardingForm";
import ApplicationIntro from "./components/form/ApplicationIntro";

export default function App() {
  const [started, setStarted] = useState(() => sessionStorage.getItem("aeti_started") === "true");

  return (
    <div className="min-h-screen bg-brand-light py-20">
      <div className="section-container">
        {started ? (
          <>
            <div className="mx-auto max-w-2xl mb-6">
              <button
                onClick={() => { sessionStorage.removeItem("aeti_started"); setStarted(false); }}
                className="inline-flex items-center gap-1.5 text-sm text-brand-blue hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to application guide
              </button>
            </div>
            <OnboardingForm />
          </>
        ) : (
          <ApplicationIntro onStart={() => { sessionStorage.setItem("aeti_started", "true"); setStarted(true); }} />
        )}
      </div>
    </div>
  );
}
