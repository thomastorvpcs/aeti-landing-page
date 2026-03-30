import React from "react";
import ndaPreview from "../../assets/MNDAdraft.png";
import resellerPreview from "../../assets/ResellerDraft.png";

const FORM_STEPS = [
  {
    number: "1",
    title: "Company information",
    description: "Legal company name, EIN / Tax ID, entity type, and business address.",
  },
  {
    number: "2",
    title: "Commercial contact",
    description: "Primary point of contact for the partnership — name, title, email, and phone.",
  },
  {
    number: "3",
    title: "Finance & banking",
    description: "Finance contact details and bank account information for ACH / wire payments.",
  },
  {
    number: "4",
    title: "Document uploads",
    description: "Upload your W-9 and a voided check or bank letter to verify your account.",
  },
  {
    number: "5",
    title: "Review & submit",
    description: "Confirm all information is accurate, then submit your application.",
  },
];

const AFTER_SUBMISSION = [
  {
    number: "1",
    title: "Sign the NDA",
    duration: "Within 15 min",
    description:
      "You'll receive a DocuSign email shortly after submitting. Review and sign the mutual NDA electronically — takes about 2 minutes.",
  },
  {
    number: "2",
    title: "PCS Legal countersigns",
    duration: "≤ 2 business days",
    description:
      "PCS Legal countersigns the NDA and sends you the Apple Business Trade-In authorization letter along with your signed copy.",
  },
  {
    number: "3",
    title: "Finance & banking verification",
    duration: "1–2 business days",
    description:
      "Our finance team reaches out to confirm banking details and sends a $1 test payment to verify the ACH / wire channel.",
  },
  {
    number: "4",
    title: "Activate & start selling",
    duration: "Same day",
    description:
      "Receive your partner portal credentials, complete onboarding training, and access all reseller resources.",
  },
];

const REQUIRED_DOCS = [
  {
    name: "IRS Form W-9",
    detail: "Completed and signed — required for vendor setup and tax reporting.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: "Bank letter or voided check",
    detail: "On bank letterhead, showing account number and ABA routing number.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
];

export default function ApplicationIntro({ onStart }) {
  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-blue/10 border border-brand-blue/20 px-4 py-1.5 mb-5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
            Now accepting applications
          </span>
        </div>
        <h1 className="text-3xl font-bold text-brand-navy sm:text-4xl">
          Apple Business Trade-In
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          Reseller application — takes approximately 10 minutes to complete.
        </p>
      </div>

      {/* Application steps */}
      <div className="rounded-2xl bg-white shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden mb-6">
        <div className="bg-brand-navy px-6 py-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="text-base font-semibold text-white">What you'll complete</h2>
        </div>

        <ol className="divide-y divide-gray-100">
          {FORM_STEPS.map((item) => (
            <li key={item.number} className="flex items-start gap-4 px-6 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white mt-0.5">
                {item.number}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Required documents */}
      <div className="rounded-2xl bg-amber-50 border border-amber-200 overflow-hidden mb-8">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-amber-200">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-base font-semibold text-amber-800">Documents to have ready</h2>
        </div>
        <ul className="divide-y divide-amber-100">
          {REQUIRED_DOCS.map((doc) => (
            <li key={doc.name} className="flex items-start gap-4 px-6 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 mt-0.5">
                {doc.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">{doc.name}</p>
                <p className="mt-0.5 text-sm text-amber-700 leading-relaxed">{doc.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* After submission */}
      <div className="rounded-2xl bg-white shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden mb-8">
        <div className="bg-brand-navy px-6 py-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-base font-semibold text-white">What happens after you submit</h2>
        </div>

        <ol className="divide-y divide-gray-100">
          {AFTER_SUBMISSION.map((item) => (
            <li key={item.number} className="flex items-start gap-4 px-6 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-sm font-bold text-brand-blue mt-0.5">
                {item.number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <span className="inline-block rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    {item.duration}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">
                  {item.description}
                </p>
                {item.number === "1" && (
                  <img
                    src={ndaPreview}
                    alt="NDA draft preview"
                    className="mt-3 w-40 h-52 object-contain rounded-lg border border-gray-200 shadow-sm"
                  />
                )}
                {item.number === "2" && (
                  <img
                    src={resellerPreview}
                    alt="Reseller letter preview"
                    className="mt-3 w-40 h-52 object-contain rounded-lg border border-gray-200 shadow-sm"
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* CTA */}
      <div className="text-center">
        <button onClick={onStart} className="btn-primary px-10 py-4 text-base">
          Start application
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
        <p className="mt-4 text-sm text-gray-500">
          Questions before you apply?{" "}
          <a href="mailto:resellers@pcsww.com" className="text-brand-blue font-medium hover:underline">
            resellers@pcsww.com
          </a>
        </p>
      </div>
    </div>
  );
}
