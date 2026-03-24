#!/usr/bin/env node

const { getInterestingMarkets } = require('./fetch-markets');
const { recordBet, evaluateOpenBets, getCurrentStats, getBetHistory } = require('./bet-manager');

/**
 * Format market as Telegram message
 */
function formatMarketMessage(market) {
  const closeDate = new Date(market.close_time).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const volume = parseFloat(market.volume_fp || market.volume || 0);
  const openInterest = parseFloat(market.open_interest_fp || market.open_interest || 0);
  
  const volumeDollars = volume.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });

  const openInterestDollars = openInterest.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });

  const yesBid = parseFloat(market.yes_bid_dollars || market.yes_bid || 0);
  const noBid = parseFloat(market.no_bid_dollars || market.no_bid || 0);
  const yesAsk = parseFloat(market.yes_ask_dollars || market.yes_ask || 0);
  const noAsk = parseFloat(market.no_ask_dollars || market.no_ask || 0);

  // Use bid if available, otherwise use ask, otherwise derive from opposite side
  const yesPrice = yesBid || (yesAsk && yesAsk < 1 ? yesAsk : (noBid ? 1 - noBid : 0));
  const noPrice = noBid || (noAsk && noAsk < 1 ? noAsk : (yesBid ? 1 - yesBid : 0));

  return `🎲 **Daily Market Pick** | ${new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })}

**${market.title}**

📊 **Current Odds:**
• YES: ${(yesPrice * 100).toFixed(0)}¢ (${(yesPrice * 100).toFixed(0)}%)
• NO: ${(noPrice * 100).toFixed(0)}¢ (${(noPrice * 100).toFixed(0)}%)

📈 **Activity:**
• Volume: ${volumeDollars}
• Open Interest: ${openInterestDollars}
• Closes: ${closeDate}

💰 **Your Bet:** $10.00`;
}

/**
 * Format bet confirmation
 */
function formatBetConfirmation(betResult) {
  const profit = parseFloat(betResult.potentialProfit);
  const profitStr = profit > 0 
    ? `+$${profit.toFixed(2)}`
    : `-$${Math.abs(profit).toFixed(2)}`;

  return `✅ **Bet Recorded!**

You're betting **${betResult.side.toUpperCase()}** at $${betResult.odds.toFixed(2)}

💵 Bet Amount: $${betResult.amount.toFixed(2)}
🎯 Potential Profit: ${profitStr}`;
}

/**
 * Format resolution summary
 */
function formatResolutionSummary(resolutions) {
  if (resolutions.length === 0) {
    return '📊 No bets resolved today.';
  }

  let message = '🔔 **Bet Resolution Alert**\n\n';

  for (const res of resolutions) {
    const emoji = res.result === 'win' ? '✅' : '❌';
    const pnlStr = res.pnl >= 0 
      ? `+$${res.pnl.toFixed(2)}`
      : `-$${Math.abs(res.pnl).toFixed(2)}`;

    message += `${emoji} **${res.bet.market_title}**\n`;
    message += `Market Result: ${res.marketResult.toUpperCase()}\n`;
    message += `Your Position: ${res.bet.side.toUpperCase()} at $${res.bet.odds.toFixed(2)}\n`;
    message += `P&L: ${pnlStr}\n\n`;
  }

  // Add stats
  const stats = getCurrentStats();
  message += `📊 **Your Stats:**\n`;
  message += `• Total Bets: ${stats.total_bets}\n`;
  message += `• Record: ${stats.wins}W-${stats.losses}L${stats.pushes > 0 ? `-${stats.pushes}P` : ''}\n`;
  message += `• Win Rate: ${stats.win_rate || 0}%\n`;
  message += `• Total P&L: ${stats.total_pnl >= 0 ? '+' : ''}$${stats.total_pnl.toFixed(2)}`;

  return message;
}

/**
 * Format stats message
 */
function formatStats() {
  const stats = getCurrentStats();
  
  if (stats.total_bets === 0) {
    return '📊 **Your Stats**\n\nNo bets placed yet! Wait for the next market pick.';
  }

  return `📊 **Your Stats**

• Total Bets: ${stats.total_bets}
• Record: ${stats.wins}W-${stats.losses}L${stats.pushes > 0 ? `-${stats.pushes}P` : ''}
• Win Rate: ${stats.win_rate || 0}%
• Total P&L: ${stats.total_pnl >= 0 ? '+' : ''}$${stats.total_pnl.toFixed(2)}`;
}

/**
 * Main: Send daily market
 */
async function sendDailyMarket() {
  try {
    const markets = await getInterestingMarkets(5);
    
    if (markets.length === 0) {
      console.log('No interesting markets found today');
      return null;
    }

    // Pick the top market
    const market = markets[0];
    const message = formatMarketMessage(market);

    const yesBid = parseFloat(market.yes_bid_dollars || market.yes_bid || 0);
    const noBid = parseFloat(market.no_bid_dollars || market.no_bid || 0);
    const yesAsk = parseFloat(market.yes_ask_dollars || market.yes_ask || 0);
    const noAsk = parseFloat(market.no_ask_dollars || market.no_ask || 0);

    const yesPrice = yesBid || (yesAsk && yesAsk < 1 ? yesAsk : (noBid ? 1 - noBid : 0));
    const noPrice = noBid || (noAsk && noAsk < 1 ? noAsk : (yesBid ? 1 - yesBid : 0));

    return {
      message,
      market,
      buttons: [
        { text: `📈 Bet YES - ${(yesPrice * 100).toFixed(0)}¢`, callback_data: `bet:yes:${market.ticker}` },
        { text: `📉 Bet NO - ${(noPrice * 100).toFixed(0)}¢`, callback_data: `bet:no:${market.ticker}` },
        { text: '⏭️ Skip', callback_data: 'bet:skip' }
      ]
    };
  } catch (error) {
    console.error('Error in sendDailyMarket:', error);
    throw error;
  }
}

/**
 * Main: Evaluate open bets
 */
async function evaluateBets() {
  try {
    const resolutions = await evaluateOpenBets();
    const message = formatResolutionSummary(resolutions);
    
    return {
      message,
      resolutions
    };
  } catch (error) {
    console.error('Error in evaluateBets:', error);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];

  (async () => {
    if (command === 'daily') {
      const result = await sendDailyMarket();
      if (result) {
        console.log(result.message);
        console.log('\nButtons:', result.buttons);
        console.log('\nMarket data:', JSON.stringify(result.market, null, 2));
      }
    } else if (command === 'evaluate') {
      const result = await evaluateBets();
      console.log(result.message);
    } else if (command === 'stats') {
      console.log(formatStats());
    } else if (command === 'bet' && process.argv[3] && process.argv[4]) {
      // For testing: node index.js bet yes TICKER
      const side = process.argv[3];
      const ticker = process.argv[4];
      console.log(`Would record bet: ${side} on ${ticker}`);
    } else {
      console.log('Usage:');
      console.log('  node index.js daily     - Fetch and display daily market');
      console.log('  node index.js evaluate  - Check open bets for resolution');
      console.log('  node index.js stats     - Show current stats');
    }
  })().catch(console.error);
}

module.exports = {
  sendDailyMarket,
  evaluateBets,
  recordBet,
  formatBetConfirmation,
  formatStats,
  getCurrentStats,
  getBetHistory
};
