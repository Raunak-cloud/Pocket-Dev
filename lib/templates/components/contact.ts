import type { WebsiteConfig, ContactSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc } from "../utils/helpers";

export function renderContact(section: ContactSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "form-only":       return renderFormOnly(section, config);
    case "split-with-info": return renderSplitWithInfo(section, config);
    case "minimal":         return renderMinimal(section, config);
  }
}

// ── Shared: input class builder ──────────────────────────────────

function inputClass(p: string, isDark: boolean, borderLight: string): string {
  return `w-full px-4 py-3 rounded-xl border ${borderLight} ${isDark ? "bg-gray-800/80 text-white placeholder-gray-500" : "bg-white text-gray-900 placeholder-gray-400"} focus:ring-2 focus:ring-${p}-500/20 focus:border-${p}-500 outline-none transition-all duration-200`;
}

function submitBtnClass(p: string): string {
  return `w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-${p}-600 to-${p}-700 hover:from-${p}-700 hover:to-${p}-800 rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200`;
}

// ── "form-only" variant ──────────────────────────────────────────
// Decorative gradient orb in background, rounded-2xl card wrapping
// the form with shadow, scroll-reveal

function renderFormOnly(section: ContactSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const inp = inputClass(p, isDark, t.borderLight);

  return `"use client";

import { useState } from "react";
import { useInView } from "react-intersection-observer";
import { Mail, Send } from "lucide-react";

export default function Contact() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="relative py-24 ${t.bgSection} overflow-hidden">
      {/* Decorative gradient orb */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-${p}-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-${s}-400/15 rounded-full blur-3xl pointer-events-none" />

      <div
        ref={ref}
        className={\`max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
      >
${section.title ? `        <div className="text-center mb-12">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="${isDark ? "bg-gray-900/80 border border-gray-800" : "bg-white border border-gray-100"} rounded-2xl shadow-xl p-8 sm:p-10 relative overflow-hidden">
          {/* Card accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-${p}-500 to-${s}-500" />

          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium ${t.textHeading} mb-2">Name</label>
                <input type="text" className="${inp}" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm font-medium ${t.textHeading} mb-2">Email</label>
                <input type="email" className="${inp}" placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium ${t.textHeading} mb-2">Subject</label>
              <input type="text" className="${inp}" placeholder="How can we help?" />
            </div>
            <div>
              <label className="block text-sm font-medium ${t.textHeading} mb-2">Message</label>
              <textarea rows={5} className="${inp} resize-none" placeholder="Tell us more..." />
            </div>
            <button type="submit" className="${submitBtnClass(p)}">
              <Send className="w-4 h-4" />
              {submitted ? "Message Sent!" : "Send Message"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "split-with-info" variant ────────────────────────────────────
// Info items with gradient icon backgrounds, decorative map-like
// gradient area, better spacing, scroll-reveal

function renderSplitWithInfo(section: ContactSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const biz = config.business;
  const inp = inputClass(p, isDark, t.borderLight);

  const infoItems: string[] = [];
  if (biz.phone) infoItems.push(`            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-${p}-500 to-${p}-600 flex items-center justify-center shadow-lg shadow-${p}-500/20 group-hover:shadow-${p}-500/40 transition-shadow">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold ${t.textHeading}">Phone</p>
                <p className="text-sm ${t.textBody} mt-0.5">${esc(biz.phone)}</p>
              </div>
            </div>`);
  if (biz.email) infoItems.push(`            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-${p}-500 to-${p}-600 flex items-center justify-center shadow-lg shadow-${p}-500/20 group-hover:shadow-${p}-500/40 transition-shadow">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold ${t.textHeading}">Email</p>
                <p className="text-sm ${t.textBody} mt-0.5">${esc(biz.email)}</p>
              </div>
            </div>`);
  if (biz.address) infoItems.push(`            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-${p}-500 to-${p}-600 flex items-center justify-center shadow-lg shadow-${p}-500/20 group-hover:shadow-${p}-500/40 transition-shadow">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold ${t.textHeading}">Address</p>
                <p className="text-sm ${t.textBody} mt-0.5">${esc(biz.address)}</p>
              </div>
            </div>`);
  if (biz.hours) infoItems.push(`            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-${p}-500 to-${p}-600 flex items-center justify-center shadow-lg shadow-${p}-500/20 group-hover:shadow-${p}-500/40 transition-shadow">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold ${t.textHeading}">Hours</p>
                <p className="text-sm ${t.textBody} mt-0.5">${esc(biz.hours)}</p>
              </div>
            </div>`);

  return `"use client";

import { useState } from "react";
import { useInView } from "react-intersection-observer";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";

export default function Contact() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="py-24 ${t.bgSectionAlt}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div
          ref={ref}
          className={\`grid md:grid-cols-2 gap-16 transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
        >
          {/* Info side */}
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold ${t.textHeading} mb-3">Get in Touch</h3>
              <p className="${t.textBody} leading-relaxed">${esc(biz.description.substring(0, 200))}</p>
            </div>

            <div className="space-y-5 pt-2">
${infoItems.join("\n")}
            </div>

            {/* Decorative map-like gradient area */}
            <div className="mt-8 rounded-2xl overflow-hidden h-40 bg-gradient-to-br from-${p}-100 via-${p}-50 to-${s}-100 ${isDark ? "opacity-20" : "opacity-60"} relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-${p}-400" />
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,transparent_30%,rgba(0,0,0,0.05)_100%)]" />
            </div>
          </div>

          {/* Form side */}
          <div className="${isDark ? "bg-gray-900/80 border border-gray-800" : "bg-white border border-gray-100"} rounded-2xl shadow-xl p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-${p}-500 to-${s}-500" />
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}>
              <div>
                <label className="block text-sm font-medium ${t.textHeading} mb-2">Name</label>
                <input type="text" className="${inp}" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm font-medium ${t.textHeading} mb-2">Email</label>
                <input type="email" className="${inp}" placeholder="Your email" />
              </div>
              <div>
                <label className="block text-sm font-medium ${t.textHeading} mb-2">Message</label>
                <textarea rows={5} className="${inp} resize-none" placeholder="Your message" />
              </div>
              <button type="submit" className="${submitBtnClass(p)}">
                <Send className="w-4 h-4" />
                {submitted ? "Message Sent!" : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "minimal" variant ────────────────────────────────────────────
// Inline email + button with glass effect background container,
// scroll-reveal

function renderMinimal(section: ContactSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  return `"use client";

import { useState } from "react";
import { useInView } from "react-intersection-observer";
import { Send, ArrowRight } from "lucide-react";

export default function Contact() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="relative py-24 ${t.bgSection} overflow-hidden">
      {/* Background orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-${p}-400/10 rounded-full blur-3xl pointer-events-none" />

      <div
        ref={ref}
        className={\`max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
      >
${section.title ? `        <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `        <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}` : ""}
        {/* Glass effect container */}
        <div className="mt-10 ${isDark ? "bg-gray-900/60 border-gray-700/50" : "bg-white/60 border-gray-200/50"} backdrop-blur-xl border rounded-2xl p-8 shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-${p}-500/5 to-${s}-500/5 pointer-events-none" />
          <div className="relative">
            <p className="text-sm ${t.textMuted} mb-5">Enter your email and we&apos;ll get back to you within 24 hours.</p>
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}>
              <input
                type="email"
                className="flex-1 px-5 py-3 rounded-xl border ${isDark ? "border-gray-700 bg-gray-800/80 text-white placeholder-gray-500" : "border-gray-200 bg-white text-gray-900 placeholder-gray-400"} focus:ring-2 focus:ring-${p}-500/20 focus:border-${p}-500 outline-none transition-all duration-200"
                placeholder="Enter your email"
              />
              <button type="submit" className="flex items-center justify-center gap-2 px-7 py-3 text-sm font-semibold text-white bg-gradient-to-r from-${p}-600 to-${p}-700 hover:from-${p}-700 hover:to-${p}-800 rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 whitespace-nowrap">
                {submitted ? (
                  <><Send className="w-4 h-4" /> Sent!</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> Get in Touch</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}
