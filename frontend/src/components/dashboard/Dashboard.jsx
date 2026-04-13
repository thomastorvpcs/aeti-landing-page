import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

const STATUS_META = {
  "Initiated":           { label: "Initiated",           bg: "bg-gray-100",    text: "text-gray-600",   dot: "bg-gray-400" },
  "NDA Pending":         { label: "NDA Pending",         bg: "bg-amber-50",    text: "text-amber-700",  dot: "bg-amber-400" },
  "Awaiting Countersign":{ label: "Awaiting Countersign",bg: "bg-blue-50",     text: "text-blue-700",   dot: "bg-blue-500" },
  "NDA Complete":        { label: "NDA Complete",        bg: "bg-green-50",    text: "text-green-700",  dot: "bg-green-500" },
  "Cancelled":           { label: "Cancelled",           bg: "bg-red-50",      text: "text-red-600",    dot: "bg-red-400" },
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

function authHeaders() {
  const token = sessionStorage.getItem("dashboard_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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

function DetailModal({ reseller, onClose }) {
  const [files, setFiles] = useState(null);
  const [filesLoading, setFilesLoading] = useState(false);

  useEffect(() => {
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

  if (!reseller) return null;

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
          <div className="flex items-center justify-between">
            <StatusBadge status={reseller.status} />
            <span className="text-xs text-gray-400">Submitted {formatDate(reseller.created_at)}</span>
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

const STATUSES = ["All", "Initiated", "NDA Pending", "Awaiting Countersign", "NDA Complete", "Cancelled"];

export default function Dashboard() {
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_BASE_URL || ""}/api/dashboard/resellers`, {
        headers: authHeaders(),
      });
      setResellers(data);
    } catch (err) {
      if (err.response?.status === 401) {
        setError("unauthorized");
      } else {
        setError(err.message || "Failed to load data.");
      }
    } finally {
      setLoading(false);
    }
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
      sessionStorage.setItem("dashboard_token", data.token);
      load();
    } catch (err) {
      setLoginError(err.response?.data?.error || "Login failed. Check your credentials.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("dashboard_token");
    setResellers([]);
    setError("unauthorized");
  }

  const filtered = resellers.filter((r) => {
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.legal_company_name?.toLowerCase().includes(q) ||
      r.contact_email?.toLowerCase().includes(q) ||
      r.ein?.includes(q);
    return matchStatus && matchSearch;
  });

  const counts = {
    total: resellers.length,
    initiated: resellers.filter((r) => r.status === "Initiated").length,
    ndaPending: resellers.filter((r) => r.status === "NDA Pending").length,
    awaitingCountersign: resellers.filter((r) => r.status === "Awaiting Countersign").length,
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
            <button onClick={handleLogout} className="btn-secondary text-sm px-4 py-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mb-8">
          {[
            { label: "Total", value: counts.total, color: "text-brand-navy" },
            { label: "NDA Pending", value: counts.ndaPending, color: "text-amber-600" },
            { label: "Awaiting Countersign", value: counts.awaitingCountersign, color: "text-blue-600" },
            { label: "NDA Complete", value: counts.ndaComplete, color: "text-green-600" },
            { label: "Cancelled", value: counts.cancelled, color: "text-red-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-xs font-medium text-gray-500">{label}</p>
              <p className={`text-3xl font-extrabold mt-1 ${color}`}>{loading ? "—" : value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            placeholder="Search company, email or EIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === s
                    ? "bg-brand-blue text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-brand-blue"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
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
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Contact</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Reseller signed</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">PCS countersigned</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Submitted</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">NetSuite ID</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{r.legal_company_name}</p>
                        {r.dba && <p className="text-xs text-gray-400">DBA: {r.dba}</p>}
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <p className="text-gray-700">{r.contact_first_name} {r.contact_last_name}</p>
                        <p className="text-xs text-gray-400">{r.contact_email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-gray-500 text-xs">
                        {formatDate(r.reseller_signed_at)}
                        {formatTime(r.reseller_signed_at) && <p className="text-gray-400">{formatTime(r.reseller_signed_at)}</p>}
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-gray-500 text-xs">
                        {formatDate(r.signed_at)}
                        {formatTime(r.signed_at) && <p className="text-gray-400">{formatTime(r.signed_at)}</p>}
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell text-gray-500 text-xs">
                        {formatDate(r.created_at)}
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

        <p className="mt-4 text-xs text-gray-400 text-center">
          {!loading && `${filtered.length} of ${resellers.length} resellers`}
        </p>
      </div>

      <DetailModal reseller={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
