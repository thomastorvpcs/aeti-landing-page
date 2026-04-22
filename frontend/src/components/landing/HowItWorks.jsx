import React from "react";

const steps = [
  {
    step: 1,
    title: "Complete the application",
    description:
      "Fill out the 4-step online form with your company details, contact information, and W-9. Takes about 10 minutes.",
    duration: "~10 min",
  },
  {
    step: 2,
    title: "Sign the NDA",
    description:
      "Within 1 business day you'll receive the mutual NDA by email for electronic signature. PCS Legal countersigns promptly.",
    duration: "1 business day",
  },
  {
    step: 3,
    title: "Finance & banking setup",
    description:
      "Our finance team reaches out to verify banking details and send a $1 test payment to confirm the channel.",
    duration: "1–2 business days",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="section-container">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-blue">
            Process
          </span>
          <h2 className="mt-3 text-3xl font-bold text-brand-navy sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            From application to active partner in as few as 3 business days.
            Everything happens online — no paper forms or email chains.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-10 left-[16.5%] right-[16.5%] h-0.5 bg-gray-200" />

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            {steps.map((item, idx) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                {/* Step circle */}
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-brand-blue shadow-lg shadow-brand-blue/30">
                  <span className="text-2xl font-extrabold text-white">{item.step}</span>
                </div>

                {/* Mobile connector */}
                {idx < steps.length - 1 && (
                  <div className="lg:hidden h-8 w-0.5 bg-gray-200 my-2" />
                )}

                <div className="mt-6">
                  <span className="inline-block rounded-full bg-green-50 border border-green-200 px-3 py-0.5 text-xs font-medium text-green-700 mb-3">
                    {item.duration}
                  </span>
                  <h3 className="text-base font-bold text-brand-navy">{item.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA hint */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            Questions before you apply?{" "}
            <a
              href="mailto:resellers@pcsww.com"
              className="text-brand-blue font-medium hover:underline"
            >
              Email resellers@pcsww.com
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
