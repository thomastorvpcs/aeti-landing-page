import React, { useState, useEffect } from "react";
import axios from "axios";
import ProgressIndicator from "./ProgressIndicator";
import Step1Company from "./Step1Company";
import Step2Contact from "./Step2Contact";
import Step3Finance from "./Step3Finance";
import Step3Documents from "./Step3Documents";
import Step4Review from "./Step4Review";
import Confirmation from "./Confirmation";
import { saveFile, loadFile, removeFile, clearFiles } from "../../utils/fileStorage";

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
  addressCountry: "United States",
  website: "",
  billingAddressStreet: "",
  billingAddressCity: "",
  billingAddressState: "",
  billingAddressZip: "",
  billingAddressCountry: "",
  contactFirstName: "",
  contactLastName: "",
  contactTitle: "",
  contactEmail: "",
  contactPhone: "",
  ndaSignerSameAsContact: true,
  ndaSignerFirstName: "",
  ndaSignerLastName: "",
  ndaSignerTitle: "",
  ndaSignerEmail: "",
  ndaSignerPhone: "",
  financeContactName: "",
  financeContactTitle: "",
  financeContactEmail: "",
  financeContactPhone: "",
  bankName: "",
  bankAddress: "",
  bankAccountNumber: "",
  bankAba: "",
  bankSwift: "",
};

function validateStep(step, formData, w9File, bankLetterFile) {
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
    if (!formData.ndaSignerSameAsContact) {
      if (!formData.ndaSignerFirstName.trim()) errors.ndaSignerFirstName = "First name is required.";
      if (!formData.ndaSignerLastName.trim()) errors.ndaSignerLastName = "Last name is required.";
      if (!formData.ndaSignerPhone.trim()) errors.ndaSignerPhone = "Phone number is required.";
      if (!formData.ndaSignerEmail.trim()) {
        errors.ndaSignerEmail = "Email is required.";
      } else if (!EMAIL_REGEX.test(formData.ndaSignerEmail)) {
        errors.ndaSignerEmail = "Enter a valid email address.";
      }
    }
  }

  if (step === 3) {
    if (!formData.financeContactName.trim()) errors.financeContactName = "Finance contact name is required.";
    if (!formData.financeContactEmail.trim()) {
      errors.financeContactEmail = "Finance contact email is required.";
    } else if (!EMAIL_REGEX.test(formData.financeContactEmail)) {
      errors.financeContactEmail = "Enter a valid email address.";
    }
    if (!formData.financeContactPhone.trim()) errors.financeContactPhone = "Finance contact phone is required.";
    if (!formData.bankName.trim()) errors.bankName = "Bank name is required.";
    if (!formData.bankAccountNumber.trim()) errors.bankAccountNumber = "Account number is required.";
    if (!formData.bankAba.trim()) errors.bankAba = "ABA routing number is required.";
  }

  if (step === 4) {
    if (!w9File) errors.w9File = "Please upload your W-9 before continuing.";
    if (!bankLetterFile) errors.bankLetterFile = "Please upload your bank letter before continuing.";
  }

  return errors;
}

const SESSION_KEY = "aeti_onboarding";

function loadSession() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export default function OnboardingForm() {
  const session = loadSession();
  const [step, setStep] = useState(session?.step || 1);
  const [formData, setFormData] = useState(session?.formData || INITIAL_FORM);
  const [w9File, setW9File] = useState(null);
  const [bankLetterFile, setBankLetterFile] = useState(null);

  // Load persisted files from IndexedDB on mount
  useEffect(() => {
    loadFile("w9").then((f) => { if (f) setW9File(f); }).catch(() => {});
    loadFile("bankLetter").then((f) => { if (f) setBankLetterFile(f); }).catch(() => {});
  }, []);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Persist form data and step to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ step, formData }));
    } catch {}
  }, [step, formData]);

  const handleW9Change = (file) => {
    setW9File(file);
    if (file) {
      saveFile("w9", file).catch(() => {});
      setErrors((prev) => ({ ...prev, w9File: undefined }));
    } else {
      removeFile("w9").catch(() => {});
    }
  };

  const handleBankLetterChange = (file) => {
    setBankLetterFile(file);
    if (file) {
      saveFile("bankLetter", file).catch(() => {});
      setErrors((prev) => ({ ...prev, bankLetterFile: undefined }));
    } else {
      removeFile("bankLetter").catch(() => {});
    }
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleNext = () => {
    const errs = validateStep(step, formData, w9File, bankLetterFile);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const stepErrors = validateStep(5, formData, w9File, bankLetterFile);
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
      body.append("bankLetter", bankLetterFile);

      await axios.post(`${import.meta.env.VITE_API_BASE_URL || ""}/api/submit`, body, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem("aeti_started");
      clearFiles().catch(() => {});
      setSubmitted(true);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        "Something went wrong. Please try again or contact abtiquestions@pcsww.com.";
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

      <div className="rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.07)] overflow-hidden">
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-8 sm:px-10">
            {step === 1 && (
              <Step1Company data={formData} onChange={handleChange} errors={errors} />
            )}
            {step === 2 && (
              <Step2Contact data={formData} onChange={handleChange} errors={errors} />
            )}
            {step === 3 && (
              <Step3Finance data={formData} onChange={handleChange} errors={errors} />
            )}
            {step === 4 && (
              <Step3Documents
                w9File={w9File}
                onW9Change={handleW9Change}
                bankLetterFile={bankLetterFile}
                onBankLetterChange={handleBankLetterChange}
                errors={errors}
              />
            )}
            {step === 5 && (
              <Step4Review
                formData={formData}
                w9File={w9File}
                bankLetterFile={bankLetterFile}
                agreed={agreed}
                onAgreedChange={setAgreed}
                errors={errors}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="border-t border-gray-100 bg-white px-6 py-5 sm:px-10 flex items-center justify-between gap-4">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-full border border-brand-blue px-5 py-2 text-sm font-medium text-brand-blue bg-transparent hover:bg-brand-blue/5 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {submitError && (
                <p className="text-xs text-red-600 text-right max-w-xs">{submitError}</p>
              )}
              {step < 5 ? (
                <button type="button" onClick={handleNext} className="btn-primary">
                  Continue
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
                      Submitting…
                    </>
                  ) : (
                    "Submit application"
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
