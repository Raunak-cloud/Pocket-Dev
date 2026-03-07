import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Danphe",
  description: "Danphe Terms of Service — the rules and conditions governing your use of our platform.",
};

const EFFECTIVE_DATE = "March 7, 2026";
const CONTACT_EMAIL = "raunak.vision@gmail.com";
const APP_NAME = "Danphe";
const APP_URL = "https://pocket-dev-lac.vercel.app";

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium mb-6">
            Legal
          </div>
          <h1 className="text-4xl font-bold text-text-primary mb-4">Terms of Service</h1>
          <p className="text-text-tertiary leading-relaxed max-w-2xl">
            Please read these Terms of Service carefully before using {APP_NAME}. By accessing or using our platform at{" "}
            <a href={APP_URL} className="text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-2">{APP_URL}</a>,
            you agree to be bound by these terms.
          </p>
        </div>

        <div className="space-y-10">
          <Section number="1" title="Acceptance of Terms">
            <p className="text-text-tertiary leading-relaxed">
              By creating an account or using {APP_NAME} in any way, you confirm that you are at least 13 years old, have read and understood these Terms, and agree to be legally bound by them. If you are using {APP_NAME} on behalf of an organisation, you represent that you have authority to bind that organisation to these Terms.
            </p>
          </Section>

          <Section number="2" title="Description of Service">
            <p className="text-text-tertiary leading-relaxed mb-4">
              {APP_NAME} is an AI-powered platform that allows users to generate, preview, and export React/Next.js web applications using natural language prompts. Our service includes:
            </p>
            <ul className="space-y-3 text-text-tertiary leading-relaxed">
              {[
                "AI-powered code generation using large language models",
                "Live preview of generated applications via sandboxed environments",
                "Backend integration with authentication, databases, and payment systems",
                "Export and deployment tools including GitHub and Vercel integration",
                "Project management and edit history",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-text-tertiary leading-relaxed mt-4">
              We reserve the right to modify, suspend, or discontinue any part of the service at any time with reasonable notice.
            </p>
          </Section>

          <Section number="3" title="Accounts and Registration">
            <p className="text-text-tertiary leading-relaxed mb-4">
              To access most features of {APP_NAME}, you must create an account. You agree to:
            </p>
            <ul className="space-y-3 text-text-tertiary leading-relaxed">
              {[
                "Provide accurate and complete registration information",
                "Keep your account credentials confidential and not share them with others",
                "Notify us immediately of any unauthorised access to your account",
                "Be responsible for all activity that occurs under your account",
                "Not create more than one account per person without prior written consent",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section number="4" title="Tokens and Payments">
            <SubSection title="App Tokens">
              {APP_NAME} operates on a token-based system. Tokens are consumed when you generate new applications or make edits with backend integrations. Token balances are non-transferable and are tied to your individual account.
            </SubSection>
            <SubSection title="Purchasing Tokens">
              Tokens may be purchased through our platform using Stripe. All purchases are in Australian Dollars (AUD). By completing a purchase, you authorise us to charge your payment method for the selected amount.
            </SubSection>
            <SubSection title="Refund Policy">
              All token purchases are final and non-refundable, except where required by applicable consumer law. If you believe a charge was made in error, please contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:text-violet-300 transition-colors">{CONTACT_EMAIL}</a>{" "}
              within 14 days of the transaction.
            </SubSection>
            <SubSection title="Token Expiry">
              Purchased tokens do not expire while your account remains active. We reserve the right to introduce expiry policies in the future with at least 90 days written notice.
            </SubSection>
          </Section>

          <Section number="5" title="Acceptable Use">
            <p className="text-text-tertiary leading-relaxed mb-4">
              You agree to use {APP_NAME} only for lawful purposes. You must not use our platform to:
            </p>
            <ul className="space-y-3 text-text-tertiary leading-relaxed">
              {[
                "Generate, distribute, or store illegal, harmful, or offensive content",
                "Infringe upon the intellectual property rights of any third party",
                "Attempt to reverse-engineer, decompile, or extract our AI models or proprietary systems",
                "Circumvent, disable, or interfere with security features of the platform",
                "Use automated tools or bots to access the service in a way that places excessive load on our infrastructure",
                "Impersonate any person or entity or misrepresent your affiliation",
                "Generate malware, spyware, phishing pages, or any malicious code",
                "Violate any applicable local, national, or international law or regulation",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-text-tertiary leading-relaxed mt-4">
              Violation of these rules may result in immediate suspension or termination of your account without refund.
            </p>
          </Section>

          <Section number="6" title="Intellectual Property">
            <SubSection title="Your Content">
              You retain ownership of the prompts you submit and the applications generated for you. By using our service, you grant {APP_NAME} a limited, non-exclusive licence to process your prompts and generated code solely to provide and improve the service.
            </SubSection>
            <SubSection title="Our Platform">
              {APP_NAME}, its logo, design, source code, AI models, and all related intellectual property are owned by us or our licensors. Nothing in these Terms grants you a right to use our trademarks, brand names, or proprietary technology beyond the limited use necessary to access the service.
            </SubSection>
            <SubSection title="AI-Generated Code">
              Code generated by our AI models is provided for your use. We make no warranties regarding the originality, accuracy, or fitness for a particular purpose of AI-generated code. You are responsible for reviewing and testing all generated code before deploying it in production.
            </SubSection>
          </Section>

          <Section number="7" title="Third-Party Services">
            <p className="text-text-tertiary leading-relaxed">
              {APP_NAME} integrates with third-party services including Google (Gemini AI), Supabase, Stripe, Firebase, Vercel, GitHub, and E2B. Your use of these third-party services is governed by their respective terms of service and privacy policies. We are not responsible for the conduct, policies, or content of any third-party service.
            </p>
          </Section>

          <Section number="8" title="Disclaimers and Limitation of Liability">
            <SubSection title="No Warranty">
              {APP_NAME} is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the service will be uninterrupted, error-free, or free of viruses.
            </SubSection>
            <SubSection title="AI Accuracy">
              AI-generated code may contain errors, security vulnerabilities, or incomplete implementations. You are solely responsible for reviewing, testing, and validating all output before use. We strongly recommend professional code review before deploying AI-generated applications to production environments.
            </SubSection>
            <SubSection title="Limitation of Liability">
              To the maximum extent permitted by applicable law, {APP_NAME} and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising from your use of the service or any AI-generated output, even if we have been advised of the possibility of such damages. Our total liability to you for any claim shall not exceed the amount you paid to us in the 3 months preceding the claim.
            </SubSection>
          </Section>

          <Section number="9" title="Indemnification">
            <p className="text-text-tertiary leading-relaxed">
              You agree to indemnify, defend, and hold harmless {APP_NAME}, its operators, affiliates, and employees from any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising from your use of the service, your violation of these Terms, or your infringement of any third-party rights.
            </p>
          </Section>

          <Section number="10" title="Termination">
            <p className="text-text-tertiary leading-relaxed mb-4">
              We may suspend or terminate your access to {APP_NAME} at any time, with or without cause, including for violation of these Terms. You may terminate your account at any time by contacting us. Upon termination:
            </p>
            <ul className="space-y-3 text-text-tertiary leading-relaxed">
              {[
                "Your access to the platform will be revoked immediately",
                "Any unused token balance will be forfeited (unless otherwise required by law)",
                "Your project data will be retained for 30 days before permanent deletion",
                "Provisions of these Terms that by their nature should survive termination will remain in effect",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section number="11" title="Governing Law">
            <p className="text-text-tertiary leading-relaxed">
              These Terms are governed by the laws of Australia, without regard to conflict of law principles. Any disputes arising from these Terms or your use of {APP_NAME} shall be subject to the exclusive jurisdiction of the courts of Australia. If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
            </p>
          </Section>

          <Section number="12" title="Changes to These Terms">
            <p className="text-text-tertiary leading-relaxed">
              We reserve the right to update these Terms at any time. We will notify you of material changes by email or by posting a prominent notice on the platform at least 14 days before the changes take effect. Your continued use of {APP_NAME} after changes take effect constitutes your acceptance of the revised Terms.
            </p>
          </Section>

          <Section number="13" title="Contact Us">
            <p className="text-text-tertiary leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-4 p-4 rounded-xl bg-bg-secondary/60 border border-border-primary/40 text-text-secondary text-sm space-y-1">
              <p className="font-semibold text-text-primary">{APP_NAME}</p>
              <p>
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:text-violet-300 transition-colors">{CONTACT_EMAIL}</a>
              </p>
              <p>
                Website:{" "}
                <a href={APP_URL} className="text-violet-400 hover:text-violet-300 transition-colors">{APP_URL}</a>
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
            <Link href="/privacy" className="hover:text-text-secondary transition-colors">Privacy Policy</Link>
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
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold shrink-0">
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
