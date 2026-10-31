import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '../../lib/apiClient';
import { LogoMark } from '../../components/Logo';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toaster';
import { resetPasswordRequest } from '../settings/api';

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .max(128)
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/[0-9]/, 'Include at least one number.'),
    confirm: z.string().min(1, 'Repeat the new password.'),
  })
  .refine((v) => v.password === v.confirm, { message: 'The two passwords do not match.', path: ['confirm'] });

type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } });

  const onSubmit = async (values: ResetValues) => {
    if (!token) {
      setError('password', { message: 'This reset link is missing its token. Request a new one.' });
      return;
    }
    try {
      await resetPasswordRequest({ token, password: values.password });
      showToast('Password changed. Sign in with the new one.', 'success');
      navigate('/login');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'RESET_TOKEN_INVALID') {
        setError('password', { message: error.message });
      } else if (error instanceof ApiError && error.fieldErrors.password) {
        setError('password', { message: error.fieldErrors.password });
      } else {
        showToast(error instanceof Error ? error.message : 'Could not reset the password.', 'error');
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

        <h1 className="text-2xl font-semibold tracking-tight text-ink">Choose a new password</h1>
        <p className="mt-1 mb-6 text-[15px] text-muted">
          {token ? 'Set the password you will sign in with from now on.' : 'This link is missing its token.'}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Field
            label="New password"
            htmlFor="reset-password"
            error={errors.password?.message}
            hint="At least 8 characters, with a letter and a number."
          >
            <Input id="reset-password" type="password" autoComplete="new-password" invalid={Boolean(errors.password)} {...register('password')} />
          </Field>
          <Field label="Repeat new password" htmlFor="reset-confirm" error={errors.confirm?.message}>
            <Input id="reset-confirm" type="password" autoComplete="new-password" invalid={Boolean(errors.confirm)} {...register('confirm')} />
          </Field>
          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? 'Saving…' : 'Set new password'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted">
          <Link to="/forgot" className="font-medium text-accent-ink hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}
