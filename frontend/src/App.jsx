import React from "react";
import OnboardingForm from "./components/form/OnboardingForm";

export default function App() {
  return (
    <div className="min-h-screen bg-brand-light py-20">
      <div className="section-container">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-3xl font-bold text-brand-navy sm:text-4xl">
            Apply for partnership
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Complete the form below to begin your onboarding. The process
            takes approximately 10 minutes.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
