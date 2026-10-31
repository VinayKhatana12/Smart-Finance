import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '../../lib/apiClient';
import { LogoMark } from '../../components/Logo';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toaster';
import { forgotPasswordRequest } from '../settings/api';

const forgotSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });
  const { showToast } = useToast();
  const navigate = useNavigate();

  const onSubmit = async (values: ForgotValues) => {
    try {
      const result = await forgotPasswordRequest(values.email);
      showToast('If that account exists, a reset link is on its way. Check the server log in this build.', 'success');
      if (result.resetUrl) {
        // Development convenience: the link is also printed in the API console.
        const url = new URL(result.resetUrl);
        navigate(`/reset?token=${url.searchParams.get('token') ?? ''}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.email) {
        setError('email', { message: error.fieldErrors.email });
      } else {
        showToast(error instanceof Error ? error.message : 'Could not send the request. Please try again.', 'error');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-5 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
          <LogoMark size={32} />
          <span className="text-lg font-semibold text-ink">Smart Finance</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-ink">Forgot your password?</h1>
        <p className="mt-1 mb-6 text-[15px] text-muted">
          Enter the email on the account and we&apos;ll start a reset. The link is valid for one hour.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Field label="Email" htmlFor="forgot-email" error={errors.email?.message}>
            <Input id="forgot-email" type="email" autoComplete="email" invalid={Boolean(errors.email)} {...register('email')} />
          </Field>
          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-accent-ink hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
