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
                    We'll email you a 6-digit code to sign in.
                </p>
            </div>
        </div>
    );
}