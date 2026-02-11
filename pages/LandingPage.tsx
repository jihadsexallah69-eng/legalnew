import React, { useState, useEffect, useRef } from 'react';
import { Scale, ArrowRight, Shield, Search, FileText, CheckCircle2, Zap, Check, Star, Gavel, BookOpen, Landmark, Scroll, Users, Globe, Lock, ChevronRight, PlayCircle, Sparkles } from 'lucide-react';
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
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      
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
        
        <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-blue-200/20 rounded-full mix-blend-multiply filter blur-[120px] animate-blob"></div>
        <div className="absolute top-40 right-10 w-[600px] h-[600px] bg-indigo-200/20 rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-2000"></div>

        {/* Floating Icons for Depth */}
        <div className="absolute top-32 left-[10%] text-slate-200 animate-slide-up opacity-60 hidden lg:block">
            <Gavel className="h-12 w-12 rotate-12" />
        </div>
        <div className="absolute top-40 right-[15%] text-slate-200 animate-slide-up animation-delay-500 opacity-60 hidden lg:block">
            <BookOpen className="h-10 w-10 -rotate-6" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
            <FadeIn>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.04)] text-slate-600 text-xs font-semibold mb-8 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-default backdrop-blur-sm group">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Updated with 2024 SCC Jurisprudence
                    <ChevronRight className="h-3 w-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
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
                    <Button onClick={onGetStarted} variant="premium" size="lg" className="rounded-full px-8 h-14 text-lg shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:shadow-slate-900/20 transition-all transform hover:-translate-y-0.5 w-full sm:w-auto">
                        Start Researching Free <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <Button variant="secondary" size="lg" className="rounded-full px-8 h-14 text-lg bg-white/80 backdrop-blur border-slate-200 hover:bg-white hover:border-slate-300 w-full sm:w-auto group">
                        <PlayCircle className="mr-2 h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        View Interactive Demo
                    </Button>
                </div>
            </FadeIn>
            
            {/* Mock UI Interface */}
            <FadeIn delay={400} className="relative mx-auto max-w-5xl rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] overflow-hidden ring-1 ring-white/50">
                <div className="h-10 bg-white/50 border-b border-slate-200/50 flex items-center px-4 gap-2 justify-between">
                    <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-400/80"></div>
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/80"></div>
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80"></div>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Lock className="h-2 w-2" /> secure-session.ts
                    </div>
                </div>
                <div className="grid grid-cols-[240px_1fr] h-[460px] md:h-[500px]">
                    {/* Sidebar Mock */}
                    <div className="border-r border-slate-200/50 bg-slate-50/50 p-6 hidden md:flex flex-col gap-6 text-left">
                        <div className="h-8 w-32 bg-white border border-slate-200/50 rounded-lg shadow-sm"></div>
                        <div className="space-y-3 opacity-60 flex-1">
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-200/50 shadow-sm">
                                <div className="h-5 w-5 rounded bg-blue-100 flex items-center justify-center"><Search className="h-3 w-3 text-blue-500" /></div>
                                <div className="h-2 w-24 bg-slate-200 rounded"></div>
                            </div>
                            <div className="flex items-center gap-3 p-2 rounded-lg border border-transparent hover:bg-white hover:border-slate-100 transition-colors">
                                <div className="h-5 w-5 rounded bg-blue-100 flex items-center justify-center"><FileText className="h-3 w-3 text-blue-500" /></div>
                                <div className="h-2 w-20 bg-slate-200 rounded"></div>
                            </div>
                            <div className="flex items-center gap-3 p-2 rounded-lg border border-transparent hover:bg-white hover:border-slate-100 transition-colors">
                                <div className="h-5 w-5 rounded bg-purple-100 flex items-center justify-center"><Shield className="h-3 w-3 text-purple-500" /></div>
                                <div className="h-2 w-16 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-900 rounded-xl text-white">
                            <div className="h-2 w-12 bg-slate-700 rounded mb-2"></div>
                            <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full w-3/4 bg-blue-500 rounded-full"></div>
                            </div>
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
                                <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 shadow-sm">
                                    <Scale className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="space-y-4 max-w-lg text-left">
                                    <div className="p-5 rounded-2xl rounded-tl-sm bg-white border border-slate-100 text-sm text-slate-600 shadow-sm ring-1 ring-slate-900/5">
                                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-50">
                                            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                                            <span className="font-serif text-slate-900 font-medium text-xs">AI Reasoning Engine</span>
                                        </div>
                                        <p className="mb-3 font-serif text-slate-900 font-medium text-base">Key Jurisprudence Identified:</p>
                                        <p className="mb-4 leading-relaxed">
                                            The Federal Court has established that an officer's concern about a "mature student" must be rooted in evidence, not stereotypes (see <span className="font-semibold text-slate-800 border-b border-blue-200">Irimie</span>).
                                        </p>
                                        <div className="space-y-2">
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center hover:border-blue-300 hover:bg-[#f0f9ff] transition-all cursor-pointer group">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-6 w-6 rounded bg-white border border-slate-100 flex items-center justify-center shadow-sm text-xs font-serif font-bold text-slate-700">¶</div>
                                                    <span className="font-semibold text-slate-800 group-hover:text-blue-900 transition-colors">Irimie v. Canada</span>
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-1 rounded border border-slate-100 group-hover:border-blue-100">2000 CanLII 16688</span>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center hover:border-blue-300 hover:bg-[#f0f9ff] transition-all cursor-pointer group">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-6 w-6 rounded bg-white border border-slate-100 flex items-center justify-center shadow-sm text-xs font-serif font-bold text-slate-700">¶</div>
                                                    <span className="font-semibold text-slate-800 group-hover:text-blue-900 transition-colors">Momi v. Canada</span>
                                                </div>
                                                <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-1 rounded border border-slate-100 group-hover:border-blue-100">2013 FC 666</span>
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
      <section id="features" className="py-24 max-w-7xl mx-auto px-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-100/50 rounded-full blur-3xl -z-10 mix-blend-multiply"></div>
        
        <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 font-serif">Engineered for legal precision</h2>
            <p className="text-slate-500 text-lg leading-relaxed">Generic AI hallucinations can cost you a case. Our system is grounded in a verified database of Federal Court and Supreme Court decisions.</p>
        </FadeIn>
        
        <div className="grid md:grid-cols-3 md:grid-rows-2 gap-6 h-auto md:h-[600px]">
            {/* Feature 1 - Large Left */}
            <FadeIn delay={100} className="md:row-span-2 p-8 rounded-[2rem] bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-100/80 transition-colors duration-700"></div>
                <div className="relative z-10 h-full flex flex-col">
                    <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform duration-500 border border-blue-100">
                        <Search className="h-7 w-7" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4 font-serif">Semantic Case Search</h3>
                    <p className="text-slate-500 leading-relaxed mb-8 flex-1">
                        Don't just search for keywords. Find cases based on legal principles like "procedural fairness regarding extrinsic evidence" or "reasonableness of financial assessment".
                    </p>
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 mt-auto shadow-inner group-hover:bg-white group-hover:border-blue-100 transition-colors">
                        <div className="flex flex-wrap gap-2 mb-3">
                            <span className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shadow-sm"><Scale className="h-3 w-3" /> Dual Intent</span>
                            <span className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shadow-sm"><Globe className="h-3 w-3" /> H&C</span>
                            <span className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shadow-sm"><Shield className="h-3 w-3" /> Vavilov</span>
                        </div>
                        <div className="space-y-2">
                            <div className="h-2 w-full bg-slate-200/70 rounded-full group-hover:bg-blue-100 transition-colors"></div>
                            <div className="h-2 w-2/3 bg-slate-200/70 rounded-full group-hover:bg-blue-100 transition-colors"></div>
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
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
                            <Zap className="h-6 w-6 text-blue-400" />
                        </div>
                        <div className="px-3 py-1 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full uppercase tracking-wider border border-blue-500/30">
                            New
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">Instant IRAC Memos</h3>
                        <p className="text-slate-300 text-sm leading-relaxed">Generate structured Issue, Rule, Analysis, Conclusion memos ready for client files.</p>
                    </div>
                 </div>
            </FadeIn>

            {/* Feature 3 - Top Right */}
            <FadeIn delay={300} className="p-8 rounded-[2rem] bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-500 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-8 -mt-8 group-hover:bg-indigo-100 transition-colors duration-700"></div>
                <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="h-12 w-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 border border-indigo-100 group-hover:rotate-12 transition-transform duration-500">
                        <Shield className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Vavilov Risk Analysis</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">Upload refusal letters to identify weak officer reasoning instantly using AI-driven logic.</p>
                    </div>
                </div>
            </FadeIn>

            {/* Feature 4 - Wide Bottom */}
            <FadeIn delay={400} className="md:col-span-2 p-8 rounded-[2rem] bg-gradient-to-br from-slate-50 to-white border border-slate-200 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group hover:border-slate-300 transition-colors duration-500">
                <div className="flex-1 relative z-10">
                    <h3 className="text-2xl font-bold text-slate-900 mb-3 font-serif">Always Verified Citations</h3>
                    <p className="text-slate-600 leading-relaxed">Every claim is backed by a specific paragraph number. Click to verify the source instantly in our integrated reader.</p>
                    <div className="mt-6 flex gap-6 text-sm font-medium text-slate-700">
                        <span className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100 text-xs font-bold text-slate-600"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No hallucinations</span>
                        <span className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100 text-xs font-bold text-slate-600"><BookOpen className="h-4 w-4 text-blue-500" /> Live links</span>
                    </div>
                </div>
                <div className="w-full md:w-1/3 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200 p-5 transform rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-serif font-bold text-slate-700 shrink-0">¶</div>
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
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-4000"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
            <FadeIn className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold font-serif text-slate-900 mb-6">Transparent, predictable pricing</h2>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto font-light leading-relaxed">Start researching for free. Upgrade when you need the full power of AI drafting.</p>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
                {/* Starter Plan */}
                <FadeIn delay={100} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col hover:shadow-xl transition-shadow duration-300 relative group">
                    <div className="mb-6">
                        <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 text-slate-400 group-hover:scale-110 transition-transform">
                            <Search className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Starter</h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-slate-900">$0</span>
                            <span className="text-slate-500">/mo</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-4">Perfect for trying out the search capabilities.</p>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> 5 Case Searches / mo</li>
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Basic Filters</li>
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Federal Court DB Access</li>
                    </ul>
                    <Button variant="outline" className="w-full rounded-xl py-6 hover:border-slate-300 hover:bg-slate-50" onClick={onGetStarted}>Get Started</Button>
                </FadeIn>

                {/* Professional Plan */}
                <FadeIn delay={200} className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl flex flex-col relative overflow-hidden transform md:-translate-y-4 ring-1 ring-slate-800">
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl tracking-wider shadow-lg">POPULAR</div>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-800/50 via-slate-900 to-slate-900 pointer-events-none"></div>
                    
                    <div className="mb-6 relative z-10">
                        <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center mb-4 text-blue-400 backdrop-blur-sm border border-white/5">
                            <Zap className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">Professional</h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-white">$49</span>
                            <span className="text-slate-400">/mo</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-4">For solo practitioners and busy consultants.</p>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1 relative z-10">
                        <li className="flex items-center gap-3 text-sm text-slate-200"><Check className="h-4 w-4 text-blue-400 shrink-0" /> Unlimited Searches</li>
                        <li className="flex items-center gap-3 text-sm text-slate-200"><Check className="h-4 w-4 text-blue-400 shrink-0" /> AI Memo Drafting</li>
                        <li className="flex items-center gap-3 text-sm text-slate-200"><Check className="h-4 w-4 text-blue-400 shrink-0" /> Document Export (.docx)</li>
                        <li className="flex items-center gap-3 text-sm text-slate-200"><Check className="h-4 w-4 text-blue-400 shrink-0" /> Priority Support</li>
                    </ul>
                    <Button variant="premium" className="w-full rounded-xl py-6 bg-gradient-to-r from-blue-600 to-indigo-600 border-none hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-900/20 relative z-10" onClick={onGetStarted}>
                        Start Free Trial
                    </Button>
                </FadeIn>

                {/* Firm Plan */}
                <FadeIn delay={300} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col hover:shadow-xl transition-shadow duration-300 relative group">
                    <div className="mb-6">
                        <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 text-slate-400 group-hover:scale-110 transition-transform">
                            <Landmark className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Firm</h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-slate-900">Custom</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-4">For larger teams requiring control & security.</p>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400 shrink-0" /> Everything in Pro</li>
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400 shrink-0" /> SSO / SAML Integration</li>
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400 shrink-0" /> Centralized Billing</li>
                        <li className="flex items-center gap-3 text-sm text-slate-700"><Check className="h-4 w-4 text-slate-400 shrink-0" /> Dedicated Account Mgr</li>
                    </ul>
                    <Button variant="outline" className="w-full rounded-xl py-6 hover:border-slate-300 hover:bg-slate-50" onClick={() => window.location.href = 'mailto:sales@example.com'}>Contact Sales</Button>
                </FadeIn>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-300 py-16 px-6 relative overflow-hidden">
        {/* Footer Background Noise */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent opacity-20"></div>
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12 relative z-10">
            <div className="space-y-6 max-w-xs">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-lg shadow-white/5">
                        <Scale className="h-5 w-5 text-slate-950" />
                    </div>
                    <span className="font-bold text-white text-xl font-serif tracking-tight">RCIC Assistant</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed font-light">
                    Empowering immigration professionals with next-generation legal intelligence. Built securely in Canada.
                </p>
                <div className="flex gap-4">
                    {/* Social Placeholders */}
                    <div className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-700">
                        <span className="sr-only">LinkedIn</span>
                        <svg className="h-4 w-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-700">
                        <span className="sr-only">Twitter</span>
                        <svg className="h-4 w-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                    </div>
                </div>
            </div>
            
            <div className="flex gap-20 text-sm">
                <div className="space-y-6">
                    <h4 className="font-bold text-white tracking-wide uppercase text-xs">Product</h4>
                    <a href="#" className="block hover:text-white transition-colors text-slate-400">Features</a>
                    <a href="#" className="block hover:text-white transition-colors text-slate-400">Pricing</a>
                    <a href="#" className="block hover:text-white transition-colors text-slate-400">Case Law DB</a>
                </div>
                <div className="space-y-6">
                    <h4 className="font-bold text-white tracking-wide uppercase text-xs">Company</h4>
                    <a href="#" className="block hover:text-white transition-colors text-slate-400">About</a>
                    <a href="#" className="block hover:text-white transition-colors text-slate-400">Security</a>
                    <a href="#" className="block hover:text-white transition-colors text-slate-400">Contact</a>
                </div>
            </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4 relative z-10">
            <span>© 2024 LegalTech Solutions Inc. All rights reserved.</span>
            <div className="flex gap-6">
                <button onClick={() => onNavigate('terms')} className="hover:text-slate-300 transition-colors">Terms of Service</button>
                <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            </div>
        </div>
      </footer>
    </div>
  );
};
