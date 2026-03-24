#!/usr/bin/env node

/**
 * OpenClaw integration handler
 * Called by cron jobs to send messages to Telegram
 */

const { sendDailyMarket, evaluateBets } = require('./index');

const TELEGRAM_CHANNEL = 'telegram';
const TELEGRAM_TARGET = '-5009779044'; // Paulymarket group

/**
 * Send message via OpenClaw (expects to be called from OpenClaw context)
 */
async function sendToTelegram(message, buttons = null) {
  // Output in a format OpenClaw can parse
  const output = {
    channel: TELEGRAM_CHANNEL,
    target: TELEGRAM_TARGET,
    message,
    buttons
  };
  
  console.log(JSON.stringify(output));
}

/**
 * Daily market job
 */
async function dailyMarketJob() {
  try {
    const result = await sendDailyMarket();
    
    if (!result) {
      console.error('No markets found');
      return;
    }

    await sendToTelegram(result.message, result.buttons);
  } catch (error) {
    console.error('Error in daily market job:', error);
    await sendToTelegram(`⚠️ Error fetching daily market: ${error.message}`);
  }
}

/**
 * Evaluation job
 */
async function evaluationJob() {
  try {
    const result = await evaluateBets();
    
    // Only send if there are resolutions
    if (result.resolutions && result.resolutions.length > 0) {
      await sendToTelegram(result.message);
    }
  } catch (error) {
    console.error('Error in evaluation job:', error);
  }
}

// CLI interface
if (require.main === module) {
  const job = process.argv[2];

  (async () => {
    if (job === 'daily') {
      await dailyMarketJob();
    } else if (job === 'evaluate') {
      await evaluationJob();
    } else {
      console.error('Usage: node openclaw-handler.js [daily|evaluate]');
      process.exit(1);
    }
  })().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
