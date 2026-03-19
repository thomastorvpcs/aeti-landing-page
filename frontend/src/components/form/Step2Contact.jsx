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

    </div>
  );
}
