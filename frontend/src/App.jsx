import React, { useState } from "react";
import OnboardingForm from "./components/form/OnboardingForm";
import ApplicationIntro from "./components/form/ApplicationIntro";

export default function App() {
  const [started, setStarted] = useState(() => sessionStorage.getItem("aeti_started") === "true");

  return (
    <div className="min-h-screen bg-brand-light py-20">
      <div className="section-container">
        {started ? (
          <OnboardingForm />
        ) : (
          <ApplicationIntro onStart={() => { sessionStorage.setItem("aeti_started", "true"); setStarted(true); }} />
        )}
      </div>
    </div>
  );
}
