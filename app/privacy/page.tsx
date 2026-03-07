import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Danphe",
  description: "Danphe Privacy Policy — how we collect, use, and protect your data.",
};

const EFFECTIVE_DATE = "March 7, 2026";
const CONTACT_EMAIL = "raunak.vision@gmail.com";
const APP_NAME = "Danphe";
const APP_URL = "https://danphe.io";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Header */}
      <header className="border-b border-border-primary/40 bg-bg-secondary/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="text-sm font-medium">Back to {APP_NAME}</span>
          </Link>
          <span className="text-xs text-text-muted">Effective {EFFECTIVE_DATE}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
            Legal
          </div>
          <h1 className="text-4xl font-bold text-text-primary mb-4">Privacy Policy</h1>
          <p className="text-text-tertiary leading-relaxed max-w-2xl">
            This Privacy Policy explains how {APP_NAME} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and protects your personal information when you use our AI-powered application generator at{" "}
            <a href={APP_URL} className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2">{APP_URL}</a>.
          </p>
        </div>

        <div className="space-y-10">
          <Section number="1" title="Information We Collect">
            <SubSection title="Account Information">
              When you create an account, we collect your email address, display name, and profile picture (if provided via Google OAuth). This information is used to identify you and provide access to your projects.
            </SubSection>
            <SubSection title="Usage Data">
              We collect information about how you interact with our platform, including prompts you submit, projects you generate, edits you make, and features you use. This data helps us improve our service and your experience.
            </SubSection>
            <SubSection title="Payment Information">
              Payment transactions are processed by Stripe. We do not store your full card number or CVV. We retain a record of your transaction history (amount, date, token balance) for account management purposes.
            </SubSection>
            <SubSection title="Technical Data">
              We automatically collect standard log data including your IP address, browser type, device type, operating system, and referring URLs. We also use cookies and similar technologies to maintain your session and preferences.
            </SubSection>
          </Section>

          <Section number="2" title="How We Use Your Information">
            <ul className="space-y-3 text-text-tertiary leading-relaxed list-none">
              {[
                "Provide, operate, and maintain the Danphe platform",
                "Process your AI generation and edit requests",
                "Manage your account, token balance, and subscription",
                "Send transactional emails (account confirmation, password reset, receipts)",
                "Respond to support requests and inquiries",
                "Detect and prevent fraud, abuse, and security incidents",
                "Analyze usage patterns to improve our product and AI outputs",
                "Comply with applicable legal obligations",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section number="3" title="Sharing of Information">
            <p className="text-text-tertiary leading-relaxed mb-4">
              We do not sell, rent, or trade your personal information. We may share your data only in the following limited circumstances:
            </p>
            <ul className="space-y-4 text-text-tertiary leading-relaxed">
              {[
                {
                  heading: "Service Providers",
                  body: "We share data with third-party providers who help us operate the platform, including Google (AI generation via Gemini), Supabase (authentication and database), Stripe (payments), Firebase (project storage), Inngest (background jobs), and Vercel (hosting). These providers are bound by data processing agreements.",
                },
                {
                  heading: "Legal Requirements",
                  body: "We may disclose your information if required by law, court order, or government authority, or if we believe in good faith that disclosure is necessary to protect our rights, your safety, or the safety of others.",
                },
                {
                  heading: "Business Transfers",
                  body: "In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you before your data becomes subject to a materially different privacy policy.",
                },
              ].map((item) => (
                <li key={item.heading} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                  <span>
                    <strong className="text-text-secondary">{item.heading}: </strong>
                    {item.body}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section number="4" title="Data Storage and Security">
            <p className="text-text-tertiary leading-relaxed mb-4">
              Your data is stored on servers located in regions provided by Supabase, Firebase, and Vercel. We implement industry-standard security measures including:
            </p>
            <ul className="space-y-3 text-text-tertiary leading-relaxed">
              {[
                "Encryption in transit (TLS/HTTPS) for all data communications",
                "Row-level security policies enforced at the database layer",
                "OAuth 2.0-based authentication with no passwords stored in plaintext",
                "Regular security reviews and dependency updates",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-text-tertiary leading-relaxed mt-4">
              No method of transmission or storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
            </p>
          </Section>

          <Section number="5" title="Cookies and Tracking">
            <p className="text-text-tertiary leading-relaxed">
              We use essential cookies to maintain your authentication session and remember your preferences (such as dark/light mode). We do not use third-party advertising cookies or sell your browsing data to advertisers. You can disable cookies in your browser settings, but doing so may affect your ability to use the platform.
            </p>
          </Section>

          <Section number="6" title="Your Rights">
            <p className="text-text-tertiary leading-relaxed mb-4">
              Depending on your location, you may have the following rights regarding your personal data:
            </p>
            <ul className="space-y-3 text-text-tertiary leading-relaxed">
              {[
                "Access — request a copy of the personal data we hold about you",
                "Correction — request correction of inaccurate or incomplete data",
                "Deletion — request deletion of your account and associated data",
                "Portability — request your data in a machine-readable format",
                "Objection — object to certain types of processing, such as marketing communications",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-text-tertiary leading-relaxed mt-4">
              To exercise any of these rights, please contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:text-blue-300 transition-colors">{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <Section number="7" title="Data Retention">
            <p className="text-text-tertiary leading-relaxed">
              We retain your account data for as long as your account is active. If you delete your account, we will remove your personal information within 30 days, except where we are required to retain it for legal or financial compliance purposes. Generated project files are deleted within 90 days of account deletion.
            </p>
          </Section>

          <Section number="8" title="Children's Privacy">
            <p className="text-text-tertiary leading-relaxed">
              {APP_NAME} is not directed to children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with their information, please contact us and we will promptly delete it.
            </p>
          </Section>

          <Section number="9" title="Third-Party Links">
            <p className="text-text-tertiary leading-relaxed">
              Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices of those third parties. We encourage you to review their privacy policies before providing any personal information.
            </p>
          </Section>

          <Section number="10" title="Changes to This Policy">
            <p className="text-text-tertiary leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the effective date. Your continued use of {APP_NAME} after any changes constitutes your acceptance of the updated policy.
            </p>
          </Section>

          <Section number="11" title="Contact Us">
            <p className="text-text-tertiary leading-relaxed">
              If you have questions, concerns, or requests regarding this Privacy Policy, please contact us at:
            </p>
            <div className="mt-4 p-4 rounded-xl bg-bg-secondary/60 border border-border-primary/40 text-text-secondary text-sm space-y-1">
              <p className="font-semibold text-text-primary">{APP_NAME}</p>
              <p>
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:text-blue-300 transition-colors">{CONTACT_EMAIL}</a>
              </p>
              <p>
                Website:{" "}
                <a href={APP_URL} className="text-blue-400 hover:text-blue-300 transition-colors">{APP_URL}</a>
              </p>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border-primary/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-text-muted">
            <span className="text-text-muted">Effective {EFFECTIVE_DATE}</span>
            <Link href="/terms" className="hover:text-text-secondary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold shrink-0">
          {number}
        </span>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="pl-10">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-text-secondary mb-1.5">{title}</h3>
      <p className="text-text-tertiary leading-relaxed">{children}</p>
    </div>
  );
}
