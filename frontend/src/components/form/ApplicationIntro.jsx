import React from "react";
import ndaPreview from "../../assets/MNDAdraft.png";
import resellerPreview from "../../assets/ResellerDraft.png";
import ndaPdf from "../../assets/nda-draft.pdf";
import resellerPdf from "../../assets/reseller-letter-draft.pdf.pdf";

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
        <h1 className="text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
          Apple Business Trade-In
        </h1>
        <p className="mt-4 text-lg text-gray-500 font-light">
          Reseller application — takes approximately 10 minutes to complete.
        </p>
      </div>

      {/* Application steps */}
      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden mb-4">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-brand-navy">What you'll complete</h2>
        </div>
        <ol className="divide-y divide-gray-100">
          {FORM_STEPS.map((item) => (
            <li key={item.number} className="flex items-start gap-4 px-6 py-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white mt-0.5">
                {item.number}
              </div>
              <div>
                <p className="text-sm font-medium text-brand-navy">{item.title}</p>
                <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Required documents */}
      <div className="rounded-2xl bg-brand-light border border-gray-200 overflow-hidden mb-4">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-base font-semibold text-brand-navy">Documents to have ready</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {REQUIRED_DOCS.map((doc) => (
            <li key={doc.name} className="flex items-start gap-4 px-6 py-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 mt-0.5">
                {doc.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-brand-navy">{doc.name}</p>
                <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">{doc.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* After submission */}
      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden mb-10">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-brand-navy">What happens after you submit</h2>
        </div>
        <ol className="divide-y divide-gray-100">
          {AFTER_SUBMISSION.map((item) => (
            <li key={item.number} className="flex items-start gap-4 px-6 py-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand-blue mt-0.5">
                {item.number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-medium text-brand-navy">{item.title}</p>
                  <span className="inline-block rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    {item.duration}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">
                  {item.description}
                </p>
                {item.number === "1" && (
                  <a href={ndaPdf} download="NDA-Draft.pdf" className="mt-3 block w-48 group">
                    <div className="w-48 h-64 rounded-xl border border-gray-200 overflow-hidden bg-white relative">
                      <img src={ndaPreview} alt="NDA draft preview" className="w-full h-full object-contain block" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 group-active:bg-black/30 transition-colors flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100">
                        <span className="text-xs font-medium text-white bg-black/60 rounded-full px-3 py-1">Download PDF</span>
                      </div>
                    </div>
                  </a>
                )}
                {item.number === "2" && (
                  <a href={resellerPdf} download="Reseller-Letter-Draft.pdf" className="mt-3 block w-48 group">
                    <div className="w-48 h-64 rounded-xl border border-gray-200 overflow-hidden bg-white relative">
                      <img src={resellerPreview} alt="Reseller letter preview" className="w-full h-full object-contain block" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 group-active:bg-black/30 transition-colors flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100">
                        <span className="text-xs font-medium text-white bg-black/60 rounded-full px-3 py-1">Download PDF</span>
                      </div>
                    </div>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* CTA */}
      <div className="text-center">
        <button onClick={onStart} className="btn-primary px-10 py-3.5 text-base">
          Start application
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
        <p className="mt-5 text-sm text-gray-400">
          Questions before you apply?{" "}
          <a href="mailto:resellers@pcsww.com" className="text-brand-blue hover:underline">
            resellers@pcsww.com
          </a>
        </p>
      </div>
    </div>
  );
}
