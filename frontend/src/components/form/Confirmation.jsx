import React from "react";
import ProgressIndicator from "./ProgressIndicator";

const NEXT_STEPS = [
  {
    step: 1,
    title: "Sign the NDA",
    description:
      "Within 1 business day you'll receive the mutual NDA by email for electronic signature. Review and sign electronically — it takes about 2 minutes.",
  },
  {
    step: 2,
    title: "Receive the program letter",
    description:
      "Once the NDA is countersigned by PCS Legal, you'll receive the full Apple Business Trade-In authorization letter and your signed NDA by email.",
  },
  {
    step: 3,
    title: "Finance & banking setup",
    description:
      "Our finance team will call to verify banking details and send a $1 test payment to confirm the ACH/wire channel.",
  },
];

export default function Confirmation({ formData }) {
  const firstName = formData.contactFirstName || "there";
  const company = formData.legalCompanyName || "your company";
  const email = formData.contactEmail || "";

  return (
    <div className="max-w-2xl mx-auto">
      <ProgressIndicator currentStep={4} complete />

      <div className="text-center mb-10">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <svg className="h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className="text-3xl font-bold text-brand-navy">
          Application submitted!
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Hi <strong>{firstName}</strong> — we've received your application for{" "}
          <strong>{company}</strong>.
        </p>
        {email && (
          <p className="mt-2 text-sm text-gray-500">
            A confirmation has been sent to{" "}
            <span className="font-medium text-gray-700">{email}</span>.
          </p>
        )}
      </div>

      {/* Next steps */}
      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-sm mb-8">
        <div className="bg-brand-navy px-6 py-4">
          <h3 className="text-base font-semibold text-white">What happens next</h3>
        </div>
        <ol className="divide-y divide-gray-100">
          {NEXT_STEPS.map((item) => (
            <li key={item.step} className="flex gap-5 px-6 py-5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-sm font-bold text-brand-blue">
                {item.step}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Support */}
      <div className="text-center rounded-xl bg-gray-50 border border-gray-200 px-6 py-5">
        <p className="text-sm text-gray-600">
          Questions? Contact your partner success team at{" "}
          <a
            href="mailto:resellers@pcsww.com"
            className="text-brand-blue font-medium hover:underline"
          >
            resellers@pcsww.com
          </a>
        </p>
      </div>
    </div>
  );
}
