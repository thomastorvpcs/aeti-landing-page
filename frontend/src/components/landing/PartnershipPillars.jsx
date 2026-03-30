import React from "react";

const pillars = [
  {
    number: "01",
    title: "Dedicated support",
    description:
      "Every Apple Business Trade-In partner is assigned a named Partner Success Manager who owns your relationship. One call, one person, no ticket queue.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Training & enablement",
    description:
      "Onboarding bootcamp, self-paced certifications, and live product training keep your team sharp and your close rates high.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Co-marketing",
    description:
      "Gold and Platinum partners receive co-marketing funds, branded collateral, and joint demand-gen programs to accelerate pipeline.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Protected territories",
    description:
      "Qualified partners receive geographic or vertical account protection. PCS will not compete direct in your registered territory.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    number: "05",
    title: "Early product access",
    description:
      "Apple Business Trade-In partners join our beta program and shape roadmap decisions — you sell what's coming before your competitors know it exists.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    number: "06",
    title: "Executive relationship",
    description:
      "Platinum partners have direct access to PCS leadership for strategic alignment, escalation, and executive sponsorship of key deals.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function PartnershipPillars() {
  return (
    <section id="partnership" className="py-24 bg-gray-50">
      <div className="section-container">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-blue">
            Long-term partnership
          </span>
          <h2 className="mt-3 text-3xl font-bold text-brand-navy sm:text-4xl">
            Six commitments we make to every partner
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            We don't just offer a product to resell. We invest in your growth,
            protect your accounts, and stand behind your success long-term.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <div
              key={pillar.number}
              className="group rounded-2xl bg-white border border-gray-200 p-8 hover:border-brand-blue hover:shadow-lg hover:shadow-brand-blue/10 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
                  {pillar.icon}
                </div>
                <span className="text-3xl font-extrabold text-gray-100 group-hover:text-brand-blue/10 transition-colors">
                  {pillar.number}
                </span>
              </div>
              <h3 className="text-base font-bold text-brand-navy mb-2">{pillar.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{pillar.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
