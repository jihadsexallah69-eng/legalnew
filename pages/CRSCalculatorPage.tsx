import React, { useState, useMemo, useEffect } from 'react';
import { Card, Button, Badge } from '../components/ui/Generic';
import { 
  Calculator, Info, ChevronDown, ChevronUp, Check, X, 
  User, Users, GraduationCap, Languages, Briefcase, Award, 
  ArrowRight, Sparkles, TrendingUp, AlertCircle, HelpCircle 
} from 'lucide-react';
import { cn } from '../lib/cn';

// --- Types & Constants (Logic Preserved) ---

interface CRSInput {
  hasSpouse: boolean;
  age: number;
  educationLevel: string;
  clbReading: number;
  clbWriting: number;
  clbSpeaking: number;
  clbListening: number;
  canadianWorkExperience: number;
  foreignWorkExperience: number;
  spouseEducationLevel: string;
  spouseClbReading: number;
  spouseClbWriting: number;
  spouseClbSpeaking: number;
  spouseClbListening: number;
  spouseCanWorkExperience: number;
  hasProvincialNomination: boolean;
  hasArrangedEmployment: boolean;
  arrangedEmploymentType: 'standard' | 'noc00';
  canadianEducation: string;
  frenchClb: number;
  hasSiblingInCanada: boolean;
}

const CRS_VERSION = 'MI-2026-01-15';

const AGE_POINTS_SINGLE: Record<number, number> = {
  17: 0, 18: 99, 19: 105, 20: 110, 21: 110, 22: 110, 23: 110, 24: 110, 25: 110, 26: 110, 27: 110, 28: 110, 29: 110,
  30: 105, 31: 99, 32: 94, 33: 88, 34: 83, 35: 77, 36: 72, 37: 66, 38: 61, 39: 55, 40: 50, 41: 39, 42: 28, 43: 17, 44: 6, 45: 0
};
const AGE_POINTS_SPOUSE: Record<number, number> = {
  17: 0, 18: 90, 19: 95, 20: 100, 21: 100, 22: 100, 23: 100, 24: 100, 25: 100, 26: 100, 27: 100, 28: 100, 29: 100,
  30: 95, 31: 90, 32: 85, 33: 80, 34: 75, 35: 70, 36: 65, 37: 60, 38: 55, 39: 50, 40: 45, 41: 35, 42: 25, 43: 15, 44: 5, 45: 0
};
const EDUCATION_POINTS_SINGLE: Record<string, number> = {
  'none': 0, 'secondary': 30, '1-year': 90, '2-year': 98, 'bachelor': 120, 'two-plus': 128, 'masters': 135, 'professional': 135, 'phd': 150
};
const EDUCATION_POINTS_SPOUSE: Record<string, number> = {
  'none': 0, 'secondary': 28, '1-year': 84, '2-year': 91, 'bachelor': 112, 'two-plus': 119, 'masters': 126, 'professional': 126, 'phd': 140
};
const CLB_POINTS_SINGLE: Record<number, number> = {
  4: 0, 5: 6, 6: 9, 7: 16, 8: 22, 9: 31, 10: 34, 11: 34, 12: 34
};
const CLB_POINTS_SPOUSE: Record<number, number> = {
  4: 0, 5: 6, 6: 8, 7: 15, 8: 20, 9: 29, 10: 32, 11: 32, 12: 32
};
const CANADIAN_WORK_POINTS_SINGLE: Record<number, number> = {
  0: 0, 1: 40, 2: 53, 3: 64, 4: 72, 5: 80
};
const CANADIAN_WORK_POINTS_SPOUSE: Record<number, number> = {
  0: 0, 1: 35, 2: 46, 3: 56, 4: 63, 5: 70
};
const CANADIAN_EDUCATION_POINTS: Record<string, number> = {
  'none': 0, '1-year': 15, '2-year': 15, 'bachelor': 15, '2-plus': 15, 'masters': 15, 'phd': 30
};

function getClbPoints(clb: number, isSpouse: boolean): number {
  const table = isSpouse ? CLB_POINTS_SPOUSE : CLB_POINTS_SINGLE;
  return table[clb] ?? 0;
}
function getAgePoints(age: number, hasSpouse: boolean): number {
  const table = hasSpouse ? AGE_POINTS_SPOUSE : AGE_POINTS_SINGLE;
  if (age < 18) return 0;
  if (age > 45) return 0;
  return table[age] ?? 0;
}
function getEducationPoints(level: string, hasSpouse: boolean): number {
  const table = hasSpouse ? EDUCATION_POINTS_SPOUSE : EDUCATION_POINTS_SINGLE;
  return table[level] ?? 0;
}
function getCanadianWorkPoints(years: number, hasSpouse: boolean): number {
  const table = hasSpouse ? CANADIAN_WORK_POINTS_SPOUSE : CANADIAN_WORK_POINTS_SINGLE;
  const yearsCapped = Math.min(Math.max(years, 0), 5);
  return table[yearsCapped] ?? 0;
}
function getTransferabilityPoints(educationLevel: string, clb: number, canadianWork: number, foreignWork: number, isSpouse: boolean): number {
  let points = 0;
  const highEducation = ['masters', 'professional', 'phd', 'two-plus'].includes(educationLevel);
  const clb9Plus = clb >= 9;
  
  if (highEducation && clb9Plus) points += 50;
  if (highEducation && canadianWork >= 1) points += 50;
  
  if (foreignWork >= 3 && clb9Plus) points += 50;
  if (foreignWork >= 3 && canadianWork >= 1) points += 50;
  
  return Math.min(points, 100);
}
function getSpouseEducationPoints(level: string): number {
  if (level === 'none' || !level) return 0;
  const table: Record<string, number> = {
    'secondary': 2, '1-year': 6, '2-year': 7, 'bachelor': 8, 'two-plus': 9, 'masters': 10, 'professional': 10, 'phd': 10
  };
  return table[level] ?? 0;
}
function getSpouseLanguagePoints(r: number, w: number, s: number, l: number): number {
  const getPoints = (clb: number) => {
    if (clb >= 9) return 5;
    if (clb >= 7) return 4;
    if (clb >= 6) return 3;
    if (clb >= 5) return 2;
    if (clb >= 4) return 1;
    return 0;
  };
  return getPoints(r) + getPoints(w) + getPoints(s) + getPoints(l);
}
function getSpouseCanadianWorkPoints(years: number): number {
  if (years >= 1) return 10;
  return 0;
}

interface ScoreBreakdown {
  category: string;
  points: number;
  max: number;
  details: string[];
}

function calculateCRS(input: CRSInput): { total: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];
  
  const agePoints = getAgePoints(input.age, input.hasSpouse);
  breakdown.push({ category: 'Age', points: agePoints, max: input.hasSpouse ? 100 : 110, details: [`Age: ${input.age} years${input.hasSpouse ? ' (with spouse)' : ''}`] });
  
  const educationPoints = getEducationPoints(input.educationLevel, input.hasSpouse);
  breakdown.push({ category: 'Education', points: educationPoints, max: input.hasSpouse ? 140 : 150, details: [`Level: ${input.educationLevel}`] });
  
  const minClb = Math.min(input.clbReading, input.clbWriting, input.clbSpeaking, input.clbListening);
  const languagePoints = input.hasSpouse
    ? getClbPoints(input.clbReading, true) + getClbPoints(input.clbWriting, true) + getClbPoints(input.clbSpeaking, true) + getClbPoints(input.clbListening, true)
    : getClbPoints(input.clbReading, false) + getClbPoints(input.clbWriting, false) + getClbPoints(input.clbSpeaking, false) + getClbPoints(input.clbListening, false);
  breakdown.push({ category: 'First Official Language', points: languagePoints, max: input.hasSpouse ? 128 : 136, details: [`CLB: ${minClb} (lowest ability)`] });
  
  const canWorkPoints = getCanadianWorkPoints(input.canadianWorkExperience, input.hasSpouse);
  breakdown.push({ category: 'Canadian Work Experience', points: canWorkPoints, max: input.hasSpouse ? 70 : 80, details: [`${input.canadianWorkExperience} year(s)`] });
  
  let coreTotal = agePoints + educationPoints + languagePoints + canWorkPoints;
  
  let spouseTotal = 0;
  if (input.hasSpouse) {
    const spEduPoints = getSpouseEducationPoints(input.spouseEducationLevel);
    const spLangPoints = getSpouseLanguagePoints(input.spouseClbReading, input.spouseClbWriting, input.spouseClbSpeaking, input.spouseClbListening);
    const spWorkPoints = getSpouseCanadianWorkPoints(input.spouseCanWorkExperience);
    spouseTotal = spEduPoints + spLangPoints + spWorkPoints;
    breakdown.push({ category: 'Spouse Factors', points: spouseTotal, max: 40, details: [`Edu: ${spEduPoints}, Lang: ${spLangPoints}, Work: ${spWorkPoints}`] });
  }
  
  const transferPoints = getTransferabilityPoints(input.educationLevel, minClb, input.canadianWorkExperience, input.foreignWorkExperience, input.hasSpouse);
  breakdown.push({ category: 'Skill Transferability', points: transferPoints, max: 100, details: [`Education+CLB/CanWork: ${Math.min(50, (['masters','professional','phd','two-plus'].includes(input.educationLevel) ? (minClb >= 9 ? 50 : 0) + (input.canadianWorkExperience >= 1 ? 50 : 0) : 0))}, Foreign+CLB/CanWork: ${Math.min(50, (input.foreignWorkExperience >= 3 ? (minClb >= 9 ? 50 : 0) + (input.canadianWorkExperience >= 1 ? 50 : 0) : 0))}`] });
  
  let additionalPoints = 0;
  const additionalDetails: string[] = [];
  
  if (input.hasProvincialNomination) {
    additionalPoints += 600;
    additionalDetails.push('Provincial Nomination (+600)');
  }
  
  if (input.hasArrangedEmployment) {
    additionalDetails.push('Arranged Employment (TEMPORARILY SUSPENDED as of Mar 2025 - 0 pts)');
  }
  
  const canEduPoints = CANADIAN_EDUCATION_POINTS[input.canadianEducation] || 0;
  if (canEduPoints > 0) {
    additionalPoints += canEduPoints;
    additionalDetails.push(`Canadian Education (+${canEduPoints})`);
  }
  
  if (input.frenchClb >= 7) {
    const hasEnglishClb5 = minClb >= 5;
    const frenchBonus = input.frenchClb >= 7 && hasEnglishClb5 ? 50 : input.frenchClb >= 7 ? 25 : 0;
    if (frenchBonus > 0) {
      additionalPoints += frenchBonus;
      additionalDetails.push(`French Proficiency (+${frenchBonus})`);
    }
  }
  
  if (input.hasSiblingInCanada) {
    additionalPoints += 15;
    additionalDetails.push('Sibling in Canada (+15)');
  }
  
  if (additionalDetails.length > 0) {
    breakdown.push({ category: 'Additional Points', points: additionalPoints, max: 600, details: additionalDetails });
  }
  
  const total = coreTotal + spouseTotal + transferPoints + additionalPoints;
  
  return { total, breakdown };
}

// --- Enhanced UI Components ---

const Gauge: React.FC<{ value: number; max: number }> = ({ value, max }) => {
  const percentage = Math.round((value / max) * 100);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  // Dynamic color based on competitive thresholds
  const getColor = (s: number) => {
      if (s >= 500) return "text-emerald-500 drop-shadow-emerald";
      if (s >= 470) return "text-indigo-500 drop-shadow-indigo";
      return "text-amber-500 drop-shadow-amber";
  }
  
  const getGradientId = (s: number) => {
      if (s >= 500) return "grad-emerald";
      if (s >= 470) return "grad-indigo";
      return "grad-amber";
  }

  return (
    <div className="relative w-48 h-48 flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <defs>
                <linearGradient id="grad-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="grad-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
                <linearGradient id="grad-amber" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
            </defs>
            {/* Background Track */}
            <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100 dark:text-slate-800" />
            {/* Progress Arc */}
            <circle 
                cx="60" cy="60" r="50" fill="none" 
                stroke={`url(#${getGradientId(value)})`} 
                strokeWidth="8" 
                strokeDasharray={circumference} 
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out shadow-lg"
            />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-5xl font-black tracking-tighter transition-colors drop-shadow-sm", getColor(value))}>{value}</span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">CRS Score</span>
        </div>
    </div>
  )
}

const SectionHeader: React.FC<{ 
  icon: React.ElementType, 
  title: string, 
  subtitle?: string, 
  isOpen: boolean, 
  onClick: () => void,
  score?: number
}> = ({ icon: Icon, title, subtitle, isOpen, onClick, score }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center justify-between p-5 transition-all duration-300 group relative overflow-hidden",
      isOpen ? "bg-white dark:bg-slate-900" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/80 bg-white dark:bg-slate-900"
    )}
  >
    <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 transition-all duration-300",
        isOpen ? "opacity-100" : "opacity-0"
    )} />
    
    <div className="flex items-center gap-5 text-left z-10">
      <div className={cn(
        "h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm",
        isOpen 
            ? "bg-indigo-600 text-white shadow-indigo-200" 
            : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 group-hover:border-indigo-200 dark:group-hover:border-indigo-800 group-hover:text-indigo-500 dark:group-hover:text-indigo-400"
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className={cn("font-bold text-lg tracking-tight", isOpen ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300")}>{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">{subtitle}</p>}
      </div>
    </div>
    
    <div className="flex items-center gap-5 z-10">
      {score !== undefined && (
         <div className={cn(
             "flex flex-col items-end transition-all duration-300",
             isOpen ? "opacity-0 translate-x-4" : "opacity-100"
         )}>
             <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{score} pts</span>
             <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase">Subtotal</span>
         </div>
      )}
      <div className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300",
          isOpen ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rotate-180" : "bg-transparent text-slate-300 dark:text-slate-600"
      )}>
        <ChevronDown className="h-5 w-5" />
      </div>
    </div>
  </button>
);

const RadioCard: React.FC<{ 
  selected: boolean, 
  label: string, 
  description?: string, 
  onClick: () => void 
}> = ({ selected, label, description, onClick }) => (
  <div 
    onClick={onClick}
    className={cn(
      "relative flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group hover:shadow-md",
      selected 
        ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-900/20 ring-0" 
        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
    )}
  >
    <div className={cn(
      "h-5 w-5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors",
      selected ? "border-indigo-600 bg-indigo-600" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-indigo-300 dark:group-hover:border-indigo-500"
    )}>
      {selected && <Check className="h-3 w-3 text-white" />}
    </div>
    <div>
      <div className={cn("text-sm font-bold", selected ? "text-indigo-900 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300")}>{label}</div>
      {description && <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{description}</div>}
    </div>
  </div>
);

const Select: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }> = ({ value, onChange, options, className }) => (
  <div className={cn("relative group", className)}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-12 pl-4 pr-10 appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer shadow-sm"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
        <ChevronDown className="h-4 w-4" />
    </div>
  </div>
);

const NumberSelect: React.FC<{ value: number; onChange: (v: number) => void; min: number; max: number; label?: string; className?: string }> = ({ value, onChange, min, max, label, className }) => (
  <div className={cn("relative group", className)}>
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-12 pl-4 pr-10 appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer shadow-sm"
    >
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(n => <option key={n} value={n}>{label ? `${n} ${label}` : n}</option>)}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
        <ChevronDown className="h-4 w-4" />
    </div>
  </div>
);

const Label: React.FC<{ children: React.ReactNode; className?: string; icon?: React.ElementType }> = ({ children, className, icon: Icon }) => (
  <label className={cn("flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 ml-1", className)}>
    {Icon && <Icon className="h-3.5 w-3.5" />}
    {children}
  </label>
);

const ResultRow: React.FC<{ label: string; value: number; max: number; color?: string }> = ({ label, value, max, color = "bg-indigo-500" }) => (
    <div className="group">
        <div className="flex justify-between items-end mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
            <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">/ {max}</span>
            </div>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
                className={cn("h-full rounded-full transition-all duration-1000 ease-out", color)}
                style={{ width: `${(value / max) * 100}%` }} 
            />
        </div>
    </div>
);

// --- Main Page Component ---

export const CRSCalculatorPage = () => {
  const [expanded, setExpanded] = useState<string | null>('core');
  
  const [input, setInput] = useState<CRSInput>({
    hasSpouse: false,
    age: 29,
    educationLevel: 'bachelor',
    clbReading: 9,
    clbWriting: 9,
    clbSpeaking: 9,
    clbListening: 9,
    canadianWorkExperience: 1,
    foreignWorkExperience: 0,
    spouseEducationLevel: 'none',
    spouseClbReading: 0,
    spouseClbWriting: 0,
    spouseClbSpeaking: 0,
    spouseClbListening: 0,
    spouseCanWorkExperience: 0,
    hasProvincialNomination: false,
    hasArrangedEmployment: false,
    arrangedEmploymentType: 'standard',
    canadianEducation: 'none',
    frenchClb: 0,
    hasSiblingInCanada: false,
  });

  const result = useMemo(() => calculateCRS(input), [input]);

  const updateInput = (field: keyof CRSInput, value: any) => {
    setInput(prev => ({ ...prev, [field]: value }));
  };

  // Pre-computed section scores for headers
  const sectionScores = useMemo(() => {
    const getScore = (cat: string) => result.breakdown.filter(b => b.category === cat).reduce((acc, curr) => acc + curr.points, 0);
    const core = 
        getScore('Age') + 
        getScore('Education') + 
        getScore('First Official Language') + 
        getScore('Canadian Work Experience');
    const spouse = getScore('Spouse Factors');
    const skills = getScore('Skill Transferability');
    const additional = getScore('Additional Points');
    return { core, spouse, skills, additional };
  }, [result]);

  const eduOptions = [
    { value: 'none', label: 'None / Less than secondary' },
    { value: 'secondary', label: 'Secondary diploma (High School)' },
    { value: '1-year', label: 'One-year program at college/uni' },
    { value: '2-year', label: 'Two-year program at college/uni' },
    { value: 'bachelor', label: "Bachelor's degree (3+ years)" },
    { value: 'two-plus', label: 'Two or more certificates (one 3+ years)' },
    { value: 'masters', label: "Master's degree" },
    { value: 'professional', label: 'Professional degree (Law, Medicine)' },
    { value: 'phd', label: 'Doctoral level (PhD)' },
  ];

  const clbOptions = [
    { value: 0, label: 'Not assessed / Low' },
    { value: 4, label: 'CLB 4' },
    { value: 5, label: 'CLB 5' },
    { value: 6, label: 'CLB 6' },
    { value: 7, label: 'CLB 7 (Adequate)' },
    { value: 8, label: 'CLB 8 (Good)' },
    { value: 9, label: 'CLB 9 (Advanced)' },
    { value: 10, label: 'CLB 10 (Superior)' },
  ];

  const canEduOptions = [
    { value: 'none', label: 'No Canadian education' },
    { value: '1-year', label: '1 or 2 year diploma/certificate' },
    { value: 'bachelor', label: "Degree of 3+ years" },
    { value: 'masters', label: "Master's / Professional / PhD" },
  ];

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden transition-colors">
      
      {/* --- Main Content Form --- */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-4xl mx-auto p-6 lg:p-10 pb-32">
          
          <div className="mb-10 animate-in slide-in-from-top-4 duration-500">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-full text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
                <Sparkles className="h-3 w-3" />
                AI-Ready Calculator
             </div>
             <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-3">CRS Calculator</h1>
             <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
               Accurate estimation based on the latest Ministerial Instructions ({CRS_VERSION}).
             </p>
          </div>

          <div className="space-y-6">
            
            {/* Core Human Capital */}
            <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/30 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <SectionHeader 
                icon={User} 
                title="Core Human Capital" 
                subtitle="Age, education, language, and Canadian experience"
                isOpen={expanded === 'core'} 
                onClick={() => setExpanded(expanded === 'core' ? null : 'core')}
                score={sectionScores.core}
              />
              
              {expanded === 'core' && (
                <div className="p-8 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                       <div>
                         <Label icon={Users}>Marital Status</Label>
                         <div className="grid grid-cols-2 gap-4">
                           <RadioCard 
                             selected={!input.hasSpouse} 
                             label="Single" 
                             onClick={() => updateInput('hasSpouse', false)} 
                           />
                           <RadioCard 
                             selected={input.hasSpouse} 
                             label="Married" 
                             description="With spouse"
                             onClick={() => updateInput('hasSpouse', true)} 
                           />
                         </div>
                       </div>
                       
                       <div>
                         <Label icon={User}>Age</Label>
                         <NumberSelect value={input.age} onChange={(v) => updateInput('age', v)} min={17} max={45} label="years old" />
                       </div>
                    </div>

                    <div className="space-y-8">
                       <div>
                          <Label icon={GraduationCap}>Education Level</Label>
                          <Select value={input.educationLevel} onChange={(v) => updateInput('educationLevel', v)} options={eduOptions} />
                        </div>
                        <div>
                          <Label icon={Briefcase}>Canadian Work Experience</Label>
                          <NumberSelect value={input.canadianWorkExperience} onChange={(v) => updateInput('canadianWorkExperience', v)} min={0} max={5} label="years" />
                        </div>
                        <div>
                          <Label icon={Briefcase}>Foreign Work Experience</Label>
                          <NumberSelect value={input.foreignWorkExperience} onChange={(v) => updateInput('foreignWorkExperience', v)} min={0} max={10} label="years" />
                        </div>
                     </div>
                  </div>

                  <div className="mt-10 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center justify-between mb-6">
                        <Label icon={Languages} className="mb-0">First Official Language (English)</Label>
                        <Badge variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-300">CLB Level</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(['Reading', 'Writing', 'Speaking', 'Listening'] as const).map((ability) => {
                        const key = `clb${ability.charAt(0).toLowerCase() + ability.slice(1)}` as 'clbReading' | 'clbWriting' | 'clbSpeaking' | 'clbListening';
                        return (
                          <div key={ability}>
                            <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 mb-2 ml-1">{ability}</span>
                            <Select
                              value={String(input[key])}
                              onChange={(v) => updateInput(key, Number(v))}
                              options={clbOptions}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Spouse Factors */}
            {input.hasSpouse && (
              <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/30 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 animate-in slide-in-from-bottom-2">
                <SectionHeader 
                  icon={Users} 
                  title="Spouse Factors" 
                  subtitle="Education, language, and work experience"
                  isOpen={expanded === 'spouse'} 
                  onClick={() => setExpanded(expanded === 'spouse' ? null : 'spouse')}
                  score={sectionScores.spouse}
                />
                
                {expanded === 'spouse' && (
                  <div className="p-8 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                      <div>
                        <Label icon={GraduationCap}>Spouse's Education</Label>
                        <Select value={input.spouseEducationLevel} onChange={(v) => updateInput('spouseEducationLevel', v)} options={eduOptions} />
                      </div>
                      <div>
                        <Label icon={Briefcase}>Spouse's Canadian Work</Label>
                        <NumberSelect value={input.spouseCanWorkExperience} onChange={(v) => updateInput('spouseCanWorkExperience', v)} min={0} max={5} label="years" />
                      </div>
                    </div>

                    <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60">
                       <Label icon={Languages} className="mb-6">Spouse's Language Proficiency</Label>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(['Reading', 'Writing', 'Speaking', 'Listening'] as const).map((ability) => {
                          const key = `spouseClb${ability.charAt(0).toLowerCase() + ability.slice(1)}` as 'spouseClbReading' | 'spouseClbWriting' | 'spouseClbSpeaking' | 'spouseClbListening';
                          return (
                            <div key={ability}>
                              <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 mb-2 ml-1">{ability}</span>
                              <Select
                                value={String(input[key])}
                                onChange={(v) => updateInput(key, Number(v))}
                                options={clbOptions}
                              />
                            </div>
                          );
                        })}
                       </div>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Additional Points */}
            <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/30 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <SectionHeader 
                icon={Award} 
                title="Additional Points" 
                subtitle="PNP, job offers, and other bonuses"
                isOpen={expanded === 'additional'} 
                onClick={() => setExpanded(expanded === 'additional' ? null : 'additional')}
                score={sectionScores.additional}
              />
              
              {expanded === 'additional' && (
                <div className="p-8 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div>
                        <Label>Provincial Nomination</Label>
                        <div className="grid grid-cols-2 gap-4">
                           <RadioCard selected={!input.hasProvincialNomination} label="No" onClick={() => updateInput('hasProvincialNomination', false)} />
                           <RadioCard selected={input.hasProvincialNomination} label="Yes" description="+600 points" onClick={() => updateInput('hasProvincialNomination', true)} />
                        </div>
                      </div>

                      <div>
                        <Label>Job Offer (LMIA)</Label>
                        <div className="grid grid-cols-2 gap-4">
                           <RadioCard 
                              selected={!input.hasArrangedEmployment} 
                              label="No Offer" 
                              onClick={() => {
                                updateInput('hasArrangedEmployment', false);
                                updateInput('arrangedEmploymentType', 'standard');
                              }} 
                            />
                           <RadioCard 
                              selected={input.hasArrangedEmployment} 
                              label="Valid Offer" 
                              onClick={() => updateInput('hasArrangedEmployment', true)} 
                            />
                        </div>
                        
                        {input.hasArrangedEmployment && (
                          <div className="mt-4 animate-in fade-in zoom-in-95">
                            <Label className="text-slate-400 dark:text-slate-500">NOC TEER Category</Label>
                            <Select
                              value={input.arrangedEmploymentType}
                              onChange={(v) => updateInput('arrangedEmploymentType', v as 'standard' | 'noc00')}
                              options={[
                                { value: 'standard', label: 'TEER 0, 1, 2, 3 (+50 pts)' },
                                { value: 'noc00', label: 'TEER 0 Major Group 00 (+200 pts)' },
                              ]}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-8">
                        <div>
                           <Label>Canadian Education</Label>
                           <Select value={input.canadianEducation} onChange={(v) => updateInput('canadianEducation', v)} options={canEduOptions} />
                        </div>

                        <div>
                           <Label>French Proficiency</Label>
                           <Select
                              value={String(input.frenchClb)}
                              onChange={(v) => updateInput('frenchClb', Number(v))}
                              options={[{ value: '0', label: 'None or below CLB 7' }, ...clbOptions.slice(4)]}
                            />
                        </div>
                        
                        <div>
                           <Label>Sibling in Canada</Label>
                           <div className="grid grid-cols-2 gap-4">
                             <RadioCard selected={!input.hasSiblingInCanada} label="No" onClick={() => updateInput('hasSiblingInCanada', false)} />
                             <RadioCard selected={input.hasSiblingInCanada} label="Yes" description="Citizen/PR (+15)" onClick={() => updateInput('hasSiblingInCanada', true)} />
                           </div>
                        </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-8">
               <HelpCircle className="h-3 w-3" />
               <span>Need help? Ask the AI Assistant for clarification on any factor.</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- Sticky Results Panel (Right Side) --- */}
      <div className="w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200/60 dark:border-slate-800 shadow-2xl z-20 flex flex-col hidden xl:flex relative transition-colors">
         <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500" />
         
         <div className="p-8 flex-1 overflow-y-auto no-scrollbar">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-8 flex items-center gap-2">
                <Calculator className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Score Breakdown
            </h2>
            
            <div className="flex justify-center mb-10 py-4">
               <Gauge value={result.total} max={1200} />
            </div>

            <div className="space-y-6 mb-10">
               <ResultRow 
                 label="Human Capital" 
                 value={sectionScores.core} 
                 max={input.hasSpouse ? 460 : 500} 
                 color="bg-indigo-500" 
               />
               <ResultRow 
                 label="Spouse Factors" 
                 value={sectionScores.spouse} 
                 max={40} 
                 color="bg-purple-500" 
               />
               <ResultRow 
                 label="Skill Transferability" 
                 value={sectionScores.skills} 
                 max={100} 
                 color="bg-emerald-500" 
               />
               <ResultRow 
                 label="Additional Points" 
                 value={sectionScores.additional} 
                 max={600} 
                 color="bg-amber-500" 
               />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
               <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Analysis</h3>
               </div>
               
               <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                     <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Recent Cutoff</span>
                     <span className="text-sm font-bold text-slate-900 dark:text-slate-100">525</span>
                  </div>

                  <div 
                    className={cn(
                        "p-4 rounded-xl text-sm border transition-colors duration-300",
                        result.total >= 525 
                            ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                            : result.total >= 470 
                                ? "bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    )}
                  >
                      {result.total >= 525 ? (
                         <div className="flex gap-3">
                            <Check className="h-5 w-5 shrink-0" />
                            <span><strong>Excellent Score!</strong> You are highly likely to receive an invitation in the next general draw.</span>
                         </div>
                      ) : result.total >= 470 ? (
                         <div className="flex gap-3">
                            <Sparkles className="h-5 w-5 shrink-0" />
                            <span><strong>Good Score.</strong> You are competitive for category-based draws (STEM, Healthcare) or PNP.</span>
                         </div>
                      ) : (
                         <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <span><strong>Improvement Needed.</strong> Consider retaking language tests or obtaining a provincial nomination.</span>
                         </div>
                      )}
                  </div>
               </div>
            </div>
         </div>
         
         <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <Button className="w-full h-12 text-base shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:shadow-indigo-300 transition-all" variant="primary">
               Export Calculation
            </Button>
         </div>
      </div>
    </div>
  );
};
