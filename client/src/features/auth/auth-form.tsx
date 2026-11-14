'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Ticket } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { ApiError } from '@/lib/api-client';
import { useLogin, useRegister } from './queries';

const authSchema = z.object({
  name: z.string(),
  email: z.email('Enter a valid email address.'),
  password: z.string().min(10, 'Use at least 10 characters.').max(72),
  confirmPassword: z.string(),
  role: z.enum(['CUSTOMER', 'ORGANIZER']),
});
type AuthValues = z.infer<typeof authSchema>;
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const registration = mode === 'register';
  const router = useRouter();
  const params = useSearchParams();
  const { notify } = useDemo();
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const schema = authSchema.superRefine((values, context) => {
    if (registration && values.name.trim().length < 2)
      context.addIssue({ code: 'custom', path: ['name'], message: 'Please enter your full name.' });
    if (registration && values.password !== values.confirmPassword)
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Your passwords don’t match.',
      });
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', role: 'CUSTOMER' },
  });
  async function submit(values: AuthValues) {
    try {
      if (registration)
        await registerMutation.mutateAsync({
          name: values.name.trim(),
          email: values.email,
          password: values.password,
          accountType: values.role,
        });
      const result = await loginMutation.mutateAsync({
        email: values.email,
        password: values.password,
      });
      notify(
        registration ? 'Your account is ready. Welcome to EventConn!' : 'Logged in successfully.',
      );
      const requested = params.get('next');
      router.replace(
        requested?.startsWith('/')
          ? requested
          : result.data.role === 'ORGANIZER'
            ? '/organizer'
            : '/',
      );
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      if (apiError?.fieldErrors)
        for (const [field, message] of Object.entries(apiError.fieldErrors))
          if (field in authSchema.shape) setError(field as keyof AuthValues, { message });
      setError('root', { message: apiError?.message || 'We couldn’t complete your request.' });
    }
  }
  return (
    <div className="auth-page container">
      <div className="auth-story">
        <p className="eyebrow">LESS SCROLLING. MORE LIVING.</p>
        <h1>
          Good things happen
          <br />
          when you <em>show up.</em>
        </h1>
        <p>Your next favorite memory starts here.</p>
        <Ticket size={80} strokeWidth={1} />
        <span>Find your people. Make your plans. Be there.</span>
      </div>
      <div className="auth-form">
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>{registration ? 'A little more life awaits.' : 'Good to see you again.'}</h1>
        <p className="muted">
          {registration
            ? 'Create an account and find your next experience.'
            : 'Sign in and pick up where your plans left off.'}
        </p>
        <form onSubmit={handleSubmit(submit)} className="form-stack">
          {(registration
            ? (['name', 'email', 'password', 'confirmPassword'] as const)
            : (['email', 'password'] as const)
          ).map((field) => (
            <label key={field} htmlFor={field}>
              {
                {
                  name: 'Full name',
                  email: 'Email address',
                  password: 'Password',
                  confirmPassword: 'Confirm password',
                }[field]
              }
              <input
                id={field}
                type={
                  field.toLowerCase().includes('password')
                    ? 'password'
                    : field === 'email'
                      ? 'email'
                      : 'text'
                }
                autoComplete={
                  field === 'password'
                    ? registration
                      ? 'new-password'
                      : 'current-password'
                    : field === 'confirmPassword'
                      ? 'new-password'
                      : field
                }
                {...register(field)}
                aria-invalid={!!errors[field]}
              />
              {errors[field] && <small className="field-error">{errors[field]?.message}</small>}
            </label>
          ))}
          {registration && (
            <label>
              Experience
              <select {...register('role')}>
                <option value="CUSTOMER">Customer — discover and book</option>
                <option value="ORGANIZER">Organizer — create and connect</option>
              </select>
            </label>
          )}
          {errors.root && (
            <p role="alert" className="field-error">
              {errors.root.message}
            </p>
          )}
          <button
            className="button full"
            disabled={isSubmitting || loginMutation.isPending || registerMutation.isPending}
          >
            {isSubmitting ? 'One moment…' : registration ? 'Create account' : 'Sign in'}{' '}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-alternate">
          {registration ? 'Already making plans?' : 'New around here?'}{' '}
          <Link href={registration ? '/login' : '/register'}>
            {registration ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </div>
  );
}
