import React from "react";

const sections = [
  {
    title: "1. Who We Are",
    content: (
      <>
        <p>PCS Wireless LLC<br />11 Vreeland Road, Florham Park, NJ 07932<br />United States</p>
        <p className="mt-2">Contact: <a href="mailto:privacy@pcsww.com" className="text-brand-blue hover:underline">privacy@pcsww.com</a></p>
        <p className="mt-2">Depending on your jurisdiction, PCS Wireless LLC acts as a data controller or equivalent responsible party for the personal data we process.</p>
      </>
    ),
  },
  {
    title: "2. Information We Collect",
    content: (
      <>
        <p>We may collect and process the following categories of information:</p>
        <p className="mt-3 font-semibold text-gray-800">A. Company Information</p>
        <ul className="mt-1 list-disc list-inside space-y-1">
          <li>Legal entity name</li>
          <li>Business registration numbers</li>
          <li>Corporate addresses and billing addresses</li>
          <li>Tax identification numbers</li>
          <li>Bank account and payment information</li>
        </ul>
        <p className="mt-3 font-semibold text-gray-800">B. Personal Data of Company Representatives</p>
        <ul className="mt-1 list-disc list-inside space-y-1">
          <li>Full name</li>
          <li>Job title and role</li>
          <li>Work email address</li>
          <li>Work or mobile telephone number</li>
          <li>Work address</li>
          <li>Identity or authorization information (as required for compliance, onboarding, fraud checks, or payment approvals)</li>
        </ul>
        <p className="mt-3">We may obtain this information directly from you, from your organization, or from third party partners, service providers, logistics partners, fraud prevention databases, or compliance/verification tools.</p>
      </>
    ),
  },
  {
    title: "3. How We Use the Information",
    content: (
      <>
        <p>We use company information and personal data to:</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>Establish and manage business relationships</li>
          <li>Verify company identity and authorized representatives</li>
          <li>Review and approve onboarding applications</li>
          <li>Process and receive payments, issue invoices, and manage accounts payable/receivable</li>
          <li>Provide customer service and operational communications</li>
          <li>Prevent fraud, misuse, or security incidents</li>
          <li>Comply with applicable legal, regulatory, financial, and tax obligations</li>
          <li>Support internal business analytics, planning, reporting, and auditing</li>
          <li>Manage mergers, acquisitions, restructurings, or transfers of business operations</li>
        </ul>
        <p className="mt-3">We do not sell personal data or use it for unrelated marketing without permission (and in many regions we do not conduct marketing to B2B contacts at all).</p>
      </>
    ),
  },
  {
    title: "4. Legal Bases (Where Applicable)",
    content: (
      <>
        <p>Because we operate globally, the legal basis for processing may vary by region. Common bases include:</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li><strong>Performance of a contract</strong> (e.g., onboarding, payment processing, supply chain requirements)</li>
          <li><strong>Legitimate business interests</strong> (e.g., fraud prevention, business operations, internal administration)</li>
          <li><strong>Compliance with legal or regulatory obligations</strong> (e.g., tax laws, sanctions screening, financial reporting)</li>
          <li><strong>Consent</strong>, where required by local law (e.g., certain optional uses or direct marketing where applicable)</li>
        </ul>
      </>
    ),
  },
  {
    title: "5. Sharing of Information",
    content: (
      <>
        <p>We may share information with:</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>PCS Wireless group companies and affiliates</li>
          <li>Service providers handling IT systems, hosting, logistics, payment processing, compliance screening, auditing, or professional services</li>
          <li>Banks and financial institutions involved in payments</li>
          <li>Legal, tax, regulatory, or enforcement authorities when required by law</li>
          <li>Potential buyers, investors, or professional advisers in connection with corporate transactions</li>
          <li>Fraud prevention or security partners</li>
        </ul>
        <p className="mt-3">All third parties are required to process information only for legitimate business purposes and under appropriate protections.</p>
      </>
    ),
  },
  {
    title: "6. International Transfers",
    content: (
      <p>Because PCS Wireless operates globally, your information may be transferred to and processed in countries outside your own, including the United States. These countries may have different data protection standards. Where required, we use appropriate safeguards such as contractual data transfer clauses, intra-group agreements, or other mechanisms permitted under applicable law.</p>
    ),
  },
  {
    title: "7. Data Security",
    content: (
      <>
        <p>We implement reasonable technical and organizational measures designed to:</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>Protect information from unauthorized access</li>
          <li>Maintain business continuity</li>
          <li>Prevent data loss, misuse, alteration, or disclosure</li>
        </ul>
        <p className="mt-3">Only personnel who need access to perform their duties are permitted to handle personal data.</p>
      </>
    ),
  },
  {
    title: "8. Data Retention",
    content: (
      <>
        <p>We retain information only for as long as necessary for business, legal, regulatory, or operational purposes. Typical retention periods include:</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li><strong>Company and financial records:</strong> in accordance with applicable accounting and tax laws</li>
          <li><strong>Contract and commercial documents:</strong> for the duration of the business relationship plus legally required retention periods</li>
          <li><strong>Compliance and fraud prevention records:</strong> as required by regulatory obligations</li>
        </ul>
      </>
    ),
  },
  {
    title: "9. Your Rights",
    content: (
      <>
        <p>Depending on your country or state, you may have some or all of the following rights:</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>Access your personal data</li>
          <li>Request correction or updates</li>
          <li>Request deletion (subject to legal or operational requirements)</li>
          <li>Object to or restrict certain processing</li>
          <li>Request data portability</li>
          <li>Withdraw consent (where consent is the basis of processing)</li>
        </ul>
        <p className="mt-3">To exercise rights, contact <a href="mailto:privacy@pcsww.com" className="text-brand-blue hover:underline">privacy@pcsww.com</a>. We may require verification of identity and will respond within the time period required by applicable law.</p>
      </>
    ),
  },
  {
    title: "10. Changes to This Policy",
    content: (
      <p>We may update this Privacy Policy periodically. The latest version will always be available upon request and posted where appropriate. Material changes will be communicated when legally required.</p>
    ),
  },
  {
    title: "11. Contact Us",
    content: (
      <>
        <p>For questions, concerns, or requests regarding this Privacy Policy or your data, contact:</p>
        <p className="mt-2">Email: <a href="mailto:privacy@pcsww.com" className="text-brand-blue hover:underline">privacy@pcsww.com</a></p>
        <p>Postal Address: 11 Vreeland Road, Florham Park, NJ 07932, USA</p>
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-brand-light py-20">
      <div className="section-container">
        <div className="mx-auto max-w-3xl">
          {/* Back link */}
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-brand-blue hover:underline mb-8"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to application
          </a>

          <div className="rounded-2xl bg-white shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-brand-navy px-8 py-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-2">PCS Wireless LLC</p>
              <h1 className="text-2xl font-bold text-white">Global Privacy Policy</h1>
              <p className="mt-1 text-sm text-blue-300">Apple Business Trade-In Reseller Program &mdash; Effective Date: March 2026</p>
            </div>

            {/* Intro */}
            <div className="px-8 py-6 border-b border-gray-100 text-sm text-gray-600 leading-relaxed">
              PCS Wireless LLC ("PCS Wireless," "we," "us," or "our") is committed to protecting the privacy and security of the information we receive from companies and their representatives around the world. This Privacy Policy explains how we collect, use, share, store, and protect Reseller company information and personal data of employees or representatives provided to us in connection with our business activities, registration processes, onboarding, contracting, payment operations, compliance checks, and ongoing commercial relationships concerning the Apple Enterprise Trade-In Program.
            </div>

            {/* Sections */}
            <div className="divide-y divide-gray-100">
              {sections.map((section) => (
                <div key={section.title} className="px-8 py-6">
                  <h2 className="text-base font-bold text-brand-navy mb-3">{section.title}</h2>
                  <div className="text-sm text-gray-600 leading-relaxed space-y-2">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} PCS Wireless LLC. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
