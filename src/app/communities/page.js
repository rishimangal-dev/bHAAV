'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CommunitiesPage() {
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showJoin, setShowJoin] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [joinError, setJoinError] = useState('');
    const [joining, setJoining] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const loadCommunities = async () => {
            const { data: memberships } = await supabase
                .from('community_members')
                .select('community_id, cash_balance, is_admin, communities(id, name, invite_code, fee_pot)')
                .order('joined_at', { ascending: false });

            setCommunities(memberships || []);
            setLoading(false);
        };

        loadCommunities();
    }, []);

    const handleJoin = async (e) => {
        e.preventDefault();
        setJoinError('');
        setJoining(true);

        const code = inviteCode.trim().toUpperCase();

        const { data: community, error: lookupErr } = await supabase
            .from('communities')
            .select('id, starting_balance')
            .eq('invite_code', code)
            .single();

        if (lookupErr || !community) {
            setJoinError('Invalid invite code');
            setJoining(false);
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();

        const { error: joinErr } = await supabase
            .from('community_members')
            .insert({
                community_id: community.id,
                user_id: user.id,
                cash_balance: community.starting_balance,
            });

        setJoining(false);

        if (joinErr) {
            if (joinErr.code === '23505') {
                setJoinError('You are already in this community');
            } else {
                setJoinError(joinErr.message);
            }
            return;
        }

        router.push('/community/' + community.id);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-neutral-500 text-sm">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <header className="border-b border-neutral-900 px-6 py-4 flex items-center justify-between">
                <button onClick={() => router.push('/')} className="text-sm text-neutral-400 hover:text-white">
                    ← Back
                </button>
                <h1 className="text-lg font-bold">Communities</h1>
                <div className="w-12" />
            </header>

            <main className="px-6 py-6 max-w-sm mx-auto">
                <div className="space-y-3 mb-6">
                    <button
                        onClick={() => router.push('/communities/create')}
                        className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors"
                    >
                        Create community
                    </button>
                    <button
                        onClick={() => setShowJoin(!showJoin)}
                        className="w-full py-4 bg-neutral-900 text-white font-semibold rounded-xl border border-neutral-800 hover:bg-neutral-800 transition-colors"
                    >
                        {showJoin ? 'Cancel' : 'Join with invite code'}
                    </button>

                    {showJoin && (
                        <form onSubmit={handleJoin} className="pt-2 space-y-3">
                            <input
                                type="text"
                                placeholder="ENTER CODE"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-center text-lg tracking-[0.3em] font-mono uppercase focus:outline-none focus:border-neutral-600"
                            />
                            {joinError && <div className="text-red-400 text-sm px-1">{joinError}</div>}
                            <button
                                type="submit"
                                disabled={joining || !inviteCode}
                                className="w-full py-3 bg-white text-black font-semibold rounded-xl disabled:bg-neutral-800 disabled:text-neutral-600"
                            >
                                {joining ? 'Joining...' : 'Join'}
                            </button>
                        </form>
                    )}
                </div>

                <div className="mb-3">
                    <div className="text-xs uppercase tracking-wider text-neutral-500 px-1">
                        Your communities
                    </div>
                </div>

                {communities.length === 0 ? (
                    <div className="text-center py-12 text-neutral-600 text-sm">
                        You haven&apos;t joined any community yet
                    </div>
                ) : (
                    <div className="space-y-2">
                        {communities.map((m) => (
                            <button
                                key={m.community_id}
                                onClick={() => router.push('/community/' + m.community_id)}
                                className="w-full p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors text-left"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="font-semibold">{m.communities.name}</div>
                                    {m.is_admin && (
                                        <span className="text-[10px] uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                                            Admin
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between text-xs text-neutral-500">
                                    <span>Code: <span className="font-mono text-neutral-300">{m.communities.invite_code}</span></span>
                                    <span className="text-neutral-300">₹{Number(m.cash_balance).toFixed(0)}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
