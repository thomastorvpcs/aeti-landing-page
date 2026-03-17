import React from "react";

const tiers = [
  {
    name: "Silver",
    range: "$0 – $249K ARR",
    margin: "18%",
    perks: ["Dedicated account manager", "Standard SLA", "Partner portal access"],
    highlight: false,
  },
  {
    name: "Gold",
    range: "$250K – $999K ARR",
    margin: "24%",
    perks: ["Priority support queue", "Co-marketing budget", "Quarterly business reviews"],
    highlight: true,
  },
  {
    name: "Platinum",
    range: "$1M+ ARR",
    margin: "30%",
    perks: ["Executive sponsor", "Protected territory", "Early product access", "Custom SLA"],
    highlight: false,
  },
];

export default function RevenueOpportunity() {
  return (
    <section id="revenue" className="py-24 bg-white">
      <div className="section-container">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-blue">
            Revenue opportunity
          </span>
          <h2 className="mt-3 text-3xl font-bold text-brand-navy sm:text-4xl">
            A margin structure that rewards growth
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Our performance-tiered model means your margin grows as your book of
            business grows — with fully recurring revenue on every renewal.
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                tier.highlight
                  ? "border-brand-blue bg-brand-navy text-white shadow-2xl shadow-brand-blue/20"
                  : "border-gray-200 bg-white text-gray-900"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-brand-blue px-4 py-1 text-xs font-bold uppercase tracking-widest text-white shadow">
                    Most popular
                  </span>
                </div>
              )}

              <div>
                <h3
                  className={`text-lg font-bold ${
                    tier.highlight ? "text-white" : "text-brand-navy"
                  }`}
                >
                  {tier.name}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    tier.highlight ? "text-blue-300" : "text-gray-500"
                  }`}
                >
                  {tier.range}
                </p>
                <div className="mt-6 flex items-end gap-1">
                  <span
                    className={`text-5xl font-extrabold ${
                      tier.highlight ? "text-white" : "text-brand-navy"
                    }`}
                  >
                    {tier.margin}
                  </span>
                  <span
                    className={`mb-2 text-sm ${
                      tier.highlight ? "text-blue-300" : "text-gray-500"
                    }`}
                  >
                    margin
                  </span>
                </div>
                <p
                  className={`mt-1 text-xs ${
                    tier.highlight ? "text-blue-300" : "text-gray-400"
                  }`}
                >
                  On all recurring revenue
                </p>
              </div>

              <ul className="mt-8 space-y-3 flex-1">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2.5 text-sm">
                    <svg
                      className={`h-4 w-4 shrink-0 ${
                        tier.highlight ? "text-brand-blue" : "text-green-500"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className={tier.highlight ? "text-blue-100" : "text-gray-700"}>
                      {perk}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Recurring revenue callout */}
        <div className="mt-14 rounded-2xl bg-brand-light border border-brand-blue/20 p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { icon: "🔄", title: "Recurring revenue", desc: "Every renewal renews your margin. No one-time commissions — a compounding book of business." },
              { icon: "📈", title: "Tier advancement", desc: "Tiers are reviewed annually. Hit your ARR target and your margin rate upgrades automatically." },
              { icon: "🛡️", title: "Protected accounts", desc: "Gold and Platinum partners have registered account protection — PCS will not undercut you direct." },
            ].map(({ icon, title, desc }) => (
              <div key={title}>
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-semibold text-brand-navy">{title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
