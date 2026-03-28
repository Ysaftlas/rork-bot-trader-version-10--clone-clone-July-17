export interface TradingBot {
  id: string;
  name: string;
  stockSymbol: string;
  stockName: string;
  isActive: boolean;
  createdAt: number;
  settings: {
    maxInvestmentPerTrade: number;
    investmentType: 'dollars' | 'shares';
    chartPeriod: '1sec' | '5min' | '1D' | '1DSec' | '5MinSec';
    tradingMethod: 'trend_reversal' | 'direction_change_reference' | 'direction_change_buy' | 'price_comparison' | 'slope_analysis' | 'confirmed_recovery';
    dollarDropThreshold?: number; // Only used for direction_change_reference method
    // Enhanced Dollar Drop settings
    dollarDropEnabled?: boolean; // Apply Dollar Drop logic across all trading methods
    profitTakingEnabled?: boolean; // Enable profit taking with dollar drop trigger
    profitTakingPercentage?: number; // Percentage profit threshold (default 10%)
    profitTakingDollarAmount?: number; // Dollar profit threshold
    dollarDropTriggerAmount?: number; // Dollar drop amount to trigger sell (default $0.10)
    sellAtBuyPriceEnabled?: boolean; // Sell if price falls back to or below buy price
    consecutiveFallsEnabled?: boolean; // Sell after consecutive price falls
    consecutiveFallsCount?: number; // Number of consecutive falls to trigger sell (default 3)
    // Enhanced Dollar Drop Protection with timing delays
    enhancedDropProtectionEnabled?: boolean; // Enable enhanced drop protection with timing delays
    firstDelaySeconds?: number; // First delay in seconds (default 15)
    secondDelaySeconds?: number; // Second delay in seconds (default 30)
    // Confirmed Recovery settings
    confirmedRecoveryFirstDelay?: number; // First delay for confirmed recovery (default 15)
    confirmedRecoverySecondDelay?: number; // Second delay for confirmed recovery (default 30)
  };
  lastProcessedIndex?: number; // Used for direction_change_buy method to track processed direction changes
  stats: {
    totalTrades: number;
    totalProfit: number;
    winRate: number;
    lastTradeAt: number | null;
  };
  currentPosition?: {
    buyPrice: number;
    shares: number;
    timestamp: number;
    consecutiveFalls?: number; // Track consecutive price falls
    lastPrice?: number; // Track last price for consecutive falls detection
    priceHistory?: number[]; // Track price history for consecutive live price drops
  };
}

export interface BotTradeHistory {
  id: string;
  botId: string;
  timestamp: number;
  type: 'BUY' | 'SELL';
  price: number;
  shares: number;
  total: number;
  profit: number;
  stockSymbol: string;
}