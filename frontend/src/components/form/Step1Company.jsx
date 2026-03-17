import React from "react";

const ENTITY_TYPES = [
  "LLC",
  "C-Corp",
  "S-Corp",
  "Partnership",
  "Sole Proprietor",
  "Non-profit",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

export default function Step1Company({ data, onChange, errors }) {
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
        <h2 className="text-xl font-bold text-brand-navy">Company information</h2>
        <p className="text-sm text-gray-500 mt-1">
          This information will be used to prepare the NDA and create your vendor record.
        </p>
      </div>

      {/* Legal company name */}
      <div>
        <label className="form-label" htmlFor="legalCompanyName">
          Legal company name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Acme Technologies LLC"
          autoComplete="organization"
          {...field("legalCompanyName")}
        />
        {errors.legalCompanyName && (
          <p id="legalCompanyName-error" className="form-error">{errors.legalCompanyName}</p>
        )}
      </div>

      {/* DBA */}
      <div>
        <label className="form-label" htmlFor="dba">
          DBA / trade name{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="Acme Tech"
          {...field("dba")}
        />
      </div>

      {/* EIN + Entity type */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="ein">
            EIN / Tax ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="12-3456789"
            {...field("ein")}
          />
          {errors.ein && (
            <p id="ein-error" className="form-error">{errors.ein}</p>
          )}
        </div>

        <div>
          <label className="form-label" htmlFor="entityType">
            Entity type <span className="text-red-500">*</span>
          </label>
          <select
            id="entityType"
            name="entityType"
            value={data.entityType || ""}
            onChange={(e) => onChange("entityType", e.target.value)}
            className={`form-input ${errors.entityType ? "form-input-error" : ""}`}
            aria-invalid={!!errors.entityType}
          >
            <option value="">Select entity type...</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.entityType && (
            <p id="entityType-error" className="form-error">{errors.entityType}</p>
          )}
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="form-label" htmlFor="addressStreet">
          Street address <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="123 Main Street, Suite 400"
          autoComplete="street-address"
          {...field("addressStreet")}
        />
        {errors.addressStreet && (
          <p id="addressStreet-error" className="form-error">{errors.addressStreet}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="form-label" htmlFor="addressCity">
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="New York"
            autoComplete="address-level2"
            {...field("addressCity")}
          />
          {errors.addressCity && (
            <p id="addressCity-error" className="form-error">{errors.addressCity}</p>
          )}
        </div>

        <div>
          <label className="form-label" htmlFor="addressState">
            State <span className="text-red-500">*</span>
          </label>
          <select
            id="addressState"
            name="addressState"
            value={data.addressState || ""}
            onChange={(e) => onChange("addressState", e.target.value)}
            className={`form-input ${errors.addressState ? "form-input-error" : ""}`}
            aria-invalid={!!errors.addressState}
            autoComplete="address-level1"
          >
            <option value="">State...</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.addressState && (
            <p id="addressState-error" className="form-error">{errors.addressState}</p>
          )}
        </div>

        <div>
          <label className="form-label" htmlFor="addressZip">
            ZIP <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="10001"
            maxLength={10}
            autoComplete="postal-code"
            {...field("addressZip")}
          />
          {errors.addressZip && (
            <p id="addressZip-error" className="form-error">{errors.addressZip}</p>
          )}
        </div>
      </div>
    </div>
  );
}
