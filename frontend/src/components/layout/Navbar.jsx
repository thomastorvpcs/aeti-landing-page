import React, { useState, useEffect } from "react";

export default function Navbar({ onApplyClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? "bg-white shadow-md" : "bg-transparent"
      }`}
    >
      <div className="section-container">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue">
              <span className="text-sm font-bold text-white">PCS</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span
                className={`text-sm font-bold tracking-tight ${
                  scrolled ? "text-brand-navy" : "text-white"
                }`}
              >
                PCS
              </span>
              <span
                className={`text-xs ${
                  scrolled ? "text-gray-500" : "text-blue-200"
                }`}
              >
                AETI Program
              </span>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              ["Revenue", "#revenue"],
              ["Partnership", "#partnership"],
              ["How It Works", "#how-it-works"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className={`text-sm font-medium transition hover:opacity-80 ${
                  scrolled ? "text-gray-700" : "text-blue-100"
                }`}
              >
                {label}
              </a>
            ))}
            <button
              onClick={onApplyClick}
              className="btn-primary text-sm px-5 py-2.5"
            >
              Apply now
            </button>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span
              className={`block w-6 h-0.5 mb-1.5 transition-all ${
                scrolled ? "bg-gray-700" : "bg-white"
              } ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
            />
            <span
              className={`block w-6 h-0.5 mb-1.5 transition-all ${
                scrolled ? "bg-gray-700" : "bg-white"
              } ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block w-6 h-0.5 transition-all ${
                scrolled ? "bg-gray-700" : "bg-white"
              } ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="section-container py-4 flex flex-col gap-3">
            <a href="#revenue" className="text-sm font-medium text-gray-700 py-2">Revenue</a>
            <a href="#partnership" className="text-sm font-medium text-gray-700 py-2">Partnership</a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-700 py-2">How It Works</a>
            <button onClick={() => { setMenuOpen(false); onApplyClick(); }} className="btn-primary">
              Apply now
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
