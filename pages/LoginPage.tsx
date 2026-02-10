import React, { useState } from 'react';
import { Scale, ArrowLeft, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button, Input } from '../components/ui/Generic';

interface LoginPageProps {
  onLogin: () => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onBack }) => {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSimulatedLogin = (provider: string) => {
    setIsLoading(provider);
    // Simulate API network delay
    setTimeout(() => {
      setIsLoading(null);
      onLogin();
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full flex font-sans selection:bg-amber-100 selection:text-amber-900">
      
      {/* Left Panel - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-[#0f172a] relative overflow-hidden flex-col justify-between p-16 text-white border-r border-slate-800">
        {/* Animated Background */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full mix-blend-screen filter blur-[80px] animate-blob animation-delay-2000"></div>
        
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
                <div className="bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/10">
                    <Scale className="h-6 w-6 text-white" />
                </div>
                <span className="font-bold text-2xl font-serif tracking-tight">RCIC Assistant</span>
            </div>
            
            <h2 className="text-5xl font-bold font-serif leading-tight mb-6">
                Master your <br/>
                immigration cases.
            </h2>
            <p className="text-lg text-slate-400 max-w-md leading-relaxed">
                Join thousands of regulated consultants using AI to draft cleaner submissions and find better case law in less time.
            </p>
        </div>

        <div className="relative z-10 space-y-6">
            <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
                <div className="flex gap-1 mb-4">
                     {[1,2,3,4,5].map(i => (
                         <svg key={i} className="w-5 h-5 text-amber-400 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                     ))}
                </div>
                <p className="text-slate-200 italic font-serif text-lg mb-4">"The semantic search is a game changer. I found a specific H&C precedent regarding 'best interests of the child' that saved my client's application."</p>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center font-bold text-white">S</div>
                    <div>
                        <p className="font-bold text-sm">Sarah Jenkins, RCIC</p>
                        <p className="text-xs text-slate-400">Toronto, ON</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4" /> Bank-level security & PIPEDA compliant
            </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center items-center px-8 md:px-24 relative">
         <button 
            onClick={onBack}
            className="absolute top-8 left-8 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
         >
            <ArrowLeft className="h-4 w-4" /> Back to home
         </button>

         <div className="w-full max-w-md space-y-8">
             <div className="text-center">
                 <div className="inline-block lg:hidden bg-slate-900 p-2 rounded-lg mb-6">
                    <Scale className="h-6 w-6 text-white" />
                 </div>
                 <h2 className="text-3xl font-bold text-slate-900 font-serif">Welcome back</h2>
                 <p className="text-slate-500 mt-2">Sign in to your professional workspace</p>
             </div>

             <div className="space-y-4">
                 <Button 
                    variant="outline" 
                    className="w-full h-12 text-base font-normal text-slate-700 hover:bg-slate-50 relative group"
                    onClick={() => handleSimulatedLogin('google')}
                    disabled={!!isLoading}
                 >
                    {isLoading === 'google' ? (
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : (
                        <>
                            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </>
                    )}
                 </Button>

                 <Button 
                    variant="outline" 
                    className="w-full h-12 text-base font-normal text-slate-700 hover:bg-slate-50"
                    onClick={() => handleSimulatedLogin('microsoft')}
                    disabled={!!isLoading}
                 >
                    {isLoading === 'microsoft' ? (
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : (
                        <>
                            <svg className="w-5 h-5 mr-3" viewBox="0 0 21 21">
                                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                            </svg>
                            Continue with Microsoft
                        </>
                    )}
                 </Button>
             </div>

             <div className="relative">
                 <div className="absolute inset-0 flex items-center">
                     <span className="w-full border-t border-slate-200"></span>
                 </div>
                 <div className="relative flex justify-center text-xs uppercase">
                     <span className="bg-white px-2 text-slate-400 font-medium">Or continue with email</span>
                 </div>
             </div>

             <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSimulatedLogin('email'); }}>
                 <div className="space-y-2">
                     <label className="text-sm font-medium text-slate-700">Work Email</label>
                     <Input placeholder="name@company.com" type="email" required className="h-12" />
                 </div>
                 <div className="space-y-2">
                     <div className="flex justify-between">
                        <label className="text-sm font-medium text-slate-700">Password</label>
                        <a href="#" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Forgot?</a>
                     </div>
                     <Input placeholder="••••••••" type="password" required className="h-12" />
                 </div>
                 <Button 
                    type="submit" 
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-lg shadow-xl shadow-slate-900/10"
                    disabled={!!isLoading}
                 >
                    {isLoading === 'email' ? <Loader2 className="animate-spin" /> : 'Sign In'}
                 </Button>
             </form>

             <p className="text-center text-sm text-slate-500">
                 Don't have an account? <a href="#" className="text-blue-600 font-semibold hover:underline">Sign up for a free trial</a>
             </p>
         </div>

         {/* Footer Links */}
         <div className="absolute bottom-6 flex gap-6 text-xs text-slate-400">
             <a href="#" className="hover:text-slate-600">Privacy Policy</a>
             <a href="#" className="hover:text-slate-600">Terms of Service</a>
             <a href="#" className="hover:text-slate-600">Help Center</a>
         </div>
      </div>
    </div>
  );
};