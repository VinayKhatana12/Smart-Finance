import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/apiClient';
import { signupSchema, type SignupValues } from '../../schemas/auth';
import { CURRENCIES } from '../../types';
import { LogoMark } from '../../components/Logo';
import { Button } from '../../components/ui/Button';
import { Field, Input, PasswordInput, Select } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toaster';
import { useSignup } from './hooks';

export function SignupPage() {
  const signup = useSignup();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', currency: 'INR' },
  });

  const onSubmit = (values: SignupValues) => {
    signup.mutate(values, {
      onSuccess: () => {
        showToast('Account created. Welcome to Smart Finance.', 'success');
        navigate('/dashboard', { replace: true });
      },
      onError: (error) => {
        if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
          for (const [path, message] of Object.entries(error.fieldErrors)) {
            setError(path as keyof SignupValues, { message });
          }
        } else {
          showToast(error instanceof Error ? error.message : 'Could not create your account. Please try again.', 'error');
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

        <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your account</h1>
        <p className="mt-1 mb-6 text-[15px] text-muted">
          One ledger for your income, spending, budgets and goals.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            error={errors.password?.message}
            hint="At least 8 characters, with a letter and a number."
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              aria-describedby="password-hint"
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>

          <Field label="Currency" htmlFor="currency" error={errors.currency?.message}>
            <Select id="currency" {...register('currency')}>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? 'Creating…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent-ink hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
