import React, { useState } from "react";
import axios from "axios";
import ProgressIndicator from "./ProgressIndicator";
import Step1Company from "./Step1Company";
import Step2Contact from "./Step2Contact";
import Step3Documents from "./Step3Documents";
import Step4Review from "./Step4Review";
import Confirmation from "./Confirmation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL_FORM = {
  legalCompanyName: "",
  dba: "",
  ein: "",
  entityType: "",
  addressStreet: "",
  addressCity: "",
  addressState: "",
  addressZip: "",
  contactFirstName: "",
  contactLastName: "",
  contactTitle: "",
  contactEmail: "",
  contactPhone: "",
  apName: "",
  apEmail: "",
  apPhone: "",
};

function validateStep(step, formData, w9File) {
  const errors = {};

  if (step === 1) {
    if (!formData.legalCompanyName.trim()) errors.legalCompanyName = "Legal company name is required.";
    if (!formData.ein.trim()) errors.ein = "EIN / Tax ID is required.";
    if (!formData.entityType) errors.entityType = "Please select an entity type.";
    if (!formData.addressStreet.trim()) errors.addressStreet = "Street address is required.";
    if (!formData.addressCity.trim()) errors.addressCity = "City is required.";
    if (!formData.addressState) errors.addressState = "Please select a state.";
    if (!formData.addressZip.trim()) errors.addressZip = "ZIP code is required.";
  }

  if (step === 2) {
    if (!formData.contactFirstName.trim()) errors.contactFirstName = "First name is required.";
    if (!formData.contactLastName.trim()) errors.contactLastName = "Last name is required.";
    if (!formData.contactPhone.trim()) errors.contactPhone = "Phone number is required.";
    if (!formData.contactEmail.trim()) {
      errors.contactEmail = "Email is required.";
    } else if (!EMAIL_REGEX.test(formData.contactEmail)) {
      errors.contactEmail = "Enter a valid email address.";
    }
    if (formData.apEmail && !EMAIL_REGEX.test(formData.apEmail)) {
      errors.apEmail = "Enter a valid AP email address.";
    }
  }

  if (step === 3) {
    if (!w9File) errors.w9File = "Please upload your W-9 before continuing.";
  }

  return errors;
}

export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [w9File, setW9File] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleNext = () => {
    const errs = validateStep(step, formData, w9File);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
    window.scrollTo({ top: document.getElementById("apply")?.offsetTop - 80, behavior: "smooth" });
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const stepErrors = validateStep(4, formData, w9File);
    if (!agreed) stepErrors.agreed = "You must confirm accuracy before submitting.";
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const body = new FormData();
      Object.entries(formData).forEach(([k, v]) => v && body.append(k, v));
      body.append("w9", w9File);

      await axios.post("/api/submit", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSubmitted(true);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        "Something went wrong. Please try again or contact resellers@pcsww.com.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <Confirmation formData={formData} />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ProgressIndicator currentStep={step} />

      <div className="rounded-2xl bg-white shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-8 sm:px-10">
            {step === 1 && (
              <Step1Company data={formData} onChange={handleChange} errors={errors} />
            )}
            {step === 2 && (
              <Step2Contact data={formData} onChange={handleChange} errors={errors} />
            )}
            {step === 3 && (
              <Step3Documents w9File={w9File} onW9Change={setW9File} errors={errors} />
            )}
            {step === 4 && (
              <Step4Review
                formData={formData}
                w9File={w9File}
                agreed={agreed}
                onAgreedChange={setAgreed}
                errors={errors}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="border-t border-gray-100 bg-gray-50 px-6 py-5 sm:px-10 flex items-center justify-between gap-4">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {submitError && (
                <p className="text-xs text-red-600 text-right max-w-xs">{submitError}</p>
              )}

              {step < 4 ? (
                <button type="button" onClick={handleNext} className="btn-primary">
                  Continue
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || !agreed}
                  className="btn-primary"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit application
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
