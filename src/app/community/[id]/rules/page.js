'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

const storyContent = `
## How to Play Bhaav (in one casual story)

Your friend made you join Bhaav. You have ₹20,000 and a list of every IPL player. Here's how it goes.

You see **Joss the Boss** at ₹420. He's been smashing it. You buy 10 shares for ₹4,200. That night GT plays. He scores 78. The next morning, your account is up by **₹780** — ₹1 per fantasy point per share. Easy.

Next day Joss's average goes up after his great innings. His new price is now ₹520. You hold.

You decide to short someone. **Vaipya Parag** — averaging 40, but his last three innings are 7, 12, 9. You short 5 shares at ₹160. The system locks ₹800 as margin. He scores 14. Price drops to ₹120. You cover for ₹200 profit, pay ₹70 in dividends. Net: ₹130. Smooth.

Encouraged, you short **Bhaisa Pant** at ₹300 for 5 shares. He scores 96. The buffalo runs. You owe ₹480 in dividends, and his price has shot to ₹520. If you cover now: ₹1,580 down — more than your margin. **Shorts can lose more than you put in.**

Doom-scrolling, you spot **Mukesh Kumar** at DC. Average 35. ₹210. You take 5 shares. Over 4 matches, he averages 70 points. Dividends: ₹1,400. Price climbs to ₹380 as his average shoots up. You sell. Profit: ₹2,250. **Find the underrated.**

You go big and load up on **Sir Ravindra Jadeja** before MI's match. 15 shares at ₹560. At 7:30 PM, markets lock. You can't trade until settlement. Sir Ravindra has a quiet day — 6 runs, 0 wickets. Tomorrow: price ₹390. You're down ₹2,550. Markets lock during games to stop people front-running performances.

When you check the **Rivals** page during the next live match, your friend who joined late is somehow #1. They've been buying boring middle-order guys — KKR's #5, MI's wicketkeeper, impact subs. Cheap, plays often, earns ₹40-50 a match. Compounded × matches × multiple shares = a fortune. Meanwhile you're holding star stocks like a romantic. **Boring wins.**

End of season: friend with boring picks finishes #1 at ₹68,000. You finish #3 at ₹41,000. The Bhaisa Pant short never recovered — that friend ends at ₹-12,000. **Yes, cash can go negative.**

You made some money. You learned how it works. Next year you're picking the next Mukesh.

---

### 8 things to remember

- Start with ₹20,000. Highest net worth at season end wins.
- Buy = bet they perform. Short = bet they don't.
- Dividends: ₹1 per fantasy point per share, after every match.
- Player price = Avg points × Matches remaining.
- Markets lock during matches, reopen after settlement.
- Cash can go negative. Shorts can blow up.
- Boring consistent players often beat star buys.
- Find the underrated.
`;

const rulesContent = `
## Bhaav — Full Rules

### Account
- Starting balance: **₹20,000**
- Cash can go negative (no auto-bankruptcy)
- Net worth = cash + value of all positions

### Pricing

Every player has:
- **Avg fantasy points** — running average of all IPL 2026 matches they've played. Rookies start at role defaults (Batter 45, Bowler 35, All-rounder 50, WK-Batter 50).
- **Matches remaining** — actual scheduled matches their team has left.

**Price = Avg × Matches remaining** (floor ₹100)

The price updates automatically after every match based on the player's new average and remaining matches.

### Trading

- **Buy long:** purchase shares. Profit on price rise + dividends.
- **Sell long:** close at current price.
- **Open short:** margin gets locked. Profit if price falls.
- **Cover short:** buy back to close.

Fee: **0.5%** per transaction. Position caps: 10 long shares, 5 short shares per player.

### Dividends — paid after every match

- **Long:** you receive \`points × shares\` ₹
- **Short:** you pay \`points × shares\` ₹
- **Player benched:** no dividend, no avg update, no price change

### Fantasy points (Dream11 T20)

**Batting:**
- Run: +1 / Four: +1 bonus / Six: +2 bonus
- 30/50/100: +4/+8/+16 milestone
- Duck: -2
- Strike rate ≥10 balls: >170 +6 / >150 +4 / ≥130 +2 / <70 -2 / <60 -4 / <50 -6

**Bowling:**
- Wicket: +25 / LBW or bowled: +8 bonus
- 3/4/5 wkts: +4/+8/+16
- Maiden: +12
- Economy ≥2 overs: <5 +6 / <6 +4 / ≤7 +2 / ≥10 -2 / >11 -4 / >12 -6

**Fielding:**
- Catch: +8 / 3 catches: +4 bonus / Stumping: +12 / Run out: +6

**Playing XI:** +4 just for being in lineup

### Trading windows

- Markets lock at match start (3:30 PM and 7:30 PM IST typically)
- Reopen after settlement (~30 min after match ends)
- 🔒 badge on locked players

### Pool size

Each player has \`10 × community size\` shares. Bigger community = bigger pool.


### Edge cases

- Match abandoned: no dividends, markets reopen.
- Unknown player in scorecard: system auto-adds them.
- Multiple matches same day: each team locks separately.

### Winning

Highest **net worth** at season end (May 31, 2026). Bragging rights only.
`;

export default function RulesPage() {
  const { id } = useParams();
  const [tab, setTab] = useState('story'); // 'story' or 'rules'

  return (
    <div className="min-h-screen bg-black text-white max-w-lg mx-auto flex flex-col">
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 p-4 border-b border-neutral-900 flex items-center gap-4">
        <Link href={`/community/${id}`} className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center text-white hover:bg-neutral-800 transition-colors">
          ←
        </Link>
        <h1 className="text-xl font-bold">How to Play Bhaav</h1>
      </div>

      <div className="flex px-4 pt-4 space-x-2 border-b border-neutral-900">
        <button
          onClick={() => setTab('story')}
          className={`pb-2 px-1 font-semibold transition-colors ${tab === 'story' ? 'text-white border-b-2 border-white' : 'text-neutral-500 hover:text-white'}`}
        >
          The Story
        </button>
        <button
          onClick={() => setTab('rules')}
          className={`pb-2 px-1 font-semibold transition-colors ${tab === 'rules' ? 'text-white border-b-2 border-white' : 'text-neutral-500 hover:text-white'}`}
        >
          Full Rules
        </button>
      </div>

      <div className="p-6 pb-20 prose prose-invert prose-neutral max-w-none">
        <ReactMarkdown>
          {tab === 'story' ? storyContent : rulesContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}
