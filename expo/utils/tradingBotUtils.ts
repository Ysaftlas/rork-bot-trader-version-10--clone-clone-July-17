import { StockData } from '@/types/stock';
import { TradingBot } from '@/types/bot';

export interface DirectionChangePoint {
  index: number;
  timestamp: number;
  price: number;
  type: 'peak' | 'valley';
}

// Get direction change points from stock data
export function getDirectionChangePoints(data: StockData[]): DirectionChangePoint[] {
  if (data.length < 3) return [];
  
  const directionChanges: DirectionChangePoint[] = [];
  
  for (let i = 1; i < data.length - 1; i++) {
    const prevPrice = data[i - 1].price;
    const currentPrice = data[i].price;
    const nextPrice = data[i + 1].price;
    
    // Check if this is a local minimum (valley - uptrend starts)
    const isLocalMin = prevPrice > currentPrice && currentPrice < nextPrice;
    // Check if this is a local maximum (peak - downtrend starts)
    const isLocalMax = prevPrice < currentPrice && currentPrice > nextPrice;
    
    if (isLocalMin) {
      directionChanges.push({
        index: i,
        timestamp: data[i].timestamp,
        price: currentPrice,
        type: 'valley'
      });
    } else if (isLocalMax) {
      directionChanges.push({
        index: i,
        timestamp: data[i].timestamp,
        price: currentPrice,
        type: 'peak'
      });
    }
  }
  
  return directionChanges;
}

// Get the most recent direction change point
export function getLastDirectionChangePoint(data: StockData[]): DirectionChangePoint | null {
  const directionChanges = getDirectionChangePoints(data);
  return directionChanges.length > 0 ? directionChanges[directionChanges.length - 1] : null;
}

// Check if bot should buy using direction change reference method
export function shouldBuyDirectionChangeReference(
  data: StockData[],
  currentPrice: number
): { shouldBuy: boolean; referencePoint: DirectionChangePoint | null } {
  const lastDirectionChange = getLastDirectionChangePoint(data);
  
  if (!lastDirectionChange) {
    return { shouldBuy: false, referencePoint: null };
  }
  
  // Buy if current price is higher than the last direction change point
  const shouldBuy = currentPrice > lastDirectionChange.price;
  
  return { shouldBuy, referencePoint: lastDirectionChange };
}

// Enhanced Dollar Drop logic that can be applied to any trading method
export function shouldSellWithDollarDrop(
  bot: TradingBot,
  currentPrice: number,
  data: StockData[]
): { shouldSell: boolean; reason: string; updatePosition?: Partial<TradingBot['currentPosition']> } {
  if (!bot.currentPosition) {
    return { shouldSell: false, reason: 'No current position' };
  }
  
  const { buyPrice, shares } = bot.currentPosition;
  const settings = bot.settings;
  
  // Calculate current profit/loss
  const currentValue = currentPrice * shares;
  const investedAmount = buyPrice * shares;
  const profitLoss = currentValue - investedAmount;
  const profitLossPercentage = (profitLoss / investedAmount) * 100;
  
  // Check profit taking with dollar drop trigger
  if (settings.profitTakingEnabled) {
    const profitPercentageThreshold = settings.profitTakingPercentage || 10;
    const profitDollarThreshold = settings.profitTakingDollarAmount || 0;
    const dollarDropTrigger = settings.dollarDropTriggerAmount || 0.10;
    
    // Check if we've reached profit threshold
    const reachedProfitThreshold = profitLossPercentage >= profitPercentageThreshold || 
                                  (profitDollarThreshold > 0 && profitLoss >= profitDollarThreshold);
    
    if (reachedProfitThreshold && data.length >= 2) {
      const previousPrice = data[data.length - 2].price;
      const priceDropFromPrevious = previousPrice - currentPrice;
      
      if (priceDropFromPrevious >= dollarDropTrigger) {
        return {
          shouldSell: true,
          reason: `Profit target reached (${profitLossPercentage.toFixed(1)}%) and price dropped ${priceDropFromPrevious.toFixed(2)}`
        };
      }
    }
  }
  
  // Check sell at buy price
  if (settings.sellAtBuyPriceEnabled && currentPrice <= buyPrice) {
    return {
      shouldSell: true,
      reason: `Price fell to/below buy price: ${currentPrice.toFixed(2)} <= ${buyPrice.toFixed(2)}`
    };
  }
  
  // Check consecutive falls (live price drops)
  if (settings.consecutiveFallsEnabled) {
    const fallsThreshold = settings.consecutiveFallsCount || 3;
    const priceHistory = bot.currentPosition.priceHistory || [buyPrice];
    
    // Add current price to history
    const updatedPriceHistory = [...priceHistory, currentPrice];
    
    // Keep only recent price history (last 20 prices to avoid memory issues)
    const recentPriceHistory = updatedPriceHistory.slice(-20);
    
    // Count consecutive price drops from the end
    let consecutiveFalls = 0;
    for (let i = recentPriceHistory.length - 1; i > 0; i--) {
      if (recentPriceHistory[i] < recentPriceHistory[i - 1]) {
        consecutiveFalls++;
      } else {
        break; // Stop counting when we find a price that didn't fall
      }
    }
    
    if (consecutiveFalls >= fallsThreshold) {
      return {
        shouldSell: true,
        reason: `Price fell for ${consecutiveFalls} consecutive live updates`,
        updatePosition: { priceHistory: [currentPrice], consecutiveFalls: 0 }
      };
    }
    
    return {
      shouldSell: false,
      reason: `Consecutive live falls: ${consecutiveFalls}/${fallsThreshold}`,
      updatePosition: { priceHistory: recentPriceHistory, consecutiveFalls }
    };
  }
  
  return { shouldSell: false, reason: 'Dollar Drop conditions not met' };
}

// Check if bot should sell using direction change reference method
export function shouldSellDirectionChangeReference(
  bot: TradingBot,
  currentPrice: number
): { shouldSell: boolean; reason: string } {
  if (!bot.currentPosition) {
    return { shouldSell: false, reason: 'No current position' };
  }
  
  const { buyPrice } = bot.currentPosition;
  const dollarDropThreshold = bot.settings.dollarDropThreshold || 5;
  
  // Sell if price has dropped by the configured dollar amount
  const priceDrop = buyPrice - currentPrice;
  const shouldSell = priceDrop >= dollarDropThreshold;
  
  return {
    shouldSell,
    reason: shouldSell 
      ? `Price dropped ${priceDrop.toFixed(2)} from buy price ${buyPrice.toFixed(2)}` 
      : `Price drop ${priceDrop.toFixed(2)} below threshold ${dollarDropThreshold}`
  };
}

// Check if bot should buy using direction change buy method
export function shouldBuyDirectionChangeBuy(
  data: StockData[],
  lastProcessedIndex?: number
): { shouldBuy: boolean; newDirectionChange: DirectionChangePoint | null } {
  if (data.length < 3) return { shouldBuy: false, newDirectionChange: null };
  
  const directionChanges = getDirectionChangePoints(data);
  if (directionChanges.length === 0) return { shouldBuy: false, newDirectionChange: null };
  
  const lastChange = directionChanges[directionChanges.length - 1];
  
  // Only buy if this is a new valley (direction change from down to up)
  // and we haven't processed this direction change before
  const isNewValley = lastChange.type === 'valley' && 
    (lastProcessedIndex === undefined || lastChange.index > lastProcessedIndex);
  
  return {
    shouldBuy: isNewValley,
    newDirectionChange: isNewValley ? lastChange : null
  };
}

// Check if bot should buy using trend reversal method (existing logic)
export function shouldBuyTrendReversal(data: StockData[]): boolean {
  if (data.length < 3) return false;
  
  const directionChanges = getDirectionChangePoints(data);
  if (directionChanges.length === 0) return false;
  
  const lastChange = directionChanges[directionChanges.length - 1];
  
  // Buy when trend changes from down to up (valley)
  return lastChange.type === 'valley';
}

// Check if bot should sell using trend reversal method (existing logic)
export function shouldSellTrendReversal(data: StockData[]): boolean {
  if (data.length < 3) return false;
  
  const directionChanges = getDirectionChangePoints(data);
  if (directionChanges.length === 0) return false;
  
  const lastChange = directionChanges[directionChanges.length - 1];
  
  // Sell when trend changes from up to down (peak)
  return lastChange.type === 'peak';
}

// Check if bot should buy using price comparison method
export function shouldBuyPriceComparison(data: StockData[]): boolean {
  if (data.length < 2) return false;
  
  const currentPrice = data[data.length - 1].price;
  const previousPrice = data[data.length - 2].price;
  
  // Buy if current price is higher than previous interval price
  return currentPrice > previousPrice;
}

// Check if bot should sell using price comparison method
export function shouldSellPriceComparison(data: StockData[]): boolean {
  if (data.length < 2) return false;
  
  const currentPrice = data[data.length - 1].price;
  const previousPrice = data[data.length - 2].price;
  
  // Sell if current price is lower than previous interval price
  return currentPrice < previousPrice;
}

// Check if bot should buy using slope analysis method
export function shouldBuySlopeAnalysis(data: StockData[]): boolean {
  if (data.length < 2) return false;
  
  const currentPrice = data[data.length - 1].price;
  const previousPrice = data[data.length - 2].price;
  
  // Buy if slope is positive (price is rising)
  return currentPrice > previousPrice;
}

// Check if bot should sell using slope analysis method
export function shouldSellSlopeAnalysis(data: StockData[]): boolean {
  if (data.length < 2) return false;
  
  const currentPrice = data[data.length - 1].price;
  const previousPrice = data[data.length - 2].price;
  
  // Sell if slope is negative (price is falling)
  return currentPrice < previousPrice;
}

// Check if the last interval is in a downward direction
export function isLastIntervalDownward(data: StockData[]): boolean {
  if (data.length < 2) return false;
  
  const currentPrice = data[data.length - 1].price;
  const previousPrice = data[data.length - 2].price;
  
  return currentPrice < previousPrice;
}

// Simulate checking price after delay (in real implementation, this would be async)
export function simulatePriceCheckAfterDelay(
  data: StockData[],
  delaySeconds: number,
  currentPrice: number
): { price: number; isUpward: boolean } {
  // In a real implementation, this would wait for the specified delay
  // and then fetch the live price. For simulation, we'll use a slight variation
  // of the current price to simulate market movement
  
  // Simulate some price movement (±0.5% random change)
  const randomChange = (Math.random() - 0.5) * 0.01; // -0.5% to +0.5%
  const simulatedPrice = currentPrice * (1 + randomChange);
  
  // Check if this simulated price shows upward movement compared to current
  const isUpward = simulatedPrice > currentPrice;
  
  return { price: simulatedPrice, isUpward };
}

// Check if bot should buy using confirmed recovery method
export function shouldBuyConfirmedRecovery(
  data: StockData[],
  currentPrice: number,
  firstDelaySeconds: number = 15,
  secondDelaySeconds: number = 30
): { shouldBuy: boolean; reason: string } {
  // Step 1: Check if the last interval is in a downward direction
  if (!isLastIntervalDownward(data)) {
    return {
      shouldBuy: false,
      reason: 'Last interval is not in downward direction'
    };
  }
  
  // Step 2: Simulate waiting first delay and check if price is still going down
  const firstCheck = simulatePriceCheckAfterDelay(data, firstDelaySeconds, currentPrice);
  
  // For confirmed recovery, we want the first check to show the price is still going down
  // (confirming the downtrend), then the second check to show upward movement
  if (firstCheck.isUpward) {
    return {
      shouldBuy: false,
      reason: `After ${firstDelaySeconds}s delay, price went up instead of continuing down`
    };
  }
  
  // Step 3: Simulate waiting second delay and check if price is now going up
  const secondCheck = simulatePriceCheckAfterDelay(data, secondDelaySeconds, firstCheck.price);
  
  if (!secondCheck.isUpward) {
    return {
      shouldBuy: false,
      reason: `After ${secondDelaySeconds}s delay, price is still not showing upward movement`
    };
  }
  
  // Both conditions met: downtrend confirmed, then upward recovery confirmed
  return {
    shouldBuy: true,
    reason: `Confirmed recovery: downtrend confirmed after ${firstDelaySeconds}s, upward movement confirmed after ${secondDelaySeconds}s`
  };
}

// Main trading decision function
export function makeTradingDecision(
  bot: TradingBot,
  data: StockData[],
  currentPrice: number,
  lastProcessedIndex?: number
): {
  action: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  referencePoint?: DirectionChangePoint | null;
  newDirectionChange?: DirectionChangePoint | null;
  updatePosition?: Partial<TradingBot['currentPosition']>;
} {
  if (!bot.isActive) {
    return { action: 'HOLD', reason: 'Bot is inactive' };
  }
  
  // Check Dollar Drop logic first if enabled and we have a position
  if (bot.settings.dollarDropEnabled && bot.currentPosition) {
    const dollarDropResult = shouldSellWithDollarDrop(bot, currentPrice, data);
    if (dollarDropResult.shouldSell) {
      return {
        action: 'SELL',
        reason: dollarDropResult.reason,
        updatePosition: dollarDropResult.updatePosition
      };
    }
    // Update position tracking even if not selling
    if (dollarDropResult.updatePosition) {
      return {
        action: 'HOLD',
        reason: dollarDropResult.reason,
        updatePosition: dollarDropResult.updatePosition
      };
    }
  }
  
  const tradingMethod = bot.settings.tradingMethod || 'trend_reversal';
  
  if (tradingMethod === 'price_comparison') {
    // Price comparison method
    if (!bot.currentPosition) {
      // No position, check if we should buy
      const shouldBuy = shouldBuyPriceComparison(data);
      
      if (shouldBuy && data.length >= 2) {
        const currentPrice = data[data.length - 1].price;
        const previousPrice = data[data.length - 2].price;
        return {
          action: 'BUY',
          reason: `Current price ${currentPrice.toFixed(2)} > previous price ${previousPrice.toFixed(2)}`
        };
      }
      
      return {
        action: 'HOLD',
        reason: data.length >= 2 
          ? `Current price ${data[data.length - 1].price.toFixed(2)} <= previous price ${data[data.length - 2].price.toFixed(2)}`
          : 'Insufficient data for price comparison'
      };
    } else {
      // Have position, check if we should sell
      const shouldSell = shouldSellPriceComparison(data);
      
      if (shouldSell && data.length >= 2) {
        const currentPrice = data[data.length - 1].price;
        const previousPrice = data[data.length - 2].price;
        return {
          action: 'SELL',
          reason: `Current price ${currentPrice.toFixed(2)} < previous price ${previousPrice.toFixed(2)}`
        };
      }
      
      return {
        action: 'HOLD',
        reason: data.length >= 2
          ? `Current price ${data[data.length - 1].price.toFixed(2)} >= previous price ${data[data.length - 2].price.toFixed(2)}`
          : 'Insufficient data for price comparison'
      };
    }
  } else if (tradingMethod === 'slope_analysis') {
    // Slope analysis method
    if (!bot.currentPosition) {
      // No position, check if we should buy
      const shouldBuy = shouldBuySlopeAnalysis(data);
      
      if (shouldBuy && data.length >= 2) {
        const currentPrice = data[data.length - 1].price;
        const previousPrice = data[data.length - 2].price;
        const slope = currentPrice - previousPrice;
        return {
          action: 'BUY',
          reason: `Positive slope: ${slope > 0 ? '+' : ''}${slope.toFixed(2)} (${previousPrice.toFixed(2)} → ${currentPrice.toFixed(2)})`
        };
      }
      
      return {
        action: 'HOLD',
        reason: data.length >= 2 
          ? `Negative/flat slope: ${(data[data.length - 1].price - data[data.length - 2].price).toFixed(2)}`
          : 'Insufficient data for slope analysis'
      };
    } else {
      // Have position, check if we should sell
      const shouldSell = shouldSellSlopeAnalysis(data);
      
      if (shouldSell && data.length >= 2) {
        const currentPrice = data[data.length - 1].price;
        const previousPrice = data[data.length - 2].price;
        const slope = currentPrice - previousPrice;
        return {
          action: 'SELL',
          reason: `Negative slope: ${slope.toFixed(2)} (${previousPrice.toFixed(2)} → ${currentPrice.toFixed(2)})`
        };
      }
      
      return {
        action: 'HOLD',
        reason: data.length >= 2
          ? `Positive/flat slope: ${(data[data.length - 1].price - data[data.length - 2].price).toFixed(2)}`
          : 'Insufficient data for slope analysis'
      };
    }
  } else if (tradingMethod === 'direction_change_reference') {
    // Direction change reference method
    if (!bot.currentPosition) {
      // No position, check if we should buy
      const { shouldBuy, referencePoint } = shouldBuyDirectionChangeReference(data, currentPrice);
      
      if (shouldBuy && referencePoint) {
        return {
          action: 'BUY',
          reason: `Current price ${currentPrice.toFixed(2)} > last direction change ${referencePoint.price.toFixed(2)}`,
          referencePoint
        };
      }
      
      return {
        action: 'HOLD',
        reason: referencePoint 
          ? `Current price ${currentPrice.toFixed(2)} <= last direction change ${referencePoint.price.toFixed(2)}`
          : 'No direction change reference point found',
        referencePoint
      };
    } else {
      // Have position, check if we should sell
      const { shouldSell, reason } = shouldSellDirectionChangeReference(bot, currentPrice);
      
      return {
        action: shouldSell ? 'SELL' : 'HOLD',
        reason
      };
    }
  } else if (tradingMethod === 'direction_change_buy') {
    // Direction change buy method - only buy on new direction changes from down to up
    if (!bot.currentPosition) {
      // No position, check if we should buy
      const { shouldBuy, newDirectionChange } = shouldBuyDirectionChangeBuy(data, lastProcessedIndex);
      
      if (shouldBuy && newDirectionChange) {
        return {
          action: 'BUY',
          reason: `Direction changed from DOWN to UP at ${newDirectionChange.price.toFixed(2)}`,
          newDirectionChange
        };
      }
      
      return {
        action: 'HOLD',
        reason: 'Waiting for new direction change from DOWN to UP'
      };
    } else {
      // Have position, use trend reversal logic for selling
      const shouldSell = shouldSellTrendReversal(data);
      
      return {
        action: shouldSell ? 'SELL' : 'HOLD',
        reason: shouldSell ? 'Trend changed from UP to DOWN' : 'Holding position, trend still up'
      };
    }
  } else if (tradingMethod === 'confirmed_recovery') {
    // Confirmed recovery method
    if (!bot.currentPosition) {
      // No position, check if we should buy using confirmed recovery logic
      const firstDelay = bot.settings.confirmedRecoveryFirstDelay || 15;
      const secondDelay = bot.settings.confirmedRecoverySecondDelay || 30;
      
      const { shouldBuy, reason } = shouldBuyConfirmedRecovery(
        data,
        currentPrice,
        firstDelay,
        secondDelay
      );
      
      return {
        action: shouldBuy ? 'BUY' : 'HOLD',
        reason
      };
    } else {
      // Have position, use trend reversal logic for selling
      const shouldSell = shouldSellTrendReversal(data);
      
      return {
        action: shouldSell ? 'SELL' : 'HOLD',
        reason: shouldSell ? 'Trend changed from UP to DOWN' : 'Holding position, trend still up'
      };
    }
  } else {
    // Trend reversal method (existing logic)
    if (!bot.currentPosition) {
      // No position, check if we should buy
      const shouldBuy = shouldBuyTrendReversal(data);
      
      return {
        action: shouldBuy ? 'BUY' : 'HOLD',
        reason: shouldBuy ? 'Trend changed from DOWN to UP' : 'Waiting for upward trend reversal'
      };
    } else {
      // Have position, check if we should sell
      const shouldSell = shouldSellTrendReversal(data);
      
      return {
        action: shouldSell ? 'SELL' : 'HOLD',
        reason: shouldSell ? 'Trend changed from UP to DOWN' : 'Holding position, trend still up'
      };
    }
  }
}

// Calculate shares to buy based on investment settings
export function calculateSharesToBuy(
  maxInvestment: number,
  investmentType: 'dollars' | 'shares',
  currentPrice: number,
  availableCash: number
): number {
  if (investmentType === 'shares') {
    // Direct share amount, but limited by available cash
    const maxAffordableShares = Math.floor(availableCash / currentPrice);
    return Math.min(maxInvestment, maxAffordableShares);
  } else {
    // Dollar amount investment
    const investmentAmount = Math.min(maxInvestment, availableCash);
    return Math.floor(investmentAmount / currentPrice);
  }
}