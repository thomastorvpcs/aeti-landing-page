import React, { useState } from "react";

export default function Step2Contact({ data, onChange, errors }) {
  const [apExpanded, setApExpanded] = useState(
    !!(data.apName || data.apEmail || data.apPhone)
  );

  const field = (name) => ({
    id: name,
    name,
    value: data[name] || "",
    onChange: (e) => onChange(name, e.target.value),
    className: `form-input ${errors[name] ? "form-input-error" : ""}`,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-brand-navy">Contact details</h2>
        <p className="text-sm text-gray-500 mt-1">
          The NDA and program letter will be sent to the email address below.
        </p>
      </div>

      {/* Name row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="contactFirstName">
            First name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Jane"
            autoComplete="given-name"
            {...field("contactFirstName")}
          />
          {errors.contactFirstName && (
            <p id="contactFirstName-error" className="form-error">{errors.contactFirstName}</p>
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="contactLastName">
            Last name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Smith"
            autoComplete="family-name"
            {...field("contactLastName")}
          />
          {errors.contactLastName && (
            <p id="contactLastName-error" className="form-error">{errors.contactLastName}</p>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="form-label" htmlFor="contactTitle">
          Title / role{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="VP of Sales"
          autoComplete="organization-title"
          {...field("contactTitle")}
        />
      </div>

      {/* Phone + Email */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="contactPhone">
            Direct phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            placeholder="+1 (555) 000-0000"
            autoComplete="tel"
            {...field("contactPhone")}
          />
          {errors.contactPhone && (
            <p id="contactPhone-error" className="form-error">{errors.contactPhone}</p>
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="contactEmail">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            placeholder="jane@acme.com"
            autoComplete="email"
            {...field("contactEmail")}
          />
          {errors.contactEmail && (
            <p id="contactEmail-error" className="form-error">{errors.contactEmail}</p>
          )}
        </div>
      </div>

      {/* AP section */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setApExpanded(!apExpanded)}
          className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              Accounts payable contact
            </span>
            <span className="text-xs text-gray-400">(optional)</span>
          </div>
          <svg
            className={`h-4 w-4 text-gray-500 transition-transform ${apExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {apExpanded && (
          <div className="p-5 space-y-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Add a separate accounts payable contact if different from your primary contact.
            </p>
            <div>
              <label className="form-label" htmlFor="apName">AP contact name</label>
              <input type="text" placeholder="John Doe" {...field("apName")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="apEmail">AP email</label>
                <input type="email" placeholder="ap@acme.com" {...field("apEmail")} />
                {errors.apEmail && (
                  <p id="apEmail-error" className="form-error">{errors.apEmail}</p>
                )}
              </div>
              <div>
                <label className="form-label" htmlFor="apPhone">AP phone</label>
                <input type="tel" placeholder="+1 (555) 000-0000" {...field("apPhone")} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
