'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: {
                shouldCreateUser: true,
            },
        });

        setLoading(false);

        if (error) {
            setError(error.message);
            return;
        }

        sessionStorage.setItem('bhaav_pending_email', email.trim().toLowerCase());
        router.push('/verify');
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-sm">
                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-bold tracking-tight mb-2">
                        <span className="text-white">Bhaav</span>
                    </h1>
                    <p className="text-neutral-500 text-sm">
                        Trade your favourite cricketers
                    </p>
                </div>

                {/* Google Sign In */}
                <button
                    onClick={async () => {
                        await supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: {
                                redirectTo: `${window.location.origin}/auth/callback`,
                            },
                        });
                    }}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-white text-neutral-800 font-semibold rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                    <svg width="18" height="18" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Continue with Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-neutral-800" />
                    <span className="text-xs text-neutral-600 uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-neutral-800" />
                </div>

                <form onSubmit={handleSendOTP} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-xs uppercase tracking-wider text-neutral-400 mb-2">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            autoFocus
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
                        />
                    </div>

                    {error && (
                        <div className="text-red-400 text-sm px-1">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 transition-colors"
                    >
                        {loading ? 'Sending...' : 'Send code'}
                    </button>
                </form>

                <p className="text-center text-xs text-neutral-600 mt-8">
                    We&#39;ll email you a 6-digit code to sign in.
                </p>
            </div>
        </div>
    );
}