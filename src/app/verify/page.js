'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function VerifyPage() {
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const router = useRouter();
    const inputRef = useRef(null);

    useEffect(() => {
        const pendingEmail = sessionStorage.getItem('bhaav_pending_email');
        if (!pendingEmail) {
            router.push('/login');
            return;
        }
        setEmail(pendingEmail);
        inputRef.current?.focus();
    }, [router]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleVerify = async (e) => {
        e.preventDefault();
        if (code.length !== 6) return;

        setError('');
        setLoading(true);

        const { error } = await supabase.auth.verifyOtp({
            email,
            token: code,
            type: 'email',
        });

        setLoading(false);

        if (error) {
            setError(error.message);
            setCode('');
            inputRef.current?.focus();
            return;
        }

        sessionStorage.removeItem('bhaav_pending_email');
        router.push('/');
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;

        setError('');
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: true },
        });

        if (error) {
            setError(error.message);
            return;
        }

        setResendCooldown(30);
    };

    const resendLabel = resendCooldown > 0 ? 'Resend in ' + resendCooldown + 's' : 'Resend code';

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-sm">
                <div className="mb-10 text-center">
                    <h1 className="text-2xl font-bold mb-2">Check your email</h1>
                    <p className="text-neutral-500 text-sm">
                        We sent a 6-digit code to
                    </p>
                    <p className="text-neutral-300 text-sm font-medium mt-1">
                        {email}
                    </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                    <div>
                        <label htmlFor="code" className="block text-xs uppercase tracking-wider text-neutral-400 mb-2">
                            Code
                        </label>
                        <input
                            ref={inputRef}
                            id="code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            required
                            placeholder="000000"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-center text-2xl tracking-[0.5em] font-mono placeholder-neutral-700 focus:outline-none focus:border-neutral-600 transition-colors"
                        />
                    </div>

                    {error && (
                        <div className="text-red-400 text-sm px-1">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || code.length !== 6}
                        className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 transition-colors"
                    >
                        {loading ? 'Verifying...' : 'Verify'}
                    </button>
                </form>

                <div className="mt-8 text-center space-y-3">
                    <button
                        onClick={handleResend}
                        disabled={resendCooldown > 0}
                        className="text-sm text-neutral-400 hover:text-white disabled:text-neutral-700 transition-colors"
                    >
                        {resendLabel}
                    </button>

                    <div>
                        <button
                            onClick={() => router.push('/login')}
                            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
                        >
                            Use a different email
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}