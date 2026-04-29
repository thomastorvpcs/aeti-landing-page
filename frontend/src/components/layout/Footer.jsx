import React from "react";

export default function Footer() {
  return (
    <footer className="bg-brand-navy text-blue-200">
      <div className="section-container py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue">
                <span className="text-sm font-bold text-white">PCS</span>
              </div>
              <span className="text-white font-bold">PCS</span>
            </div>
            <p className="text-sm text-blue-300 leading-relaxed">
              PCS empowers resellers with industry-leading technology and a
              partnership model built for long-term growth.
            </p>
          </div>

          {/* Program */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Apple Business Trade-In
            </h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#revenue" className="hover:text-white transition">Revenue opportunity</a></li>
              <li><a href="#partnership" className="hover:text-white transition">Partnership benefits</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition">How it works</a></li>
              <li><a href="#apply" className="hover:text-white transition">Apply now</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              Contact
            </h3>
            <p className="text-sm mb-2">Partner inquiries:</p>
            <a
              href="mailto:abtiquestions@pcsww.com"
              className="text-brand-blue hover:text-blue-400 font-medium transition"
            >
              abtiquestions@pcsww.com
            </a>
            <p className="text-xs text-blue-400 mt-6">
              &copy; {new Date().getFullYear()} PCS. All rights reserved.
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-blue-400">
          <span>pcsww.com/aeti</span>
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
}
