import React from "react";

export default function Step2Contact({ data, onChange, errors }) {
  const field = (name) => ({
    id: name,
    name,
    value: data[name] || "",
    onChange: (e) => onChange(name, e.target.value),
    className: `form-input ${errors[name] ? "form-input-error" : ""}`,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  const ndaSame = data.ndaSignerSameAsContact !== false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-brand-navy">Contact details</h2>
        <p className="text-sm text-gray-500 mt-1">
          Primary commercial contact for the partnership.
        </p>
      </div>

      {/* Name row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="contactFirstName">
            First name <span className="text-red-500">*</span>
          </label>
          <input type="text" placeholder="Jane" autoComplete="given-name" {...field("contactFirstName")} />
          {errors.contactFirstName && (
            <p id="contactFirstName-error" className="form-error">{errors.contactFirstName}</p>
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="contactLastName">
            Last name <span className="text-red-500">*</span>
          </label>
          <input type="text" placeholder="Smith" autoComplete="family-name" {...field("contactLastName")} />
          {errors.contactLastName && (
            <p id="contactLastName-error" className="form-error">{errors.contactLastName}</p>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="form-label" htmlFor="contactTitle">
          Title / role <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input type="text" placeholder="VP of Sales" autoComplete="organization-title" {...field("contactTitle")} />
      </div>

      {/* Phone + Email */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="contactPhone">
            Direct phone <span className="text-red-500">*</span>
          </label>
          <input type="tel" placeholder="+1 (555) 000-0000" autoComplete="tel" {...field("contactPhone")} />
          {errors.contactPhone && (
            <p id="contactPhone-error" className="form-error">{errors.contactPhone}</p>
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="contactEmail">
            Email <span className="text-red-500">*</span>
          </label>
          <input type="email" placeholder="jane@acme.com" autoComplete="email" {...field("contactEmail")} />
          {errors.contactEmail && (
            <p id="contactEmail-error" className="form-error">{errors.contactEmail}</p>
          )}
        </div>
      </div>

      {/* NDA signer checkbox */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            id="ndaSignerSameAsContact"
            checked={ndaSame}
            onChange={(e) => onChange("ndaSignerSameAsContact", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">
              The NDA will be signed by the commercial contact above
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              Uncheck if a different person — e.g. a legal signatory — will sign the NDA.
            </p>
          </div>
        </label>
      </div>

      {/* NDA signer fields — shown only when checkbox is unchecked */}
      {!ndaSame && (
        <div className="space-y-6 rounded-xl border border-brand-blue/30 bg-brand-light px-5 py-6">
          <div>
            <h3 className="text-sm font-bold text-brand-navy">NDA signatory</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              This person will receive and sign the NDA via Acrobat Sign.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="form-label" htmlFor="ndaSignerFirstName">
                First name <span className="text-red-500">*</span>
              </label>
              <input type="text" placeholder="John" autoComplete="given-name" {...field("ndaSignerFirstName")} />
              {errors.ndaSignerFirstName && (
                <p id="ndaSignerFirstName-error" className="form-error">{errors.ndaSignerFirstName}</p>
              )}
            </div>
            <div>
              <label className="form-label" htmlFor="ndaSignerLastName">
                Last name <span className="text-red-500">*</span>
              </label>
              <input type="text" placeholder="Doe" autoComplete="family-name" {...field("ndaSignerLastName")} />
              {errors.ndaSignerLastName && (
                <p id="ndaSignerLastName-error" className="form-error">{errors.ndaSignerLastName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="ndaSignerTitle">
              Title / role <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input type="text" placeholder="General Counsel" autoComplete="organization-title" {...field("ndaSignerTitle")} />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="form-label" htmlFor="ndaSignerPhone">
                Direct phone <span className="text-red-500">*</span>
              </label>
              <input type="tel" placeholder="+1 (555) 000-0000" autoComplete="tel" {...field("ndaSignerPhone")} />
              {errors.ndaSignerPhone && (
                <p id="ndaSignerPhone-error" className="form-error">{errors.ndaSignerPhone}</p>
              )}
            </div>
            <div>
              <label className="form-label" htmlFor="ndaSignerEmail">
                Email <span className="text-red-500">*</span>
              </label>
              <input type="email" placeholder="john@acme.com" autoComplete="email" {...field("ndaSignerEmail")} />
              {errors.ndaSignerEmail && (
                <p id="ndaSignerEmail-error" className="form-error">{errors.ndaSignerEmail}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
