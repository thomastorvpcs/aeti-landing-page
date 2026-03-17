import React, { useState, useRef } from "react";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import Hero from "./components/landing/Hero";
import RevenueOpportunity from "./components/landing/RevenueOpportunity";
import PartnershipPillars from "./components/landing/PartnershipPillars";
import LeadershipQuote from "./components/landing/LeadershipQuote";
import HowItWorks from "./components/landing/HowItWorks";
import OnboardingForm from "./components/form/OnboardingForm";

export default function App() {
  const formRef = useRef(null);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar onApplyClick={scrollToForm} />
      <main>
        <Hero onApplyClick={scrollToForm} onLearnClick={scrollToForm} />
        <RevenueOpportunity />
        <PartnershipPillars />
        <LeadershipQuote />
        <HowItWorks />
        <section ref={formRef} id="apply" className="bg-brand-light py-20">
          <div className="section-container">
            <div className="mx-auto max-w-2xl text-center mb-12">
              <h2 className="text-3xl font-bold text-brand-navy sm:text-4xl">
                Apply for partnership
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Complete the form below to begin your onboarding. The process
                takes approximately 10 minutes.
              </p>
            </div>
            <OnboardingForm />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
