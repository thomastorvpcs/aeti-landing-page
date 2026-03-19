import React from "react";

export default function Step3Finance({ data, onChange, errors }) {
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
        <h2 className="text-xl font-bold text-brand-navy">Finance &amp; banking</h2>
        <p className="text-sm text-gray-500 mt-1">
          Provide your finance contact and banking details for vendor setup.
        </p>
      </div>

      {/* Finance contact */}
      <div>
        <h3 className="text-base font-semibold text-brand-navy mb-4">Finance contact</h3>

        <div className="space-y-4">
          <div>
            <label className="form-label" htmlFor="financeContactName">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Jane Smith"
              autoComplete="name"
              {...field("financeContactName")}
            />
            {errors.financeContactName && (
              <p id="financeContactName-error" className="form-error">{errors.financeContactName}</p>
            )}
          </div>

          <div>
            <label className="form-label" htmlFor="financeContactTitle">
              Title / position{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Controller"
              autoComplete="organization-title"
              {...field("financeContactTitle")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label" htmlFor="financeContactEmail">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                placeholder="finance@acme.com"
                autoComplete="email"
                {...field("financeContactEmail")}
              />
              {errors.financeContactEmail && (
                <p id="financeContactEmail-error" className="form-error">{errors.financeContactEmail}</p>
              )}
            </div>
            <div>
              <label className="form-label" htmlFor="financeContactPhone">
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                autoComplete="tel"
                {...field("financeContactPhone")}
              />
              {errors.financeContactPhone && (
                <p id="financeContactPhone-error" className="form-error">{errors.financeContactPhone}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Banking details */}
      <div>
        <h3 className="text-base font-semibold text-brand-navy mb-4">Banking details</h3>

        <div className="space-y-4">
          <div>
            <label className="form-label" htmlFor="bankName">
              Bank name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="First National Bank"
              {...field("bankName")}
            />
            {errors.bankName && (
              <p id="bankName-error" className="form-error">{errors.bankName}</p>
            )}
          </div>

          <div>
            <label className="form-label" htmlFor="bankAddress">
              Bank address{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="123 Bank Street, New York, NY 10001"
              {...field("bankAddress")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label" htmlFor="bankAccountNumber">
                Account # <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="000123456789"
                {...field("bankAccountNumber")}
              />
              {errors.bankAccountNumber && (
                <p id="bankAccountNumber-error" className="form-error">{errors.bankAccountNumber}</p>
              )}
            </div>
            <div>
              <label className="form-label" htmlFor="bankAba">
                ABA routing # <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="021000021"
                {...field("bankAba")}
              />
              {errors.bankAba && (
                <p id="bankAba-error" className="form-error">{errors.bankAba}</p>
              )}
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="bankSwift">
              SWIFT code{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="FNBAUS33"
              {...field("bankSwift")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
