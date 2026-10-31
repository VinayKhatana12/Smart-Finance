import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '../../lib/apiClient';

import { CURRENCIES } from '../../types';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { Pill } from '../../components/ui/Pill';
import { useToast } from '../../components/ui/Toaster';
import { useLogout, useMe, useUpdateProfile } from '../auth/hooks';
import { usePwa } from '../../lib/pwa';
import { changePasswordRequest } from './api';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .max(128)
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/[0-9]/, 'Include at least one number.'),
    confirm: z.string().min(1, 'Repeat the new password.'),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'The two passwords do not match.', path: ['confirm'] })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'The new password must be different from the current one.',
    path: ['newPassword'],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

interface ProfileFormValues {
  name: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'INR' | 'AUD' | 'CAD' | 'JPY';
  timezone: string;
}

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <div className="grid gap-4 md:grid-cols-[minmax(0,450px)_minmax(0,1fr)] md:gap-8">
        <div>
          <h2 className="text-base font-medium text-ink">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        </div>
        <div className="rounded-2xl bg-panel p-4">{children}</div>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const { data } = useMe();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [saved, setSaved] = useState(false);
  const [theme] = useState<'light'>('light');
  const { offlineReady, installPrompt } = usePwa();
  void offlineReady;
  const [notifications, setNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sf-notifications') ?? '{}') as { weekly?: boolean; alerts?: boolean };
    } catch {
      return {};
    }
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    values: { name: data?.user.name ?? '', currency: data?.user.currency ?? 'USD', timezone: data?.user.timezone ?? '' },
  });

  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), values: { currentPassword: '', newPassword: '', confirm: '' } });

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  if (!data?.user) {
    return <p className="text-sm text-muted">Loading your settings…</p>;
  }

  const onSubmitProfile = (values: { name: string; currency: 'USD'|'EUR'|'GBP'|'INR'|'AUD'|'CAD'|'JPY'; timezone: string }) => {
    updateProfile.mutate(
      { name: values.name, currency: values.currency as never, timezone: values.timezone || undefined },
      {
        onSuccess: () => {
          reset(values);
          setSaved(true);
          showToast('Profile saved.', 'success');
        },
        onError: (error) => {
          if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
            for (const [path, message] of Object.entries(error.fieldErrors)) {
              setError(path as 'name', { message });
            }
          } else {
            showToast(error instanceof Error ? error.message : 'Could not save. Please try again.', 'error');
          }
        },
      },
    );
  };

  const onSubmitPassword = (values: PasswordValues) => {
    changePasswordRequest({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      .then(() => {
        passwordForm.reset({ currentPassword: '', newPassword: '', confirm: '' });
        showToast('Password changed.', 'success');
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.fieldErrors['newPassword']) {
          passwordForm.setError('newPassword', { message: error.fieldErrors['newPassword'] });
        } else if (error instanceof ApiError && error.code === 'WRONG_PASSWORD') {
          passwordForm.setError('currentPassword', { message: error.message });
        } else {
          showToast(error instanceof Error ? error.message : 'Could not change the password.', 'error');
        }
      });
  };

  const saveNotifications = (next: typeof notifications) => {
    setNotifications(next);
    localStorage.setItem('sf-notifications', JSON.stringify(next));
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
      <p className="mt-0.5 text-sm text-muted">Your profile, preferences, and the account itself.</p>

      <div className="mt-6 max-w-[1100px]">
        <SettingsSection
          title="Profile"
          description="How your name appears, the currency every amount uses, and the timezone your dates follow."
        >
          <form onSubmit={handleSubmit(onSubmitProfile)} noValidate className="flex flex-col gap-4">
            <Field label="Name" htmlFor="settings-name" error={errors.name?.message}>
              <Input id="settings-name" autoComplete="name" invalid={Boolean(errors.name)} {...register('name')} />
            </Field>
            <Field label="Email" htmlFor="settings-email" hint="Email changes arrive in a later build.">
              <Input id="settings-email" value={data.user.email} readOnly disabled />
            </Field>
            <Field label="Currency" htmlFor="settings-currency" error={errors.currency?.message}>
              <Select id="settings-currency" {...register('currency')}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Timezone"
              htmlFor="settings-timezone"
              hint="Dates in reports follow this zone. Pick from the common list or type an IANA name."
            >
              <Input id="settings-timezone" list="timezone-options" placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone} {...register('timezone')} />
              <datalist id="timezone-options">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
            </Field>
            <div className="flex items-center justify-end gap-3 pt-1">
              {saved ? <Pill tone="positive">Saved</Pill> : null}
              <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
                Save changes
              </Button>
            </div>
          </form>
        </SettingsSection>

        <SettingsSection title="Password" description="Change it here. You stay signed in on this device; other sessions keep working until they sign out.">
          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} noValidate className="flex flex-col gap-4">
            <Field label="Current password" htmlFor="pw-current" error={passwordForm.formState.errors.currentPassword?.message}>
              <Input id="pw-current" type="password" autoComplete="current-password" invalid={Boolean(passwordForm.formState.errors.currentPassword)} {...passwordForm.register('currentPassword')} />
            </Field>
            <Field
              label="New password"
              htmlFor="pw-new"
              error={passwordForm.formState.errors.newPassword?.message}
              hint="At least 8 characters, with a letter and a number."
            >
              <Input id="pw-new" type="password" autoComplete="new-password" aria-describedby="pw-new-hint" invalid={Boolean(passwordForm.formState.errors.newPassword)} {...passwordForm.register('newPassword')} />
            </Field>
            <Field label="Repeat new password" htmlFor="pw-confirm" error={passwordForm.formState.errors.confirm?.message}>
              <Input id="pw-confirm" type="password" autoComplete="new-password" invalid={Boolean(passwordForm.formState.errors.confirm)} {...passwordForm.register('confirm')} />
            </Field>
            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" disabled={passwordForm.formState.isSubmitting}>
                {passwordForm.formState.isSubmitting ? 'Changing…' : 'Change password'}
              </Button>
            </div>
          </form>
        </SettingsSection>

        <SettingsSection title="Appearance" description="The app follows the dealt light design; a dark counterpart is planned for a later build.">
          <div className="flex items-center justify-between gap-4 py-1">
            <div>
              <p className="text-sm font-medium text-ink">
                Theme
                <span className="ml-2 align-middle">
                  <Pill tone="neutral">Light · active</Pill>
                </span>
              </p>
              <p className="mt-0.5 text-sm text-muted">Dark mode arrives once it can meet the same contrast floor.</p>
            </div>
            <Select value={theme} disabled className="w-[130px]" aria-label="Theme">
              <option value="light">Light</option>
            </Select>
          </div>
        </SettingsSection>

        <SettingsSection title="Notifications" description="Quiet reminders, stored on this device — email delivery arrives in a later build.">
          <div className="flex flex-col gap-4">
            {(
              [
                { key: 'weekly', title: 'Weekly summary banner', description: 'A Monday nudge with last week’s net.' },
                { key: 'alerts', title: 'Budget alerts on the dashboard', description: 'Show the over-budget and deadline cards.' },
              ] as const
            ).map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 py-1">
                <div>
                  <p className="text-sm font-medium text-ink">{row.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{row.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(notifications[row.key])}
                  aria-label={row.title}
                  onClick={() => saveNotifications({ ...notifications, [row.key]: !notifications[row.key] })}
                  className={`relative h-4 w-7 flex-none cursor-pointer rounded-full transition-colors ${
                    notifications[row.key] ? 'bg-positive' : 'bg-control'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-[left] ${
                      notifications[row.key] ? 'left-3.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title="Session" description="Sign out of this device. Your ledger stays as it is.">
          <div className="flex items-center justify-between gap-4 py-1">
            <p className="text-sm text-muted">Signed in as {data.user.email}.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                logout.mutate(undefined, {
                  onSuccess: () => navigate('/'),
                })
              }
            >
              Sign out
            </Button>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Install the app"
          description="Smart Finance is a Progressive Web App - install it for a standalone window, a home-screen icon and offline access to your ledger."
        >
          <div className="flex flex-col gap-3">
            {installPrompt ? (
              <div className="flex items-center justify-between gap-4 py-1">
                <p className="text-sm text-muted">Your browser supports one-tap installation.</p>
                <Button size="sm" onClick={() => void installPrompt.prompt().catch(() => showToast('Installation was dismissed.', 'info'))}>
                  Install
                </Button>
              </div>
            ) : null}
            <details className="rounded-[8px] px-3 py-2 hover:bg-active/50">
              <summary className="cursor-pointer list-none text-sm font-medium text-ink">Installation guide</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-muted marker:text-muted">
                <li>Chrome (Android/desktop): menu - "Install app", or the install icon in the address bar.</li>
                <li>Safari (iOS): Share - "Add to Home Screen".</li>
                <li>Edge (desktop): menu - Apps - "Install this site as an app".</li>
              </ul>
            </details>
            <p className="text-[13px] text-muted">
              {offlineReady ? 'Installed and ready to work offline.' : 'The offline app shell downloads automatically after your first visit.'}
            </p>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Danger zone"
          description="Deleting your account removes your ledger, budgets and goals permanently. This cannot be undone."
        >
          <div className="flex items-center justify-between gap-4 py-1">
            <p className="text-sm text-muted">Account deletion arrives in a later build, with a confirmation that names your account.</p>
            <Button variant="danger" size="sm" disabled>
              Delete account
            </Button>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

