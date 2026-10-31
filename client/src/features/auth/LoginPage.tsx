import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/apiClient';
import { loginSchema, type LoginValues } from '../../schemas/auth';
import { LogoMark } from '../../components/Logo';
import { Button } from '../../components/ui/Button';
import { Field, Input, PasswordInput } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toaster';
import { useLogin } from './hooks';

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginValues) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => {
        const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
        navigate(from, { replace: true });
      },
      onError: (error) => {
        if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
          for (const [path, message] of Object.entries(error.fieldErrors)) {
            setError(path as keyof LoginValues, { message });
          }
        } else if (error instanceof ApiError) {
          // Wrong password / unknown email: the message belongs on the form,
          // next to the field the user can fix — not only in a transient toast.
          setFormError(error.message);
        } else {
          setFormError('Sign in failed. Please check your connection and try again.');
          showToast('Sign in failed. Please check your connection and try again.', 'error');
        }
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-5 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
          <LogoMark size={32} />
          <span className="text-lg font-semibold text-ink">Smart Finance</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
        <p className="mt-1 mb-6 text-[15px] text-muted">Welcome back. Your ledger is where you left it.</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {formError ? (
            <div role="alert" className="rounded-[10px] border border-[#f0c9c6] bg-[#ffedea] px-3 py-2 text-[14px] text-[#831c1e]">
              {formError}
            </div>
          ) : null}

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>

          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>
            New here?{' '}
            <Link to="/signup" className="font-medium text-accent-ink hover:underline">
              Create an account
            </Link>
          </span>
          <Link to="/forgot" className="font-medium text-accent-ink hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}
