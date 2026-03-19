import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = { "application/pdf": [], "image/jpeg": [], "image/png": [] };

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileUploadZone({ file, onFileChange, errorKey, errors, label, ariaLabel, dropPrompt }) {
  const onDrop = useCallback(
    (accepted) => { if (accepted.length > 0) onFileChange(accepted[0]); },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    maxFiles: 1,
  });

  const rejectionMessage = fileRejections[0]?.errors
    .map((e) => {
      if (e.code === "file-too-large") return "File exceeds 10 MB limit.";
      if (e.code === "file-invalid-type") return "Only PDF, JPG, or PNG accepted.";
      return e.message;
    })
    .join(" ");

  return (
    <div>
      <label className="form-label">
        {label} <span className="text-red-500">*</span>
      </label>

      {file ? (
        <div className="flex items-center justify-between rounded-xl border border-green-300 bg-green-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{file.name}</p>
              <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-all ${
            isDragActive
              ? "border-brand-blue bg-brand-light"
              : errors[errorKey]
              ? "border-red-400 bg-red-50"
              : "border-gray-300 bg-gray-50 hover:border-brand-blue hover:bg-brand-light"
          }`}
          aria-label={ariaLabel}
        >
          <input {...getInputProps()} aria-label={ariaLabel} />
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm mb-4">
            <svg className="h-7 w-7 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          {isDragActive ? (
            <p className="text-sm font-medium text-brand-blue">Drop file here...</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                {dropPrompt}, or <span className="text-brand-blue">browse files</span>
              </p>
              <p className="mt-2 text-xs text-gray-400">PDF, JPG, or PNG · Max 10 MB</p>
            </>
          )}
        </div>
      )}

      {(errors[errorKey] || rejectionMessage) && (
        <p className="form-error mt-2">{errors[errorKey] || rejectionMessage}</p>
      )}
    </div>
  );
}

export default function Step3Documents({ w9File, onW9Change, bankLetterFile, onBankLetterChange, errors }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-brand-navy">Documents</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload your W-9 and bank letter. Documents are encrypted in transit and at rest.
        </p>
      </div>

      <FileUploadZone
        file={w9File}
        onFileChange={onW9Change}
        errorKey="w9File"
        errors={errors}
        label="W-9 form"
        ariaLabel="Upload W-9"
        dropPrompt="Drag & drop your W-9"
      />

      <FileUploadZone
        file={bankLetterFile}
        onFileChange={onBankLetterChange}
        errorKey="bankLetterFile"
        errors={errors}
        label="Bank letter"
        ariaLabel="Upload bank letter"
        dropPrompt="Drag & drop your bank letter"
      />
      <p className="text-xs text-gray-400 -mt-4">
        A letter on bank letterhead confirming your account and routing details.
      </p>
    </div>
  );
}
