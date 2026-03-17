import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = { "application/pdf": [], "image/jpeg": [], "image/png": [] };

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Step3Documents({ w9File, onW9Change, errors }) {
  const onDrop = useCallback(
    (accepted) => {
      if (accepted.length > 0) onW9Change(accepted[0]);
    },
    [onW9Change]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-brand-navy">Documents</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload your completed W-9. Your document is encrypted in transit and at rest.
        </p>
      </div>

      {/* W-9 upload */}
      <div>
        <label className="form-label">
          W-9 form <span className="text-red-500">*</span>
        </label>

        {w9File ? (
          /* File preview */
          <div className="flex items-center justify-between rounded-xl border border-green-300 bg-green-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{w9File.name}</p>
                <p className="text-xs text-gray-500">{formatBytes(w9File.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onW9Change(null)}
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              Remove
            </button>
          </div>
        ) : (
          /* Drop zone */
          <div
            {...getRootProps()}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-all ${
              isDragActive
                ? "border-brand-blue bg-brand-light"
                : errors.w9File
                ? "border-red-400 bg-red-50"
                : "border-gray-300 bg-gray-50 hover:border-brand-blue hover:bg-brand-light"
            }`}
            aria-label="W-9 upload area"
          >
            <input {...getInputProps()} aria-label="Upload W-9" />
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm mb-4">
              <svg className="h-7 w-7 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            {isDragActive ? (
              <p className="text-sm font-medium text-brand-blue">Drop your W-9 here...</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">
                  Drag & drop your W-9, or{" "}
                  <span className="text-brand-blue">browse files</span>
                </p>
                <p className="mt-2 text-xs text-gray-400">PDF, JPG, or PNG · Max 10 MB</p>
              </>
            )}
          </div>
        )}

        {(errors.w9File || rejectionMessage) && (
          <p className="form-error mt-2">{errors.w9File || rejectionMessage}</p>
        )}
      </div>

      {/* Banking callout */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-5 flex gap-4">
        <div className="shrink-0 mt-0.5">
          <svg className="h-5 w-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-navy">Banking details are collected separately</p>
          <p className="text-sm text-gray-600 mt-1">
            Our finance team will contact you after submission to verify banking information
            over the phone and send a $1 test payment. You do not need to provide
            banking information on this form.
          </p>
        </div>
      </div>
    </div>
  );
}
