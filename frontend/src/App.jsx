import React, { useState } from "react";
import OnboardingForm from "./components/form/OnboardingForm";
import ApplicationIntro from "./components/form/ApplicationIntro";

export default function App() {
  const [started, setStarted] = useState(false);

  return (
    <div className="min-h-screen bg-brand-light py-20">
      <div className="section-container">
        {started ? (
          <OnboardingForm />
        ) : (
          <ApplicationIntro onStart={() => setStarted(true)} />
        )}
      </div>
    </div>
  );
}
