import React, { useState, useEffect, useRef } from 'react';
import { Scale, ArrowLeft, Hash } from 'lucide-react';
import { Button } from '../components/ui/Generic';
import { cn } from '../lib/cn';

interface TermsPageProps {
  onBack: () => void;
}

// Lightweight hook for scroll animations
const useInView = (options = { threshold: 0.1 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, options);

    if (ref.current) observer.observe(ref.current);
    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return [ref, isInView] as const;
};

const FadeIn = ({ children, className, delay = 0 }: { children?: React.ReactNode, className?: string, delay?: number }) => {
  const [ref, isInView] = useInView();
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-1000 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] transform will-change-transform",
        isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

export const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState<string>('');

  // Handle scroll spy for TOC
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[id]');
      let current = '';
      
      sections.forEach(section => {
        const sectionTop = (section as HTMLElement).offsetTop;
        if (window.scrollY >= sectionTop - 150) {
          current = section.getAttribute('id') || '';
        }
      });
      
      if (current) setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 100,
        behavior: 'smooth'
      });
      setActiveSection(id);
    }
  };

  const sections = [
    { id: 'intro', label: 'Introduction' },
    { id: 'purpose', label: '1. What the App is' },
    { id: 'advice', label: '2. Not legal advice' },
    { id: 'alpha', label: '3. Alpha status' },
    { id: 'eligibility', label: '4. Eligibility and use' },
    { id: 'content', label: '5. User content' },
    { id: 'citations', label: '6. Citations' },
    { id: 'thirdparty', label: '7. Third-party services' },
    { id: 'privacy', label: '8. Privacy' },
    { id: 'safety', label: '9. Acceptable use' },
    { id: 'ip', label: '10. Intellectual property' },
    { id: 'changes', label: '11. Availability' },
    { id: 'disclaimer', label: '12. Disclaimers' },
    { id: 'liability', label: '13. Liability' },
    { id: 'indemnity', label: '14. Indemnity' },
    { id: 'termination', label: '15. Termination' },
    { id: 'law', label: '16. Governing law' },
    { id: 'contact', label: '17. Contact' },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Background Elements */}
      <div className="fixed inset-0 w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-white via-transparent to-transparent pointer-events-none z-0"></div>
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
            <div className="bg-slate-900 p-2 rounded-lg shadow-lg shadow-slate-900/20">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 font-serif">RCIC Assistant</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 group">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-32 pb-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12 items-start">
          
          {/* Main Content */}
          <main className="min-w-0">
            <FadeIn>
              <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-900/10 mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-6 border border-blue-500/30">
                    Alpha Release
                    </div>
                    <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 leading-tight">Terms and Conditions</h1>
                    <p className="text-slate-400 text-lg max-w-2xl">
                    Please read these terms carefully before using the RCIC Assistant. 
                    Your use of the service constitutes agreement to these terms.
                    </p>
                    <div className="mt-8 flex items-center gap-4 text-sm text-slate-500 font-mono">
                        <span>Effective date: February 11, 2026</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                        <span>Version 0.1.0</span>
                    </div>
                </div>
              </div>
            </FadeIn>

            <div className="space-y-16">
                {/* Introduction */}
                <FadeIn delay={100}>
                    <section id="intro" className="prose prose-slate max-w-none">
                    <p className="text-xl text-slate-600 leading-relaxed font-light">
                        By accessing or using the RCIC Assistant App ("App"), you agree to these Terms and Conditions ("Terms"). 
                        If you do not agree, do not use the App.
                    </p>
                    </section>
                </FadeIn>

                {/* Section 1 */}
                <FadeIn delay={150}>
                    <section id="purpose" className="scroll-mt-32">
                        <SectionHeader number="1" title="What the App is" />
                        <p className="text-slate-600 leading-relaxed text-lg">
                            The App provides AI-assisted legal research support for Canadian immigration professionals, including RCICs, 
                            by generating summaries and responses that may include citations to sources such as legislation, policy manuals, and decisions.
                        </p>
                    </section>
                </FadeIn>

                {/* Section 2 */}
                <FadeIn delay={200}>
                    <section id="advice" className="scroll-mt-32">
                        <SectionHeader number="2" title="Not legal advice" />
                        <div className="bg-blue-50 rounded-2xl p-8 border border-blue-100 shadow-[0_2px_20px_rgba(59,130,246,0.1)]">
                            <div className="flex gap-4">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
                                    <Shield className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-blue-900 font-bold mb-2">Important Disclaimer</h3>
                                    <p className="text-slate-700 leading-relaxed">
                                    The App is provided for informational and research purposes only. 
                                    It is <strong>not legal advice</strong> and does not create a solicitor-client relationship or any other fiduciary relationship. 
                                    You are responsible for verifying all outputs, including citations, paragraph references, and legal conclusions, 
                                    using official sources before relying on them.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </FadeIn>

                {/* Section 3 */}
                <FadeIn delay={250}>
                    <section id="alpha" className="scroll-mt-32">
                        <SectionHeader number="3" title="Alpha status" />
                        <p className="text-slate-600 leading-relaxed">
                            The App is an alpha product. Features may be incomplete, inaccurate, unstable, or change without notice. 
                            The App may be unavailable at times and may contain errors ("hallucinations").
                        </p>
                    </section>
                </FadeIn>

                {/* Section 4 */}
                <FadeIn delay={300}>
                    <section id="eligibility" className="scroll-mt-32">
                        <SectionHeader number="4" title="Eligibility and use" />
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <Check className="h-5 w-5 text-emerald-500" /> You must
                                </h4>
                                <ul className="space-y-3">
                                    <ListItem>Use the App only for lawful purposes</ListItem>
                                    <ListItem>Provide accurate information where required</ListItem>
                                    <ListItem>Not attempt to reverse engineer or disrupt the App</ListItem>
                                </ul>
                            </div>
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <XIcon className="h-5 w-5 text-red-500" /> You must not
                                </h4>
                                <ul className="space-y-3">
                                    <ListItem>Provide services in violation of regulations</ListItem>
                                    <ListItem>Upload content you do not own</ListItem>
                                    <ListItem>Submit sensitive personal data not required</ListItem>
                                </ul>
                            </div>
                        </div>
                    </section>
                </FadeIn>

                {/* Section 5 */}
                <FadeIn delay={350}>
                    <section id="content" className="scroll-mt-32">
                        <SectionHeader number="5" title="User content and responsibility" />
                        <p className="text-slate-600 leading-relaxed mb-6">
                            You may submit text ("Inputs") to the App. You are solely responsible for your Inputs, 
                            including ensuring you have rights to submit them and that they do not violate laws or third-party rights.
                        </p>
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <p className="font-medium text-slate-900 mb-3">You acknowledge that:</p>
                            <ul className="space-y-2">
                                <ListItem>AI outputs may be incorrect, incomplete, outdated, or misleading.</ListItem>
                                <ListItem>You must independently assess the suitability of outputs for your use case.</ListItem>
                            </ul>
                        </div>
                    </section>
                </FadeIn>

                {/* Section 6 */}
                <FadeIn delay={400}>
                    <section id="citations" className="scroll-mt-32">
                        <SectionHeader number="6" title="Citations and verification" />
                        <p className="text-slate-600 leading-relaxed mb-4">
                            The App may display citations or source snippets. These are provided to help your research, but we do not guarantee:
                        </p>
                        <ul className="grid sm:grid-cols-2 gap-4">
                            <li className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-700">
                                <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                                Citation completeness
                            </li>
                            <li className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-700">
                                <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                                Paragraph number accuracy
                            </li>
                            <li className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-700">
                                <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                                Source support for statements
                            </li>
                            <li className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-700">
                                <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                                Current law/policy reflection
                            </li>
                        </ul>
                    </section>
                </FadeIn>

                {/* Section 7 */}
                <FadeIn delay={450}>
                    <section id="thirdparty" className="scroll-mt-32">
                        <SectionHeader number="7" title="Third-party services" />
                        <p className="text-slate-600 leading-relaxed">
                            The App may use third-party services to function (for example: model inference, vector databases, 
                            retrieval tools, or external data sources). Your Inputs and relevant context may be transmitted to 
                            these services to generate outputs. Third-party services are governed by their own terms and privacy policies, 
                            and we are not responsible for their availability, security practices, or changes.
                        </p>
                    </section>
                </FadeIn>

                {/* Section 8 */}
                <FadeIn delay={500}>
                    <section id="privacy" className="scroll-mt-32">
                        <SectionHeader number="8" title="Privacy and data handling (alpha summary)" />
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <h4 className="font-bold text-slate-900 mb-4">Data Collection</h4>
                                <ul className="space-y-2">
                                    <ListItem>Your Inputs and generated outputs</ListItem>
                                    <ListItem>Basic usage logs (e.g., timestamps, request metadata)</ListItem>
                                    <ListItem>Error logs for debugging and improving the App</ListItem>
                                </ul>
                            </div>
                            <div className="p-6 bg-red-50/30">
                                <h4 className="font-bold text-red-700 mb-4 flex items-center gap-2">
                                    <ShieldAlert className="h-5 w-5" /> Sensitive Data Warning
                                </h4>
                                <p className="text-sm text-red-600 mb-3 font-medium">Do not submit:</p>
                                <ul className="space-y-2 mb-4">
                                    <ListItem className="text-red-700">Highly sensitive personal information (medical, biometric, financial)</ListItem>
                                    <ListItem className="text-red-700">Confidential data you wouldn't want disclosed in a breach</ListItem>
                                </ul>
                                <p className="text-sm text-slate-500">
                                    We may retain logs for debugging and quality assurance, and we may delete data at any time during alpha.
                                </p>
                            </div>
                        </div>
                    </section>
                </FadeIn>

                {/* Section 9 */}
                <FadeIn delay={550}>
                    <section id="safety" className="scroll-mt-32">
                        <SectionHeader number="9" title="Acceptable use and safety" />
                        <p className="text-slate-600 leading-relaxed mb-4">You agree not to use the App to:</p>
                        <ul className="space-y-3">
                            <ListItem>Facilitate wrongdoing or evasion of law or regulation</ListItem>
                            <ListItem>Harass, threaten, or abuse others</ListItem>
                            <ListItem>Upload malware, attempt unauthorized access, or interfere with service operation</ListItem>
                        </ul>
                    </section>
                </FadeIn>

                {/* Section 10 */}
                <FadeIn delay={600}>
                    <section id="ip" className="scroll-mt-32">
                        <SectionHeader number="10" title="Intellectual property" />
                        <p className="text-slate-600 leading-relaxed mb-4">
                            We own the App, its design, and our software. You receive a limited, non-exclusive, revocable license 
                            to use the App for its intended purpose.
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                            You retain rights to your Inputs. To operate the App, you grant us a license to process your Inputs 
                            and generate outputs, including for debugging and improving the App during alpha.
                        </p>
                    </section>
                </FadeIn>

                {/* Section 11 */}
                <FadeIn delay={650}>
                    <section id="changes" className="scroll-mt-32">
                        <SectionHeader number="11" title="Availability and changes" />
                        <p className="text-slate-600 leading-relaxed">
                            We may modify, suspend, or discontinue the App (in whole or in part) at any time, without notice. 
                            We may update these Terms; continued use after updates means you accept the updated Terms.
                        </p>
                    </section>
                </FadeIn>

                {/* Section 12 */}
                <FadeIn delay={700}>
                    <section id="disclaimer" className="scroll-mt-32">
                        <SectionHeader number="12" title="Disclaimers" />
                        <div className="bg-slate-100 rounded-2xl p-8 border border-slate-200">
                            <p className="text-slate-700 leading-relaxed font-medium font-serif italic">
                            "THE APP IS PROVIDED 'AS IS' AND 'AS AVAILABLE.' TO THE MAXIMUM EXTENT PERMITTED BY LAW, 
                            WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A 
                            PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APP WILL BE ERROR-FREE OR UNINTERRUPTED."
                            </p>
                        </div>
                    </section>
                </FadeIn>

                {/* Section 13 */}
                <FadeIn delay={750}>
                    <section id="liability" className="scroll-mt-32">
                        <SectionHeader number="13" title="Limitation of liability" />
                        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm mb-6">
                            <p className="text-slate-800 font-medium uppercase tracking-wide text-xs mb-4 text-center text-slate-400">Liability Cap</p>
                            <div className="text-center">
                                <span className="text-4xl font-bold text-slate-900">$50 CAD</span>
                                <span className="block text-sm text-slate-500 mt-2">or amount paid in past 3 months</span>
                            </div>
                        </div>
                        <p className="text-slate-600 leading-relaxed mb-4 text-sm uppercase font-medium">
                            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
                            CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, 
                            ARISING OUT OF OR RELATED TO YOUR USE OF THE APP.
                        </p>
                    </section>
                </FadeIn>

                {/* Section 14-17 (Grouped for brevity visually but structurally sound) */}
                <FadeIn delay={800}>
                    <div className="space-y-16">
                        <section id="indemnity" className="scroll-mt-32">
                            <SectionHeader number="14" title="Indemnity" />
                            <p className="text-slate-600 leading-relaxed">
                                You agree to indemnify and hold us harmless from claims arising out of your Inputs, your use of the App, 
                                or your violation of these Terms.
                            </p>
                        </section>

                        <section id="termination" className="scroll-mt-32">
                            <SectionHeader number="15" title="Termination" />
                            <p className="text-slate-600 leading-relaxed">
                                We may suspend or terminate your access at any time if we believe you violated these Terms or if required 
                                for security, legal, or operational reasons.
                            </p>
                        </section>

                        <section id="law" className="scroll-mt-32">
                            <SectionHeader number="16" title="Governing law" />
                            <p className="text-slate-600 leading-relaxed">
                                These Terms are governed by the laws of British Columbia and the federal laws of Canada applicable therein, 
                                without regard to conflict of laws rules. Courts located in British Columbia will have exclusive jurisdiction, 
                                unless applicable law requires otherwise.
                            </p>
                        </section>

                        <section id="contact" className="scroll-mt-32">
                            <SectionHeader number="17" title="Contact" />
                            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-lg text-center">
                                <p className="text-slate-600 mb-4">Questions about these Terms?</p>
                                <a 
                                    href="mailto:support@rcicassistant.com" 
                                    className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                                >
                                    Contact Support
                                </a>
                            </div>
                        </section>
                    </div>
                </FadeIn>
            </div>
          </main>

          {/* Sticky Table of Contents Sidebar */}
          <aside className="hidden lg:block sticky top-28 h-[calc(100vh-140px)] overflow-y-auto pr-4 custom-scrollbar">
             <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6 text-slate-900 font-bold font-serif">
                    <Hash className="h-4 w-4 text-blue-500" />
                    <span>Contents</span>
                </div>
                <nav className="space-y-1 relative">
                    {/* Active Indicator Line */}
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200"></div>
                    
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            onClick={() => scrollToSection(section.id)}
                            className={cn(
                                "block w-full text-left pl-4 py-2 text-sm transition-all duration-300 border-l-2 -ml-px",
                                activeSection === section.id
                                    ? "border-blue-500 text-slate-900 font-bold bg-blue-50/50 rounded-r-lg"
                                    : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
                            )}
                        >
                            {section.label}
                        </button>
                    ))}
                </nav>
             </div>
          </aside>

        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-sm text-slate-500">© 2026 RCIC Assistant. All rights reserved.</p>
            <div className="flex gap-6">
                <Button variant="outline" size="sm" onClick={onBack}>
                    Back to Home
                </Button>
            </div>
        </div>
      </footer>

    </div>
  );
};

// Helper Components
const SectionHeader = ({ number, title }: { number: string, title: string }) => (
    <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-4 group">
        <span className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-50 text-slate-400 text-sm font-bold border border-slate-200 group-hover:border-blue-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all shadow-sm">
            {number}
        </span>
        <span className="font-serif tracking-tight">{title}</span>
    </h2>
);

const ListItem = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <li className={cn("flex items-start gap-3 text-slate-600 leading-relaxed", className)}>
        <div className="h-1.5 w-1.5 rounded-full bg-slate-300 mt-2.5 shrink-0"></div>
        <span>{children}</span>
    </li>
);

// Icons
const Check = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
);

const XIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>
);

const Shield = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
);

const ShieldAlert = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><line x1="12" x2="12" y1="8" y2="13"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
);
