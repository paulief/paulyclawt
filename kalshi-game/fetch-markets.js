const axios = require('axios');

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Filter criteria
const MIN_BID = 0.20;
const MAX_BID = 0.80;
const MIN_VOLUME = 0; // Minimum volume in dollars
const MIN_OPEN_INTEREST = 0; // Minimum open interest

// Keywords to avoid (obscure sports/games)
const AVOID_KEYWORDS = [
  'NCAA', 'Division', 'Conference', 
  'Minor League', 'Triple-A', 'Double-A',
  'preseason', 'spring training'
];

/**
 * Fetch markets created in the last 24 hours from Kalshi
 */
async function fetchRecentMarkets() {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const response = await axios.get(`${KALSHI_API_BASE}/markets`, {
      params: {
        limit: 100,
        status: 'open',
        // Note: Kalshi API might not have created_after, will use close_time as proxy
      },
      headers: {
        'Accept': 'application/json'
      }
    });

    return response.data.markets || [];
  } catch (error) {
    console.error('Error fetching markets:', error.message);
    throw error;
  }
}

/**
 * Check if market meets our criteria
 */
function meetsInterestCriteria(market) {
  // Check if it's a yes/no market
  if (market.market_type !== 'binary') {
    return false;
  }

  // Check status - 'active' is the new term for 'open'
  if (market.status !== 'active' && market.status !== 'open') {
    return false;
  }

  // Get current bids (new API uses _dollars suffix and string format)
  const yesBid = parseFloat(market.yes_bid_dollars || market.yes_bid || 0);
  const noBid = parseFloat(market.no_bid_dollars || market.no_bid || 0);

  // Skip if no bids exist yet (0.00 means no market activity)
  if (yesBid === 0 || noBid === 0) {
    return false;
  }

  // Check if odds are competitive (not obvious)
  if (yesBid < MIN_BID || yesBid > MAX_BID) {
    return false;
  }

  // Check volume and open interest (new API uses _fp suffix)
  const volume = parseFloat(market.volume_fp || market.volume || 0);
  const openInterest = parseFloat(market.open_interest_fp || market.open_interest || 0);

  if (volume < MIN_VOLUME || openInterest < MIN_OPEN_INTEREST) {
    return false;
  }

  // Check for obscure events
  const title = market.title.toLowerCase();
  for (const keyword of AVOID_KEYWORDS) {
    if (title.includes(keyword.toLowerCase())) {
      return false;
    }
  }

  return true;
}

/**
 * Score markets by interestingness
 */
function scoreMarket(market) {
  let score = 0;

  // Higher volume = more interesting
  const volume = parseFloat(market.volume_fp || market.volume || 0);
  score += Math.log10(volume + 1) * 10;

  // Higher open interest = more popular
  const openInterest = parseFloat(market.open_interest_fp || market.open_interest || 0);
  score += Math.log10(openInterest + 1) * 5;

  // Closer to 50/50 odds = more uncertain/interesting
  const yesBid = parseFloat(market.yes_bid_dollars || market.yes_bid || 0.5);
  const closenessTo50 = 1 - Math.abs(yesBid - 0.5) * 2;
  score += closenessTo50 * 20;

  // Longer time to close = more time to think
  const daysToClose = (new Date(market.close_time) - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysToClose > 1 && daysToClose < 30) {
    score += 5;
  }

  return score;
}

/**
 * Main function: fetch and filter markets
 */
async function getInterestingMarkets(limit = 5) {
  const markets = await fetchRecentMarkets();
  
  // Filter by criteria
  const interesting = markets
    .filter(meetsInterestCriteria)
    .map(market => ({
      ...market,
      score: scoreMarket(market)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return interesting;
}

module.exports = {
  getInterestingMarkets,
  fetchRecentMarkets
};
