import React from "react";

function ReviewRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-3 border-b border-gray-100 last:border-0">
      <dt className="w-48 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm text-gray-900 font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-brand-navy uppercase tracking-wide">{title}</h3>
      </div>
      <dl className="px-5">{children}</dl>
    </div>
  );
}

export default function Step4Review({ formData, w9File, bankLetterFile, agreed, onAgreedChange, errors }) {
  const {
    legalCompanyName, dba, ein, entityType,
    addressStreet, addressCity, addressState, addressZip, addressCountry,
    billingAddressStreet, billingAddressCity, billingAddressState, billingAddressZip, billingAddressCountry,
    website,
    contactFirstName, contactLastName, contactTitle, contactEmail, contactPhone,
    financeContactName, financeContactTitle, financeContactEmail, financeContactPhone,
    bankName, bankAddress, bankAccountNumber, bankAba, bankSwift,
  } = formData;

  const fullName = [contactFirstName, contactLastName].filter(Boolean).join(" ");
  const fullAddress = [addressStreet, addressCity, addressState, addressZip, addressCountry]
    .filter(Boolean)
    .join(", ");

  const hasBillingAddress = billingAddressStreet || billingAddressCity || billingAddressState || billingAddressZip;
  const fullBillingAddress = [billingAddressStreet, billingAddressCity, billingAddressState, billingAddressZip, billingAddressCountry]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-brand-navy">Review &amp; submit</h2>
        <p className="text-sm text-gray-500 mt-1">
          Please confirm your information before submitting.
        </p>
      </div>

      <Section title="Company">
        <ReviewRow label="Legal name" value={legalCompanyName} />
        <ReviewRow label="DBA" value={dba} />
        <ReviewRow label="EIN / Tax ID" value={ein} />
        <ReviewRow label="Entity type" value={entityType} />
        <ReviewRow label="Address" value={fullAddress} />
        {hasBillingAddress && (
          <ReviewRow label="Billing address" value={fullBillingAddress} />
        )}
        <ReviewRow label="Website" value={website} />
      </Section>

      <Section title="Contact">
        <ReviewRow label="Name" value={fullName} />
        <ReviewRow label="Title" value={contactTitle} />
        <ReviewRow label="Email" value={contactEmail} />
        <ReviewRow label="Phone" value={contactPhone} />
      </Section>

      <Section title="Finance contact">
        <ReviewRow label="Name" value={financeContactName} />
        <ReviewRow label="Title" value={financeContactTitle} />
        <ReviewRow label="Email" value={financeContactEmail} />
        <ReviewRow label="Phone" value={financeContactPhone} />
      </Section>

      <Section title="Banking details">
        <ReviewRow label="Bank name" value={bankName} />
        <ReviewRow label="Bank address" value={bankAddress} />
        <ReviewRow label="Account #" value={bankAccountNumber} />
        <ReviewRow label="ABA routing #" value={bankAba} />
        <ReviewRow label="SWIFT code" value={bankSwift} />
      </Section>

      <Section title="Documents">
        <ReviewRow
          label="W-9"
          value={
            w9File ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {w9File.name}
              </span>
            ) : null
          }
        />
        <ReviewRow
          label="Bank letter"
          value={
            bankLetterFile ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {bankLetterFile.name}
              </span>
            ) : null
          }
        />
      </Section>

      {/* Agreement */}
      <div
        className={`rounded-xl border p-5 ${
          errors.agreed ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50"
        }`}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => onAgreedChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
            aria-describedby={errors.agreed ? "agreed-error" : undefined}
          />
          <span className="text-sm text-gray-700">
            I confirm that all information provided is accurate and I agree to the{" "}
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-blue hover:underline font-medium"
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>
        {errors.agreed && (
          <p id="agreed-error" className="form-error mt-2">{errors.agreed}</p>
        )}
      </div>
    </div>
  );
}
