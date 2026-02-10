import React from 'react';
import { cn } from '../../lib/cn';

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'premium', size?: 'sm' | 'md' | 'icon' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-primary text-primary-foreground shadow-md hover:translate-y-[-1px] hover:shadow-lg active:translate-y-[0px]',
      secondary: 'bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50',
      ghost: 'hover:bg-slate-100 text-slate-600 hover:text-slate-900',
      outline: 'border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700',
      destructive: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
      premium: 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg hover:shadow-xl hover:to-slate-700 border border-slate-700',
    };
    const sizes = {
      sm: 'h-8 px-3 text-xs rounded-md',
      md: 'h-10 px-4 py-2 text-sm rounded-lg',
      lg: 'h-12 px-6 py-3 text-base rounded-xl',
      icon: 'h-9 w-9 p-0 flex items-center justify-center rounded-lg',
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/10 focus-visible:border-primary transition-all shadow-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Badge = ({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'outline' | 'secondary' | 'gold' }) => {
  const variants = {
    default: 'border-transparent bg-slate-900 text-white hover:bg-slate-800',
    secondary: 'border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200',
    outline: 'text-slate-700 border-slate-200',
    gold: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)} {...props} />
  );
};

export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:shadow-md", className)} {...props} />
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/10 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";