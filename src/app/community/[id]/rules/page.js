'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

const markdownContent = `# How to Play Bhaav

A fantasy market where you bet on IPL players using prices and dividends.

---

## You start with ₹10,000

Your goal: end the season with the most net worth in your community.

---

## Player price = Avg fantasy points × Matches remaining

A player averaging 50 points with 6 matches left is worth ₹300/share.

---

## Two types of bets

Long (buy) — you think the player will perform.
- Buy 5 shares of Sanju at ₹300 = ₹1,500
- He scores 80 in next match → you receive ₹400 in dividends (5 × 80)
- Selling later at ₹350 → you make profit on price too

Short (sell) — you think the player will flop.
- Short 3 shares at ₹300 = ₹900 margin locked
- He scores 80 → you PAY ₹240 (3 × 80)
- He scores 0 → you keep margin + benefit if his price drops

---

## Dividends

After every match settled, longs receive ₹1 per fantasy point per share, shorts pay it.

---

## Limits

- 10 long shares per player per user
- 5 short shares per player per user
- 30 shares total in pool per player
- 0.5% trading fee on every trade

---

## When markets close

🔒 Markets close when teams play a match (3:30 PM and 7:30 PM IST). Reopen after settlement at midnight.

This stops people from arbitraging in-game performances.

---

## How to win

Pick players who'll outperform their averages. Avoid those who'll underperform. The boring consistent player is usually a better buy than the hyped star.

That's all you need to know. Open the market and start picking.
`;

export default function RulesPage() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-black text-white max-w-lg mx-auto flex flex-col">
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 p-4 border-b border-neutral-900 flex items-center gap-4">
        <Link href={`/community/${id}`} className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center text-white hover:bg-neutral-800 transition-colors">
          ←
        </Link>
        <h1 className="text-lg font-bold tracking-tight">How to Play Bhaav</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 pb-20">
        <div className="prose prose-invert prose-neutral max-w-none prose-h2:text-lg prose-h2:mb-3 prose-p:text-neutral-400 prose-p:leading-relaxed prose-li:text-neutral-400 prose-hr:border-neutral-800 prose-hr:my-8">
          <ReactMarkdown>
            {markdownContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
