import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

const STATUS_META = {
  "Initiated":              { label: "Initiated",              bg: "bg-gray-100",    text: "text-gray-600",    dot: "bg-gray-400" },
  "NDA Approval Pending":   { label: "NDA Approval Pending",   bg: "bg-violet-50",   text: "text-violet-700",  dot: "bg-violet-500" },
  "NDA Pending":            { label: "NDA Pending",            bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-400" },
  "Awaiting Countersign":   { label: "Awaiting Countersign",   bg: "bg-blue-50",     text: "text-blue-700",    dot: "bg-blue-500" },
  "NDA Processing":         { label: "NDA Processing",         bg: "bg-teal-50",     text: "text-teal-700",    dot: "bg-teal-500" },
  "NDA Complete":           { label: "NDA Complete",           bg: "bg-green-50",    text: "text-green-700",   dot: "bg-green-500" },
  "Cancelled":              { label: "Cancelled",              bg: "bg-red-50",      text: "text-red-600",     dot: "bg-red-400" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.bg} ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

// Token is held in module memory — not in Web Storage — so it cannot be
// read by XSS-injected scripts via window/document. The tradeoff is that
// it is lost on page refresh, requiring re-login.
let _token = null;

function authHeaders() {
  return _token ? { Authorization: `Bearer ${_token}` } : {};
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DetailModal({ reseller, onClose, onDelete }) {
  const [files, setFiles] = useState(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState(null); // "ok" | "error"
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState(null); // "ok" | "error"
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approveResult, setApproveResult] = useState(null); // "ok" | "error"
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState(null); // "ok" | "error"

  useEffect(() => {
    // Reset all action state when switching to a different reseller
    setResending(false);
    setResendResult(null);
    setCancelling(false);
    setCancelResult(null);
    setDeleting(false);
    setDeleteError(null);
    setApproving(false);
    setApproveResult(null);
    setRetrying(false);
    setRetryResult(null);

    if (!reseller) return;
    setFiles(null);
    setFilesLoading(true);
    axios.get(`${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/resellers/${reseller.id}/files`, {
      headers: authHeaders(),
    })
      .then(({ data }) => setFiles(data))
      .catch(() => setFiles({}))
      .finally(() => setFilesLoading(false));
  }, [reseller?.id]);

  async function handleResend() {
    setResending(true);
    setResendResult(null);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/resellers/${reseller.id}/resend-nda`,
        {},
        { headers: authHeaders() }
      );
      setResendResult("ok");
    } catch {
      setResendResult("error");
    } finally {
      setResending(false);
    }
  }

  if (!reseller) return null;

  async function handleCancel() {
    if (!window.confirm("Cancel this NDA signing? This will void the agreement in Acrobat Sign and cannot be undone.")) return;
    setCancelling(true);
    setCancelResult(null);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/resellers/${reseller.id}/cancel-nda`,
        {},
        { headers: authHeaders() }
      );
      setCancelResult("ok");
    } catch {
      setCancelResult("error");
    } finally {
      setCancelling(false);
    }
  }

  async function handleRetryCompletion() {
    if (!window.confirm("Re-queue the NDA completion job? This will re-download the signed NDA and resend the welcome email.")) return;
    setRetrying(true);
    setRetryResult(null);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/resellers/${reseller.id}/retry-completion`,
        {},
        { headers: authHeaders() }
      );
      setRetryResult("ok");
    } catch {
      setRetryResult("error");
    } finally {
      setRetrying(false);
    }
  }

  async function handleApproveAndSend() {
    if (!window.confirm(`Send NDA to ${reseller.nda_signer_email || reseller.contact_email}? This will create a billable Acrobat Sign envelope.`)) return;
    setApproving(true);
    setApproveResult(null);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/resellers/${reseller.id}/send-nda`,
        {},
        { headers: authHeaders() }
      );
      setApproveResult("ok");
    } catch {
      setApproveResult("error");
    } finally {
      setApproving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Permanently delete this reseller and all their files? This cannot be undone.")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/resellers/${reseller.id}`,
        { headers: authHeaders() }
      );
      onDelete();
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Delete failed — try again.");
      setDeleting(false);
    }
  }

  const canResend = reseller.status === "NDA Pending" || reseller.status === "Awaiting Countersign";
  const resendLabel = reseller.status === "NDA Pending" ? "Resend to reseller" : "Resend to legal";
  const canCancel = reseller.status === "NDA Pending" || reseller.status === "Awaiting Countersign";

  function row(label, value) {
    return (
      <div className="flex gap-4 py-2.5 border-b border-gray-100 last:border-0">
        <dt className="w-44 shrink-0 text-xs font-medium text-gray-500">{label}</dt>
        <dd className="text-xs text-gray-900 break-all">{value || "—"}</dd>
      </div>
    );
  }

  const ndaSignerDifferent = reseller.nda_signer_email && reseller.nda_signer_email !== reseller.contact_email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-brand-navy px-6 py-5 rounded-t-2xl flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-1">Reseller detail</p>
            <h2 className="text-lg font-bold text-white">{reseller.legal_company_name}</h2>
            {reseller.dba && <p className="text-sm text-blue-300 mt-0.5">DBA: {reseller.dba}</p>}
          </div>
          <button onClick={onClose} className="text-blue-300 hover:text-white mt-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Status */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <StatusBadge status={reseller.status} />
            <div className="flex items-center gap-3">
              {reseller.status === "NDA Approval Pending" && (
                <button
                  onClick={handleApproveAndSend}
                  disabled={approving || approveResult === "ok"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-500 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
                >
                  {approving ? "Sending…" : "Approve & Send NDA"}
                </button>
              )}
              {approveResult === "ok" && <span className="text-xs text-green-600 font-medium">NDA sent to reseller</span>}
              {approveResult === "error" && <span className="text-xs text-red-500 font-medium">Failed — try again</span>}
              {canResend && (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue px-3 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-blue/5 transition-colors disabled:opacity-50"
                >
                  {resending ? "Sending…" : resendLabel}
                </button>
              )}
              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling || cancelResult === "ok"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {cancelling ? "Cancelling…" : "Cancel signing"}
                </button>
              )}
              {resendResult === "ok" && <span className="text-xs text-green-600 font-medium">Reminder sent</span>}
              {resendResult === "error" && <span className="text-xs text-red-500 font-medium">Failed — try again</span>}
              {cancelResult === "ok" && <span className="text-xs text-red-600 font-medium">Agreement cancelled</span>}
              {cancelResult === "error" && <span className="text-xs text-red-500 font-medium">Cancel failed — try again</span>}
              {(reseller.status === "NDA Processing" || (reseller.status === "NDA Complete" && files && !files.signedNda)) && (
                <button
                  onClick={handleRetryCompletion}
                  disabled={retrying || retryResult === "ok"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  {retrying ? "Queuing…" : "Retry welcome email"}
                </button>
              )}
              {retryResult === "ok" && <span className="text-xs text-green-600 font-medium">Queued — email will arrive shortly</span>}
              {retryResult === "error" && <span className="text-xs text-red-500 font-medium">Failed — try again</span>}
              {(reseller.status === "Cancelled" || reseller.status === "Initiated" || reseller.status === "NDA Approval Pending") && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-400 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete record"}
                </button>
              )}
              {deleteError && <span className="text-xs text-red-500 font-medium">{deleteError}</span>}
              <span className="text-xs text-gray-400">Submitted {formatDate(reseller.created_at)}</span>
            </div>
          </div>

          {/* Company */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Company</h3>
            <dl>
              {row("Legal name", reseller.legal_company_name)}
              {row("EIN", reseller.ein)}
              {row("Entity type", reseller.entity_type)}
              {row("Location", [reseller.address_city, reseller.address_state].filter(Boolean).join(", "))}
            </dl>
          </section>

          {/* Commercial contact */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Commercial contact</h3>
            <dl>
              {row("Name", `${reseller.contact_first_name} ${reseller.contact_last_name}`)}
              {row("Email", reseller.contact_email)}
              {row("Phone", reseller.contact_phone)}
            </dl>
          </section>

          {/* NDA signatory — only if different */}
          {ndaSignerDifferent && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">NDA signatory</h3>
              <dl>
                {row("Name", `${reseller.nda_signer_first_name} ${reseller.nda_signer_last_name}`)}
                {row("Email", reseller.nda_signer_email)}
              </dl>
            </section>
          )}

          {/* Integrations */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Integrations</h3>
            <dl>
              {row("NetSuite vendor ID", reseller.netsuite_vendor_id)}
              {row("Acrobat Sign envelope", reseller.docusign_envelope_id)}
              {row("Reseller signed", formatDateTime(reseller.reseller_signed_at))}
              {row("PCS countersigned", formatDateTime(reseller.signed_at))}
            </dl>
          </section>

          {/* Timestamps */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Timestamps</h3>
            <dl>
              {row("Created", formatDateTime(reseller.created_at))}
              {row("Last updated", formatDateTime(reseller.updated_at))}
            </dl>
          </section>

          {/* Documents */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Documents</h3>
            {filesLoading ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "W-9", url: files?.w9 },
                  { label: "Bank letter", url: files?.bankLetter },
                  { label: "Vendor setup form", url: files?.vendorForm },
                  { label: "Signed NDA", url: files?.signedNda },
                ].map(({ label, url }) =>
                  url ? (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-brand-light hover:border-brand-blue hover:text-brand-blue transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {label}
                    </a>
                  ) : (
                    <span key={label} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-300">
                      {label}
                    </span>
                  )
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}


function ChangePasswordModal({ onClose }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const rules = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "At least one number", met: /[0-9]/.test(newPassword) },
    { label: "At least one special character", met: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const passwordValid = rules.every((r) => r.met);
  const passwordsMatch = confirm.length > 0 && newPassword === confirm;
  const mismatch = confirm.length > 0 && newPassword !== confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!passwordValid || !passwordsMatch) return;
    setLoading(true);
    setError(null);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/auth/change-password`,
        { newPassword },
        { headers: authHeaders() }
      );
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-brand-navy mb-4">Change password</h2>
        {success ? (
          <div className="text-center py-4">
            <p className="text-sm text-green-600 font-medium mb-4">Password updated successfully.</p>
            <button onClick={onClose} className="btn-primary w-full">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="form-input"
                required
                autoFocus
              />
              {newPassword.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {rules.map((r) => (
                    <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.met ? "text-green-600" : "text-red-500"}`}>
                      <span>{r.met ? "✓" : "✗"}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                className="form-input"
                required
              />
              {mismatch && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1.5"><span>✗</span> Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1.5"><span>✓</span> Passwords match</p>
              )}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={loading || !passwordValid || !passwordsMatch} className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Saving…" : "Save password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/audit-log`, {
      headers: authHeaders(),
    })
      .then(({ data }) => setLogs(data))
      .catch(() => setError("Failed to load audit log."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    return !q ||
      l.action?.toLowerCase().includes(q) ||
      l.reseller_name?.toLowerCase().includes(q) ||
      l.performed_by?.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search action, reseller or user…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input max-w-xs"
        />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading…
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">No audit log entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Reseller</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Performed by</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(l.created_at)}
                    </td>
                    <td className="px-5 py-3 text-xs font-medium text-gray-800">{l.action}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 hidden sm:table-cell">{l.reseller_name || "—"}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 hidden md:table-cell">{l.performed_by}</td>
                    <td className="px-5 py-3 text-xs text-gray-400 hidden lg:table-cell">{l.details || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400">Showing last 500 entries.</p>
    </div>
  );
}

export default function Dashboard() {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("unauthorized");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState("resellers");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async () => {
    if (!_token) {
      setError("unauthorized");
      return;
    }
    setLoading(true);
    setError(null);
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
      try {
        const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/resellers`, {
          headers: authHeaders(),
        });
        setResellers(data);
        setLoading(false);
        return;
      } catch (err) {
        if (err.response?.status === 401) {
          _token = null;
          setError("unauthorized");
          setLoading(false);
          return;
        }
        lastErr = err;
      }
    }
    setError(lastErr?.message || "Failed to load data.");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/auth/login`, {
        email: loginEmail,
        password: loginPassword,
      });
      _token = data.token;
      setError(null);
      load();
    } catch (err) {
      setLoginError(err.response?.data?.error || "Login failed. Check your credentials.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    _token = null;
    setResellers([]);
    setError("unauthorized");
  }

  const filtered = resellers.filter((r) => {
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.legal_company_name?.toLowerCase().includes(q) ||
      r.contact_email?.toLowerCase().includes(q) ||
      r.ein?.replace(/-/g, "").includes(q.replace(/-/g, ""));
    return matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const counts = {
    total: resellers.length,
    initiated: resellers.filter((r) => r.status === "Initiated").length,
    approvalPending: resellers.filter((r) => r.status === "NDA Approval Pending").length,
    ndaPending: resellers.filter((r) => r.status === "NDA Pending").length,
    awaitingCountersign: resellers.filter((r) => r.status === "Awaiting Countersign").length,
    ndaProcessing: resellers.filter((r) => r.status === "NDA Processing").length,
    ndaComplete: resellers.filter((r) => r.status === "NDA Complete").length,
    cancelled: resellers.filter((r) => r.status === "Cancelled").length,
  };

  if (error === "unauthorized") {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-sm text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light mx-auto mb-4">
            <svg className="w-7 h-7 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-brand-navy mb-1">Dashboard access</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in with your PCS credentials.</p>
          <form onSubmit={handleLogin} className="space-y-3 text-left">
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Email address"
              className="form-input"
              autoFocus
              required
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              className="form-input"
              required
            />
            {loginError && <p className="text-sm text-red-500 text-center">{loginError}</p>}
            <button type="submit" disabled={loginLoading} className="btn-primary w-full">
              {loginLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-light py-12">
      <div className="section-container">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-1">PCS Wireless</p>
            <h1 className="text-2xl font-bold text-brand-navy">Apple Business Trade-In — Reseller Pipeline</h1>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <button onClick={load} className="btn-secondary text-sm px-4 py-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button onClick={() => setShowChangePassword(true)} className="btn-secondary text-sm px-4 py-2">
              Change password
            </button>
            <button onClick={handleLogout} className="btn-secondary text-sm px-4 py-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mb-6 flex gap-1 border-b border-gray-200">
          {[
            { id: "resellers", label: "Resellers" },
            { id: "audit-log", label: "Audit log" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "audit-log" && <AuditLogTab />}

        {/* Resellers tab content */}
        {activeTab === "resellers" && <>

        {/* Stat cards — click to filter */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7 mb-6">
          {[
            { label: "Total", filter: "All", value: counts.total, color: "text-brand-navy", ring: "ring-brand-navy" },
            { label: "Approval Pending", filter: "NDA Approval Pending", value: counts.approvalPending, color: "text-violet-600", ring: "ring-violet-400" },
            { label: "NDA Pending", filter: "NDA Pending", value: counts.ndaPending, color: "text-amber-600", ring: "ring-amber-400" },
            { label: "Awaiting Countersign", filter: "Awaiting Countersign", value: counts.awaitingCountersign, color: "text-blue-600", ring: "ring-blue-400" },
            { label: "NDA Processing", filter: "NDA Processing", value: counts.ndaProcessing, color: "text-teal-600", ring: "ring-teal-400" },
            { label: "NDA Complete", filter: "NDA Complete", value: counts.ndaComplete, color: "text-green-600", ring: "ring-green-400" },
            { label: "Cancelled", filter: "Cancelled", value: counts.cancelled, color: "text-red-500", ring: "ring-red-400" },
          ].map(({ label, filter, value, color, ring }) => {
            const active = statusFilter === filter;
            return (
              <button
                key={label}
                onClick={() => { setStatusFilter(active ? "All" : filter); setPage(1); }}
                className={`text-left bg-white rounded-2xl border shadow-sm px-5 py-4 transition-all ${
                  active
                    ? `border-transparent ring-2 ${ring} shadow-md`
                    : "border-gray-100 hover:border-gray-200 hover:shadow-md"
                }`}
              >
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className={`text-3xl font-extrabold mt-1 ${color}`}>{loading ? "—" : value}</p>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Search company, email or EIN…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="form-input max-w-xs"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <svg className="animate-spin h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          ) : error ? (
            <div className="text-center py-20 text-red-500 text-sm">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">No resellers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">EIN</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Submitted</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Reseller signed</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">PCS countersigned</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">NetSuite ID</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{r.legal_company_name}</p>
                        {r.dba && <p className="text-xs text-gray-400">DBA: {r.dba}</p>}
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell text-gray-500 text-xs font-mono">
                        {r.ein || "—"}
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <p className="text-gray-700">{r.contact_first_name} {r.contact_last_name}</p>
                        <p className="text-xs text-gray-400">{r.contact_email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-gray-500 text-xs">
                        {formatDate(r.created_at)}
                        {formatTime(r.created_at) && <p className="text-gray-400">{formatTime(r.created_at)}</p>}
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-gray-500 text-xs">
                        {formatDate(r.reseller_signed_at)}
                        {formatTime(r.reseller_signed_at) && <p className="text-gray-400">{formatTime(r.reseller_signed_at)}</p>}
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-gray-500 text-xs">
                        {formatDate(r.signed_at)}
                        {formatTime(r.signed_at) && <p className="text-gray-400">{formatTime(r.signed_at)}</p>}
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell text-gray-500 text-xs font-mono">
                        {r.netsuite_vendor_id || "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setSelected(r)}
                          className="text-brand-blue text-xs font-semibold hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              {filtered.length === 0 ? "No resellers" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length} resellers`}
              {filtered.length !== resellers.length && ` (filtered from ${resellers.length})`}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-400">Per page</label>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
                >
                  {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="text-xs text-gray-500 px-2">
                  {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        </>}
      </div>

      <DetailModal
        reseller={selected}
        onClose={() => setSelected(null)}
        onDelete={() => { setSelected(null); load(); }}
      />
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
