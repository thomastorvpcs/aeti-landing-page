import React from "react";

const STEPS = [
  { label: "Company info" },
  { label: "Commercial contact" },
  { label: "Finance & banking" },
  { label: "Documents" },
  { label: "Review" },
];

export default function ProgressIndicator({ currentStep, complete }) {
  return (
    <nav aria-label="Onboarding progress" className="mb-10">
      <ol className="flex items-center justify-center">
        {STEPS.map((step, idx) => {
          const stepNum = idx + 1;
          const isDone = complete || stepNum < currentStep;
          const isActive = !complete && stepNum === currentStep;

          return (
            <React.Fragment key={step.label}>
              {/* Step */}
              <li className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all ${
                    isDone
                      ? "bg-brand-blue text-white"
                      : isActive
                      ? "bg-brand-blue text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isDone ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`mt-2 hidden sm:block text-xs whitespace-nowrap ${
                    isActive ? "font-medium text-brand-navy" : isDone ? "text-gray-500" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </li>

              {/* Connector */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 sm:mx-4 transition-all ${
                    stepNum < currentStep || complete ? "bg-brand-blue" : "bg-gray-200"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
