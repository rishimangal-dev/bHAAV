'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

const ACTION_LABELS = {
  buy: 'Buy Long',
  sell: 'Sell Long',
  short: 'Open Short',
  cover: 'Cover Short',
};

const ACTION_DESCRIPTIONS = {
  buy: 'Buy shares expecting the price to rise',
  sell: 'Sell your long position to lock in profit or cut loss',
  short: 'Bet against this player — profit when price drops',
  cover: 'Close your short position',
};

const ACTION_COLORS = {
  buy: 'bg-emerald-600 hover:bg-emerald-500',
  sell: 'bg-orange-600 hover:bg-orange-500',
  short: 'bg-red-600 hover:bg-red-500',
  cover: 'bg-blue-600 hover:bg-blue-500',
};

const RPC_MAP = {
  buy: 'buy_long',
  sell: 'sell_long',
  short: 'open_short',
  cover: 'cover_short',
};

function calculateIntegralCost(basePrice, initialSupply, supplyRemaining, quantity, action) {
  if (!quantity || quantity <= 0 || !basePrice || !initialSupply || supplyRemaining == null) {
    return { cost: 0, fee: 0, total: 0, error: null };
  }

  const remainingBefore = supplyRemaining;
  let remainingAfter;

  switch (action) {
    case 'buy':
      remainingAfter = remainingBefore - quantity;
      break;
    case 'sell':
      remainingAfter = Math.min(remainingBefore + quantity, initialSupply);
      break;
    case 'short':
      remainingAfter = remainingBefore + quantity;
      break;
    case 'cover':
      remainingAfter = remainingBefore - quantity;
      break;
    default:
      return { cost: 0, fee: 0, total: 0, error: null };
  }

  // Check liquidity for buy/cover (remaining_after must be >= 1)
  if ((action === 'buy' || action === 'cover') && remainingAfter < 1) {
    return { cost: 0, fee: 0, total: 0, error: 'Not enough liquidity in pool' };
  }

  const rawCost = basePrice * initialSupply * Math.log(remainingBefore / remainingAfter);
  const cost = Math.abs(rawCost);
  const fee = cost * 0.005;
  const total = cost + fee;

  return { cost, fee, total, error: null };
}

export default function TradeModal({ market, communityId, member, holdings, isLocked, onClose, onComplete }) {
  const [action, setAction] = useState('buy');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const existingLong = holdings.find(
    (h) => h.player_id === market.players.id && h.position_type === 'long'
  );
  const existingShort = holdings.find(
    (h) => h.player_id === market.players.id && h.position_type === 'short'
  );

  // Calculate cost using integral pricing formula
  const pricing = useMemo(() => {
    return calculateIntegralCost(
      market.base_price,
      market.initial_supply,
      market.supply_remaining,
      quantity,
      action
    );
  }, [market.base_price, market.initial_supply, market.supply_remaining, quantity, action]);

  // Sell quantity validation
  const sellQuantityError = (action === 'sell' && existingLong && quantity > existingLong.quantity)
    ? `You only hold ${existingLong.quantity} shares`
    : null;

  const coverQuantityError = (action === 'cover' && existingShort && quantity > existingShort.quantity)
    ? `You only hold ${existingShort.quantity} shares`
    : null;

  const displayError = pricing.error || sellQuantityError || coverQuantityError;

  const handleTrade = async () => {
    setLoading(true);
    setError('');

    const rpcName = RPC_MAP[action];

    const { data, error: rpcError } = await supabase.rpc(rpcName, {
      p_community_id: communityId,
      p_player_id: market.players.id,
      p_quantity: quantity,
    });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    if (data && !data.success) {
      setError(data.message || 'Trade failed');
      setLoading(false);
      return;
    }

    setLoading(false);
    onComplete();
  };

  const tabs = [
    { key: 'buy', label: 'Buy' },
    { key: 'sell', label: 'Sell', disabled: !existingLong },
    { key: 'short', label: 'Short', disabled: !existingShort ? false : false },
    { key: 'cover', label: 'Cover', disabled: !existingShort },
  ];
  // Short is always enabled (opening a new short), cover requires an existing short
  tabs[2].disabled = false;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end z-50"
      onClick={onClose}
    >
      <div
        className="bg-neutral-950 rounded-t-3xl w-full max-w-md mx-auto border-t border-neutral-800 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-neutral-700" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4">
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
            {market.players.team} · {market.players.role}
          </p>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{market.players.name}</h2>
            <span className="text-lg font-bold text-white">₹{market.current_price.toFixed(1)}</span>
          </div>
        </div>

        {/* Locked state */}
        {isLocked ? (
          <div className="px-5 pb-6">
            <div className="p-5 rounded-xl bg-orange-950/30 border border-orange-900/50 text-center">
              <p className="text-2xl mb-2">🔒</p>
              <p className="text-sm font-semibold text-orange-400 mb-1">Market Closed</p>
              <p className="text-xs text-neutral-400">Match in progress for this player&apos;s team. Trading resumes after settlement.</p>
            </div>
            <button
              onClick={onClose}
              className="w-full mt-4 py-3.5 rounded-xl bg-neutral-800 text-neutral-300 font-semibold text-sm cursor-pointer hover:bg-neutral-700 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>

        {/* Action tabs */}
        <div className="px-5 pb-2">
          <div className="flex gap-1 bg-neutral-900 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                disabled={tab.disabled}
                onClick={() => {
                  setAction(tab.key);
                  setError('');
                }}
                className={
                  'flex-1 py-2 text-sm font-medium rounded-lg transition-all ' +
                  (action === tab.key
                    ? 'bg-neutral-800 text-white shadow'
                    : 'text-neutral-500 hover:text-neutral-300') +
                  (tab.disabled ? ' opacity-30 cursor-not-allowed' : ' cursor-pointer')
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-600 mt-2 text-center">
            {ACTION_DESCRIPTIONS[action]}
          </p>
        </div>

        {/* Existing position info */}
        {action === 'sell' && existingLong && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400">
              You hold <span className="text-white font-medium">{existingLong.quantity} shares</span> @ ₹{existingLong.avg_buy_price.toFixed(1)}
            </p>
          </div>
        )}

        {action === 'cover' && existingShort && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400">
              You hold <span className="text-white font-medium">{existingShort.quantity} shares</span> @ ₹{existingShort.avg_buy_price.toFixed(1)}
            </p>
          </div>
        )}

        {/* Quantity control */}
        <div className="px-5 py-4">
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-3 text-center">Quantity</p>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-11 h-11 rounded-full bg-neutral-900 border border-neutral-800 text-white text-xl font-bold flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              −
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                setQuantity(parsed > 0 ? parsed : 1);
              }}
              onBlur={() => { if (!quantity || quantity < 1) setQuantity(1); }}
              className="w-20 text-4xl font-bold text-white text-center tabular-nums bg-transparent border-b-2 border-neutral-700 focus:border-emerald-500 outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-11 h-11 rounded-full bg-neutral-900 border border-neutral-800 text-white text-xl font-bold flex items-center justify-center hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        {/* Summary box */}
        <div className="mx-5 mb-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          {displayError ? (
            <p className="text-sm text-red-400 text-center">{displayError}</p>
          ) : (
            <>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-neutral-400">
                  {action === 'sell' || action === 'cover' ? 'You receive' : 'Cost'}
                </span>
                <span className="text-white">₹{pricing.cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-neutral-400">Fee (0.5%)</span>
                <span className="text-white">₹{pricing.fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm pt-3 border-t border-neutral-800">
                <span className="text-neutral-300 font-medium">Total</span>
                <span className="text-white font-bold">₹{pricing.total.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-4 px-4 py-3 rounded-xl bg-red-950/50 border border-red-900">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <div className="px-5">
          <button
            onClick={handleTrade}
            disabled={loading || !!displayError}
            className={
              'w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all ' +
              ACTION_COLORS[action] +
              ((loading || displayError) ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer')
            }
          >
            {loading ? 'Processing...' : ACTION_LABELS[action] + ' · ₹' + pricing.total.toFixed(2)}
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
