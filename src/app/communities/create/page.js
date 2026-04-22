'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CreateCommunityPage() {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setError('');
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();

        const { data, error: createErr } = await supabase
            .from('communities')
            .insert({
                name: name.trim(),
                created_by: user.id,
            })
            .select()
            .single();

        setLoading(false);

        if (createErr) {
            setError(createErr.message);
            return;
        }

        router.push('/community/' + data.id);
    };

    return (
        <div className="min-h-screen bg-black text-white">
            <header className="border-b border-neutral-900 px-6 py-4 flex items-center justify-between">
                <button onClick={() => router.push('/communities')} className="text-sm text-neutral-400 hover:text-white">
                    ← Back
                </button>
                <h1 className="text-lg font-bold">New community</h1>
                <div className="w-12" />
            </header>

            <main className="px-6 py-12 max-w-sm mx-auto">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-2">
                            Community name
                        </label>
                        <input
                            type="text"
                            required
                            autoFocus
                            placeholder="Office Gang, IPL Squad, etc."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={30}
                            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
                        />
                    </div>

                    <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl text-xs text-neutral-400 space-y-1">
                        <div>• Every member starts with ₹1,000</div>
                        <div>• All players start at ₹100</div>
                        <div>• Max 50 members per community</div>
                        <div>• 0.5% trading fee goes to community pot</div>
                    </div>

                    {error && <div className="text-red-400 text-sm">{error}</div>}

                    <button
                        type="submit"
                        disabled={loading || !name.trim()}
                        className="w-full py-3 bg-white text-black font-semibold rounded-xl disabled:bg-neutral-800 disabled:text-neutral-600"
                    >
                        {loading ? 'Creating...' : 'Create community'}
                    </button>
                </form>
            </main>
        </div>
    );
}