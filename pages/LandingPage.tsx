import React, { useState, useEffect, useRef } from 'react';
import { Scale, ArrowRight, Shield, Search, FileText, CheckCircle2, Zap, Check, Star } from 'lucide-react';
import { Button, Badge } from '../components/ui/Generic';
import { cn } from '../lib/cn';

interface LandingPageProps {
  onNavigate: (page: string) => void;
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

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const onGetStarted = () => onNavigate('login');

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-amber-100 selection:text-amber-900 overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <div className="bg-slate-900 p-2 rounded-lg shadow-lg shadow-slate-900/20 hover:scale-105 transition-transform">
                    <Scale className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-900 font-serif">RCIC Assistant</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
                <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
                <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
                <a href="#about" className="hover:text-slate-900 transition-colors">About</a>
            </div>
            <div className="flex items-center gap-4">
                <button 
                  onClick={() => onNavigate('login')}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Log in
                </button>
                <Button onClick={onGetStarted} variant="premium" size="md" className="rounded-full px-6 shadow-slate-900/20">
                    Get Started
                </Button>
            </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Refined Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-white via-transparent to-transparent pointer-events-none z-0"></div>
        
        <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-amber-200/20 rounded-full mix-blend-multiply filter blur-[120px] animate-blob"></div>
        <div className="absolute top-40 right-10 w-[600px] h-[600px] bg-blue-200/20 rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-2000"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
            <FadeIn>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.04)] text-slate-600 text-xs font-semibold mb-8 hover:border-amber-200 hover:bg-amber-50/50 transition-all cursor-default backdrop-blur-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    Updated with 2024 SCC Jurisprudence
                </div>
            </FadeIn>
            
            <FadeIn delay={100}>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-8 leading-[1.05] font-serif">
                    Legal drafting, <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900">elevated by intelligence.</span>
                </h1>
            </FadeIn>
            
            <FadeIn delay={200}>
                <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
                    The premier AI assistant for Canadian immigration consultants. 
                    Find on-point case law and draft persuasive submissions in minutes, not hours.
                </p>
            </FadeIn>
            
            <FadeIn delay={300}>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
                    <Button onClick={onGetStarted} variant="premium" size="lg" className="rounded-full px-8 h-14 text-lg shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:shadow-slate-900/20 transition-all transform hover:-translate-y-0.5">
                        Start Researching Free <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <Button variant="secondary" size="lg" className="rounded-full px-8 h-14 text-lg bg-white/80 backdrop-blur border-slate-200 hover:bg-white hover:border-slate-300">
                        View Interactive Demo
                    </Button>
                </div>
            </FadeIn>

            {/* Mock UI Interface */}
            <FadeIn delay={400} className="relative mx-auto max-w-5xl rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] overflow-hidden ring-1 ring-white/50">
                <div className="h-10 bg-white/50 border-b border-slate-200/50 flex items-center px-4 gap-2">
                    <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-300/80"></div>
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-300/80"></div>
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-300/80"></div>
                    </div>
                </div>
                <div className="grid grid-cols-[240px_1fr] h-[460px] md:h-[500px]">
                    {/* Sidebar Mock */}
                    <div className="border-r border-slate-200/50 bg-slate-50/50 p-6 hidden md:block text-left">
                        <div className="h-8 w-32 bg-slate-200/50 rounded-lg mb-8"></div>
                        <div className="space-y-4 opacity-60">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-transparent hover:bg-white hover:border-slate-100 transition-colors">
                                    <div className={`h-6 w-6 rounded-md ${i === 1 ? 'bg-amber-100' : 'bg-slate-200'}`}></div>
                                    <div className="h-2 w-20 bg-slate-200 rounded"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Main Mock */}
                    <div className="p-8 bg-white/80 relative">
                         <div className="space-y-8">
                            <div className="flex justify-end">
                                <div className="bg-slate-900 text-white px-5 py-4 rounded-2xl rounded-tr-sm text-sm max-w-sm shadow-lg shadow-slate-900/10 leading-relaxed font-light">
                                    I need case law regarding study permit refusals for mature students under s. 216(1).
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 shadow-sm">
                                    <Scale className="h-4 w-4 text-amber-600" />
                                </div>
                                <div className="space-y-4 max-w-lg text-left">
                                    <div className="p-5 rounded-2xl rounded-tl-sm bg-white border border-slate-100 text-sm text-slate-600 shadow-sm ring-1 ring-slate-900/5">
                                        <p className="mb-3 font-serif text-slate-900 font-medium text-base">Key Jurisprudence Identified:</p>
                                        <p className="mb-3 leading-relaxed">
                                            The Federal Court has established that an officer's concern about a "mature student" must be rooted in evidence, not stereotypes.
                                        </p>
                                        <div className="space-y-2">
                                            <div className="bg-slate-50 p-3 rounded border border-slate-200 flex justify-between items-center hover:border-amber-200 hover:bg-[#fffdf5] transition-all cursor-pointer group">
                                                <span className="font-semibold text-slate-800 group-hover:text-amber-900 transition-colors">Irimie v. Canada</span>
                                                <span className="text-xs font-mono text-slate-400 group-hover:text-amber-700/60">2000 CanLII 16688</span>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded border border-slate-200 flex justify-between items-center hover:border-amber-200 hover:bg-[#fffdf5] transition-all cursor-pointer group">
                                                <span className="font-semibold text-slate-800 group-hover:text-amber-900 transition-colors">Momi v. Canada</span>
                                                <span className="text-xs font-mono text-slate-400 group-hover:text-amber-700/60">2013 FC 666</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                         </div>
                    </div>
                </div>
            </FadeIn>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 border-y border-slate-200/60 bg-white">
        <FadeIn className="max-w-7xl mx-auto px-6">
            <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">Trusted by regulated professionals at</p>
            <div className="flex flex-wrap justify-center gap-12 md:gap-20 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                <span className="text-xl font-bold font-serif text-slate-900">LEXBASE</span>
                <span className="text-xl font-bold font-sans text-slate-900">Immigroup</span>
                <span className="text-xl font-bold font-serif text-slate-900 tracking-[0.2em]">VISACORP</span>
                <span className="text-xl font-bold font-sans text-slate-900 italic">GlobalMove</span>
                <span className="text-xl font-bold font-mono text-slate-900">CANLAW</span>
            </div>
        </FadeIn>
      </section>

      {/* Bento Grid Features */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-6">
        <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 font-serif">Engineered for legal precision</h2>
            <p className="text-slate-500 text-lg leading-relaxed">Generic AI hallucinations can cost you a case. Our system is grounded in a verified database of Federal Court and Supreme Court decisions.</p>
        </FadeIn>
        
        <div className="grid md:grid-cols-3 md:grid-rows-2 gap-6 h-auto md:h-[600px]">
            {/* Feature 1 - Large Left */}
            <FadeIn delay={100} className="md:row-span-2 p-8 rounded-[2rem] bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-amber-100/80 transition-colors duration-700"></div>
                <div className="relative z-10 h-full flex flex-col">
                    <div className="h-14 w-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6 group-hover:scale-110 transition-transform duration-500 border border-amber-100">
                        <Search className="h-7 w-7" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4 font-serif">Semantic Case Search</h3>
                    <p className="text-slate-500 leading-relaxed mb-8 flex-1">
                        Don't just search for keywords. Find cases based on legal principles like "procedural fairness regarding extrinsic evidence" or "reasonableness of financial assessment".
                    </p>
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 mt-auto shadow-inner">
                        <div className="flex gap-2 mb-2">
                            <div className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dual Intent</div>
                            <div className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vavilov</div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-2 w-full bg-slate-200/70 rounded-full"></div>
                            <div className="h-2 w-2/3 bg-slate-200/70 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </FadeIn>

            {/* Feature 2 - Top Middle */}
            <FadeIn delay={200} className="p-8 rounded-[2rem] bg-slate-900 text-white shadow-xl hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-500 relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900"></div>
                 <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors duration-700"></div>
                 <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                            <Zap className="h-6 w-6 text-amber-400" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold mb-2">Instant IRAC Memos</h3>
                        <p className="text-slate-300 text-sm leading-relaxed">Generate structured Issue, Rule, Analysis, Conclusion memos ready for client files.</p>
                    </div>
                 </div>
            </FadeIn>

            {/* Feature 3 - Top Right */}
            <FadeIn delay={300} className="p-8 rounded-[2rem] bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-500 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-8 -mt-8 group-hover:bg-blue-100 transition-colors duration-700"></div>
                <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="h-12 w-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4 border border-blue-100 group-hover:rotate-12 transition-transform duration-500">
                        <Shield className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Vavilov Risk Analysis</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">Upload refusal letters to identify weak officer reasoning instantly.</p>
                    </div>
                </div>
            </FadeIn>

            {/* Feature 4 - Wide Bottom */}
            <FadeIn delay={400} className="md:col-span-2 p-8 rounded-[2rem] bg-gradient-to-br from-slate-50 to-white border border-slate-200 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group hover:border-slate-300 transition-colors duration-500">
                <div className="flex-1 relative z-10">
                    <h3 className="text-2xl font-bold text-slate-900 mb-3 font-serif">Always Verified Citations</h3>
                    <p className="text-slate-600 leading-relaxed">Every claim is backed by a specific paragraph number. Click to verify the source instantly in our integrated reader.</p>
                    <div className="mt-6 flex gap-6 text-sm font-medium text-slate-700">
                        <span className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No hallucinations</span>
                        <span className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Live links</span>
                    </div>
                </div>
                <div className="w-full md:w-1/3 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200 p-5 transform rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-serif font-bold text-slate-700">¶</div>
                        <div className="text-xs text-slate-500 font-serif italic leading-relaxed">
                            "A reasonable decision is one that is based on an internally coherent and rational chain of analysis..."
                            <br/><span className="not-italic font-bold text-slate-900 mt-2 block border-t border-slate-100 pt-2">- Vavilov, para 85</span>
                        </div>
                    </div>
                </div>
            </FadeIn>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-50 relative overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-slate-50 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
            <FadeIn className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold font-serif text-slate-900 mb-6">Transparent, predictable pricing</h2>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto">Start researching for free. Upgrade when you need the full power of AI drafting.</p>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
                {/* Starter Plan */}
                <FadeIn delay={100} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col hover:shadow-xl transition-shadow duration-300">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Starter</h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-slate-900">$0</span>
                            <span className="text-slate-500">/mo</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-4">Perfect for trying out the search capabilities.</p>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400" /> 5 Case Searches / mo</li>
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400" /> Basic Filters</li>
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400" /> Federal Court DB Access</li>
                    </ul>
                    <Button variant="outline" className="w-full rounded-xl py-6" onClick={onGetStarted}>Get Started</Button>
                </FadeIn>

                {/* Professional Plan */}
                <FadeIn delay={200} className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl flex flex-col relative overflow-hidden transform md:-translate-y-4">
                    <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-bl-xl">POPULAR</div>
                    <div className="mb-6 relative z-10">
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">Professional <Star className="h-4 w-4 text-amber-400 fill-amber-400" /></h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-white">$49</span>
                            <span className="text-slate-400">/mo</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-4">For solo practitioners and busy consultants.</p>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1 relative z-10">
                        <li className="flex items-center gap-3 text-sm text-slate-200"><Check className="h-4 w-4 text-amber-400" /> Unlimited Searches</li>
                        <li className="flex items-center gap-3 text-sm text-slate-200"><Check className="h-4 w-4 text-amber-400" /> AI Memo Drafting</li>
                        <li className="flex items-center gap-3 text-sm text-slate-200"><Check className="h-4 w-4 text-amber-400" /> Document Export (.docx)</li>
                        <li className="flex items-center gap-3 text-sm text-slate-200"><Check className="h-4 w-4 text-amber-400" /> Priority Support</li>
                    </ul>
                    <Button variant="premium" className="w-full rounded-xl py-6 bg-gradient-to-r from-amber-500 to-orange-600 border-none hover:from-amber-400 hover:to-orange-500 text-white shadow-lg shadow-orange-900/20" onClick={onGetStarted}>
                        Start Free Trial
                    </Button>
                </FadeIn>

                {/* Firm Plan */}
                <FadeIn delay={300} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col hover:shadow-xl transition-shadow duration-300">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Firm</h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-slate-900">Custom</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-4">For larger teams requiring control & security.</p>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400" /> Everything in Pro</li>
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400" /> SSO / SAML Integration</li>
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400" /> Centralized Billing</li>
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400" /> Dedicated Account Mgr</li>
                    </ul>
                    <Button variant="outline" className="w-full rounded-xl py-6" onClick={() => window.location.href = 'mailto:sales@example.com'}>Contact Sales</Button>
                </FadeIn>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16 px-6 relative overflow-hidden">
        {/* Footer Background Noise */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12 relative z-10">
            <div className="space-y-6 max-w-xs">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg">
                        <Scale className="h-5 w-5 text-slate-900" />
                    </div>
                    <span className="font-bold text-white text-xl font-serif tracking-tight">RCIC Assistant</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">Empowering immigration professionals with next-generation legal intelligence. Built securely in Canada.</p>
            </div>
            
            <div className="flex gap-20 text-sm">
                <div className="space-y-6">
                    <h4 className="font-bold text-white tracking-wide uppercase text-xs">Product</h4>
                    <a href="#" className="block hover:text-white transition-colors">Features</a>
                    <a href="#" className="block hover:text-white transition-colors">Pricing</a>
                    <a href="#" className="block hover:text-white transition-colors">Case Law DB</a>
                </div>
                <div className="space-y-6">
                    <h4 className="font-bold text-white tracking-wide uppercase text-xs">Company</h4>
                    <a href="#" className="block hover:text-white transition-colors">About</a>
                    <a href="#" className="block hover:text-white transition-colors">Security</a>
                    <a href="#" className="block hover:text-white transition-colors">Contact</a>
                </div>
            </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4 relative z-10">
            <span>© 2024 LegalTech Solutions Inc. All rights reserved.</span>
            <div className="flex gap-6">
                <a href="#" className="hover:text-slate-300 transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            </div>
        </div>
      </footer>
    </div>
  );
};