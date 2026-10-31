import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Label above the field, 8px gap; the error replaces the hint and is tied to the input. */
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[13px] text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-[10px] border bg-surface px-3 text-[15px] text-ink placeholder:text-faint',
        'focus:outline-none focus-visible:outline-2 focus-visible:outline-accent',
        invalid ? 'border-negative' : 'border-[#e8e8e8]',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-[10px] border bg-surface px-3 text-[15px] text-ink',
        'focus:outline-none focus-visible:outline-2 focus-visible:outline-accent',
        invalid ? 'border-negative' : 'border-control',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'w-full rounded-[10px] border bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-faint',
        'focus:outline-none focus-visible:outline-2 focus-visible:outline-accent',
        invalid ? 'border-negative' : 'border-[#e8e8e8]',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean;
}

/** A password field that says what it shows: the toggle is labelled, not an icon alone. */
export function PasswordInput({ className, invalid, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={cn(
          'h-10 w-full rounded-[10px] border bg-surface px-3 pr-[74px] text-[15px] text-ink',
          'focus:outline-none focus-visible:outline-2 focus-visible:outline-accent',
          invalid ? 'border-negative' : 'border-[#e8e8e8]',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[6px] px-1.5 py-0.5 text-[13px] font-medium text-accent-ink hover:bg-accent-soft"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
