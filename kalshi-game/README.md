# Kalshi Betting Game

A fun daily prediction market game using Kalshi's API.

## How It Works

1. **Every morning (9 AM ET):** Fetch interesting markets from Kalshi and send one to Telegram
2. **You click:** Choose YES or NO (or skip)
3. **Track bets:** All bets stored in local SQLite database
4. **Evening check (6 PM ET):** Evaluate open bets for resolutions
5. **Stats:** Track your win rate and P&L over time

## Setup

```bash
npm install
```

## Manual Testing

```bash
# Fetch and display today's market pick
node index.js daily

# Check for bet resolutions
node index.js evaluate

# Show current stats
node index.js stats
```

## Database

Located at `bets.db` (SQLite)

Schema:
- `id` - Auto-incrementing bet ID
- `market_id` - Kalshi market ticker
- `market_title` - Human-readable title
- `side` - 'yes' or 'no'
- `odds` - Price paid (0-1)
- `amount` - Bet amount (default $10)
- `created_at` - When bet was placed
- `close_time` - Market close time
- `resolved_at` - When bet was resolved
- `result` - 'win', 'loss', or 'push'
- `pnl` - Profit/loss in dollars

## Market Selection Criteria

- Binary (yes/no) markets only
- Odds between 30¢-70¢ (competitive, not obvious)
- Minimum volume: $10
- Minimum open interest: $5
- Avoids obscure sports games
- Scored by volume, open interest, and closeness to 50/50

## OpenClaw Integration

The app integrates with OpenClaw via:
- Telegram inline buttons for bet placement
- Cron jobs for daily schedule
- Database for persistence

### Cron Jobs

**Daily Market (9 AM ET):**
```javascript
{
  schedule: { kind: "cron", expr: "0 9 * * *", tz: "America/New_York" },
  payload: { 
    kind: "agentTurn", 
    message: "Run the daily Kalshi market picker: cd /data/.openclaw/workspace/paulyclawt/kalshi-game && node index.js daily",
    timeoutSeconds: 120
  },
  sessionTarget: "isolated",
  delivery: { mode: "announce", channel: "telegram", to: "-5009779044" }
}
```

**Evaluate Bets (6 PM ET):**
```javascript
{
  schedule: { kind: "cron", expr: "0 18 * * *", tz: "America/New_York" },
  payload: { 
    kind: "agentTurn",
    message: "Evaluate open Kalshi bets: cd /data/.openclaw/workspace/paulyclawt/kalshi-game && node index.js evaluate",
    timeoutSeconds: 120
  },
  sessionTarget: "isolated",
  delivery: { mode: "announce", channel: "telegram", to: "-5009779044" }
}
```

## Future Enhancements

- [ ] Webhook for instant resolution notifications
- [ ] Multiple bet sizes
- [ ] Leaderboard for group members
- [ ] Smart auto-betting based on ML
- [ ] Historical analysis and strategy testing
