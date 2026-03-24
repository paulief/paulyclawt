const { insertBet, getOpenBets, resolveBet, getStats, getAllBets } = require('./db');
const axios = require('axios');

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const DEFAULT_BET_AMOUNT = 10.00; // $10 per bet

/**
 * Record a new bet
 */
function recordBet(market, side) {
  const yesBid = parseFloat(market.yes_bid_dollars || market.yes_bid || 0);
  const noBid = parseFloat(market.no_bid_dollars || market.no_bid || 0);
  const odds = side === 'yes' ? yesBid : noBid;
  const now = new Date().toISOString();

  const result = insertBet.run(
    market.ticker,
    market.ticker,
    market.title,
    side,
    odds,
    DEFAULT_BET_AMOUNT,
    now,
    market.close_time,
    JSON.stringify(market)
  );

  // Calculate potential profit
  const potentialProfit = side === 'yes' 
    ? (DEFAULT_BET_AMOUNT / odds) - DEFAULT_BET_AMOUNT
    : (DEFAULT_BET_AMOUNT / (1 - odds)) - DEFAULT_BET_AMOUNT;

  return {
    betId: result.lastInsertRowid,
    market: market.title,
    side,
    odds,
    amount: DEFAULT_BET_AMOUNT,
    potentialProfit: potentialProfit.toFixed(2)
  };
}

/**
 * Check market status from Kalshi
 */
async function checkMarketStatus(ticker) {
  try {
    const response = await axios.get(
      `${KALSHI_API_BASE}/markets/${ticker}`,
      {
        headers: { 'Accept': 'application/json' }
      }
    );

    return response.data.market;
  } catch (error) {
    console.error(`Error checking market ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Calculate P&L for a resolved bet
 */
function calculatePnL(bet, marketResult) {
  // marketResult is typically 'yes' or 'no' from Kalshi
  const won = bet.side === marketResult.toLowerCase();
  
  if (won) {
    // Win: get payout based on odds
    const payout = bet.amount / bet.odds;
    return {
      result: 'win',
      pnl: payout - bet.amount
    };
  } else {
    // Loss: lose the bet amount
    return {
      result: 'loss',
      pnl: -bet.amount
    };
  }
}

/**
 * Evaluate all open bets
 */
async function evaluateOpenBets() {
  const openBets = getOpenBets.all();
  const results = [];

  for (const bet of openBets) {
    const market = await checkMarketStatus(bet.market_ticker);
    
    if (!market) {
      console.log(`Could not fetch market ${bet.market_ticker}`);
      continue;
    }

    // Check if market is settled
    if (market.status === 'settled' || market.status === 'closed') {
      // Determine result
      const marketResult = market.result || market.settlement_value;
      
      if (marketResult) {
        const { result, pnl } = calculatePnL(bet, marketResult);
        const now = new Date().toISOString();
        
        resolveBet.run(now, result, pnl, bet.id);
        
        results.push({
          bet,
          result,
          pnl,
          marketResult
        });
      }
    }
  }

  return results;
}

/**
 * Get current stats
 */
function getCurrentStats() {
  return getStats.get();
}

/**
 * Get bet history
 */
function getBetHistory(limit = 10) {
  return getAllBets.all(limit);
}

module.exports = {
  recordBet,
  evaluateOpenBets,
  getCurrentStats,
  getBetHistory
};
