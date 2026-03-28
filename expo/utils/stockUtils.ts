import { StockData, TradeHistory, Portfolio } from '@/types/stock';

// Generate mock AppLovin stock data
export function generateMockStockData(days: number = 30): StockData[] {
  const data: StockData[] = [];
  const now = new Date();
  let price = 45 + Math.random() * 20; // Starting around $45-65 for AppLovin
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Add some randomness to price movement
    const change = (Math.random() - 0.5) * 4; // -2 to +2 dollars
    price += change;
    price = Math.max(price, 20); // Ensure price doesn't go too low
    
    // Generate random volume
    const volume = 1000000 + Math.random() * 5000000;
    
    data.push({
      timestamp: date.getTime(),
      price: parseFloat(price.toFixed(2)),
      volume: Math.round(volume)
    });
  }
  
  return data;
}

// Generate more detailed intraday data for the current day
export function generateIntradayData(basePrice: number): StockData[] {
  const data: StockData[] = [];
  const now = new Date();
  now.setHours(16, 0, 0, 0); // Market close at 4 PM
  
  let price = basePrice;
  
  // Generate data points for market hours (9:30 AM to 4 PM)
  for (let i = 0; i <= 390; i += 5) { // 5-minute intervals
    const date = new Date(now);
    date.setHours(9, 30, 0, 0); // Market open at 9:30 AM
    date.setMinutes(date.getMinutes() + i);
    
    // More volatile intraday movements
    const change = (Math.random() - 0.5) * 1;
    price += change;
    
    // Generate random volume
    const volume = 20000 + Math.random() * 100000;
    
    data.push({
      timestamp: date.getTime(),
      price: parseFloat(price.toFixed(2)),
      volume: Math.round(volume)
    });
  }
  
  return data;
}

// Enhanced trend direction detection based on the specific graph data
export function getTrendDirection(data: StockData[], sensitivity: number = 0.5): {
  direction: 'up' | 'down' | 'neutral',
  percentage: number,
  strength: 'strong' | 'moderate' | 'weak'
} {
  if (data.length < 3) {
    return { direction: 'neutral', percentage: 0, strength: 'weak' };
  }
  
  // Use different analysis approaches based on data length
  let analysisPoints = Math.min(data.length, 10);
  
  // For very short datasets (like 1sec chart), use fewer points
  if (data.length <= 5) {
    analysisPoints = data.length;
  }
  
  const recentData = data.slice(-analysisPoints);
  
  // Calculate the slope using linear regression for trend direction
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  recentData.forEach((point, index) => {
    sumX += index;
    sumY += point.price;
    sumXY += index * point.price;
    sumXX += index * index;
  });
  
  const n = recentData.length;
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  // Calculate percentage change from first to last point in the analysis window
  const firstPrice = recentData[0].price;
  const lastPrice = recentData[recentData.length - 1].price;
  const percentage = ((lastPrice - firstPrice) / firstPrice) * 100;
  
  // Also calculate the trend over the last few points for immediate direction
  const lastFewPoints = Math.min(3, recentData.length);
  const veryRecentData = recentData.slice(-lastFewPoints);
  const recentFirstPrice = veryRecentData[0].price;
  const recentLastPrice = veryRecentData[veryRecentData.length - 1].price;
  const recentPercentage = ((recentLastPrice - recentFirstPrice) / recentFirstPrice) * 100;
  
  // Determine direction based on both slope and recent price movement
  let direction: 'up' | 'down' | 'neutral' = 'neutral';
  
  // Adjust thresholds based on sensitivity
  const slopeThreshold = sensitivity * 0.05;
  const percentageThreshold = sensitivity * 0.05;
  
  // Use both overall trend (slope/percentage) and recent movement for decision
  const overallTrendUp = slope > slopeThreshold && percentage > percentageThreshold;
  const overallTrendDown = slope < -slopeThreshold && percentage < -percentageThreshold;
  const recentTrendUp = recentPercentage > percentageThreshold;
  const recentTrendDown = recentPercentage < -percentageThreshold;
  
  // Prioritize recent movement but consider overall trend
  if (recentTrendUp || (overallTrendUp && !recentTrendDown)) {
    direction = 'up';
  } else if (recentTrendDown || (overallTrendDown && !recentTrendUp)) {
    direction = 'down';
  }
  
  // Determine strength based on the magnitude of change and consistency
  let strength: 'strong' | 'moderate' | 'weak' = 'weak';
  const absPercentage = Math.abs(percentage);
  const absRecentPercentage = Math.abs(recentPercentage);
  const absSlope = Math.abs(slope);
  
  // Strong trend: significant movement in both recent and overall analysis
  if ((absPercentage > 1.0 && absRecentPercentage > 0.3) || absSlope > 0.3) {
    strength = 'strong';
  } 
  // Moderate trend: decent movement in either recent or overall
  else if ((absPercentage > 0.3 && absRecentPercentage > 0.1) || absSlope > 0.1) {
    strength = 'moderate';
  }
  
  // Use the more significant percentage for reporting
  const reportedPercentage = Math.abs(recentPercentage) > Math.abs(percentage) ? recentPercentage : percentage;
  
  return {
    direction,
    percentage: parseFloat(reportedPercentage.toFixed(2)),
    strength
  };
}

// Calculate price movement direction and percentage based on specific graph data
export function getPriceMovement(data: StockData[], periods: number = 3): {
  direction: 'up' | 'down' | 'neutral',
  percentage: number
} {
  if (data.length < 2) {
    return { direction: 'neutral', percentage: 0 };
  }
  
  // Use fewer periods for shorter datasets
  const actualPeriods = Math.min(periods, data.length - 1);
  const recentData = data.slice(-actualPeriods - 1);
  
  const oldPrice = recentData[0].price;
  const currentPrice = recentData[recentData.length - 1].price;
  const change = currentPrice - oldPrice;
  const percentage = (change / oldPrice) * 100;
  
  let direction: 'up' | 'down' | 'neutral' = 'neutral';
  
  // Lower threshold for more responsive direction detection
  if (percentage > 0.05) direction = 'up';
  else if (percentage < -0.05) direction = 'down';
  
  return {
    direction,
    percentage: parseFloat(percentage.toFixed(2))
  };
}

// Format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Format large numbers
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }
  return value.toString();
}

// Format date
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Format time
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Calculate portfolio value
export function calculatePortfolioValue(
  shares: number,
  currentPrice: number,
  cash: number,
  averageBuyPrice: number
): Portfolio {
  const sharesValue = shares * currentPrice;
  const totalValue = sharesValue + cash;
  const totalInvested = shares * averageBuyPrice;
  const profitLoss = sharesValue - totalInvested;
  const profitLossPercentage = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
  
  return {
    cash,
    shares,
    averageBuyPrice,
    totalInvested,
    totalValue,
    profitLoss,
    profitLossPercentage: parseFloat(profitLossPercentage.toFixed(2))
  };
}