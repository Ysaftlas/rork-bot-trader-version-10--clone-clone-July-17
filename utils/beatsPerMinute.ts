import { StockData } from '@/types/stock';
import { formatCurrency, formatTime } from './stockUtils';

export interface BeatSequence {
  id: string;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  dollarGain: number;
  percentageChange: number;
  dataPoints: StockData[];
}

export function detectBeatSequences(data: StockData[], minConsecutiveIntervals: number = 4): BeatSequence[] {
  if (data.length < minConsecutiveIntervals + 1) return []; // Need at least minConsecutiveIntervals + 1 points
  
  const sequences: BeatSequence[] = [];
  let currentSequenceStart = -1;
  let consecutivePositiveCount = 0;
  
  // Check each interval for positive slope
  for (let i = 1; i < data.length; i++) {
    const currentPrice = data[i].price;
    const previousPrice = data[i - 1].price;
    const slope = currentPrice - previousPrice;
    
    if (slope > 0) {
      // Positive slope
      if (consecutivePositiveCount === 0) {
        currentSequenceStart = i - 1; // Start from the previous point
      }
      consecutivePositiveCount++;
    } else {
      // Negative or zero slope - end current sequence if it exists
      if (consecutivePositiveCount >= minConsecutiveIntervals && currentSequenceStart >= 0) {
        // We have a valid sequence of minConsecutiveIntervals+ consecutive positive intervals
        const endIndex = i - 1;
        const startData = data[currentSequenceStart];
        const endData = data[endIndex];
        
        const dollarGain = endData.price - startData.price;
        const percentageChange = (dollarGain / startData.price) * 100;
        
        sequences.push({
          id: `beat-${currentSequenceStart}-${endIndex}`,
          startIndex: currentSequenceStart,
          endIndex: endIndex,
          startTime: startData.timestamp,
          endTime: endData.timestamp,
          startPrice: startData.price,
          endPrice: endData.price,
          dollarGain: parseFloat(dollarGain.toFixed(2)),
          percentageChange: parseFloat(percentageChange.toFixed(2)),
          dataPoints: data.slice(currentSequenceStart, endIndex + 1)
        });
      }
      
      consecutivePositiveCount = 0;
      currentSequenceStart = -1;
    }
  }
  
  // Check if we have a sequence at the end
  if (consecutivePositiveCount >= minConsecutiveIntervals && currentSequenceStart >= 0) {
    const endIndex = data.length - 1;
    const startData = data[currentSequenceStart];
    const endData = data[endIndex];
    
    const dollarGain = endData.price - startData.price;
    const percentageChange = (dollarGain / startData.price) * 100;
    
    sequences.push({
      id: `beat-${currentSequenceStart}-${endIndex}`,
      startIndex: currentSequenceStart,
      endIndex: endIndex,
      startTime: startData.timestamp,
      endTime: endData.timestamp,
      startPrice: startData.price,
      endPrice: endData.price,
      dollarGain: parseFloat(dollarGain.toFixed(2)),
      percentageChange: parseFloat(percentageChange.toFixed(2)),
      dataPoints: data.slice(currentSequenceStart, endIndex + 1)
    });
  }
  
  return sequences;
}

export interface PotentialProfitSequence {
  id: string;
  originalSequence: BeatSequence;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  dollarGain: number;
  percentageChange: number;
  dataPoints: StockData[];
  excludedBeats: number; // Number of beats excluded (first + last)
}

export function calculatePotentialProfitSequences(beatSequences: BeatSequence[]): PotentialProfitSequence[] {
  const potentialProfitSequences: PotentialProfitSequence[] = [];
  
  beatSequences.forEach((sequence) => {
    // Need at least 3 data points to exclude first and last (minimum 1 point in between)
    if (sequence.dataPoints.length < 3) {
      return; // Skip sequences that are too short
    }
    
    // Exclude first and last data points
    const trimmedDataPoints = sequence.dataPoints.slice(1, -1);
    
    if (trimmedDataPoints.length === 0) {
      return; // Skip if no data points remain after trimming
    }
    
    const startData = trimmedDataPoints[0];
    const endData = trimmedDataPoints[trimmedDataPoints.length - 1];
    
    const dollarGain = endData.price - startData.price;
    const percentageChange = (dollarGain / startData.price) * 100;
    
    potentialProfitSequences.push({
      id: `potential-${sequence.id}`,
      originalSequence: sequence,
      startIndex: sequence.startIndex + 1, // +1 because we excluded first
      endIndex: sequence.endIndex - 1, // -1 because we excluded last
      startTime: startData.timestamp,
      endTime: endData.timestamp,
      startPrice: startData.price,
      endPrice: endData.price,
      dollarGain: parseFloat(dollarGain.toFixed(2)),
      percentageChange: parseFloat(percentageChange.toFixed(2)),
      dataPoints: trimmedDataPoints,
      excludedBeats: 2 // Always 2 (first + last)
    });
  });
  
  return potentialProfitSequences;
}

export function formatBeatSequence(sequence: BeatSequence): {
  timeRange: string;
  priceRange: string;
  gain: string;
  percentage: string;
} {
  return {
    timeRange: `${formatTime(sequence.startTime)} - ${formatTime(sequence.endTime)}`,
    priceRange: `${formatCurrency(sequence.startPrice)} → ${formatCurrency(sequence.endPrice)}`,
    gain: `${sequence.dollarGain > 0 ? '+' : ''}${formatCurrency(sequence.dollarGain)}`,
    percentage: `${sequence.percentageChange > 0 ? '+' : ''}${sequence.percentageChange.toFixed(2)}%`
  };
}

export function formatPotentialProfitSequence(sequence: PotentialProfitSequence): {
  timeRange: string;
  priceRange: string;
  gain: string;
  percentage: string;
} {
  return {
    timeRange: `${formatTime(sequence.startTime)} - ${formatTime(sequence.endTime)}`,
    priceRange: `${formatCurrency(sequence.startPrice)} → ${formatCurrency(sequence.endPrice)}`,
    gain: `${sequence.dollarGain > 0 ? '+' : ''}${formatCurrency(sequence.dollarGain)}`,
    percentage: `${sequence.percentageChange > 0 ? '+' : ''}${sequence.percentageChange.toFixed(2)}%`
  };
}

export interface PotentialLossSequence {
  id: string;
  beforeReversalIndex: number;
  reversalIndex: number;
  afterReversalIndex: number;
  beforeReversalTime: number;
  reversalTime: number;
  afterReversalTime: number;
  beforeReversalPrice: number;
  reversalPrice: number;
  afterReversalPrice: number;
  dollarLoss: number;
  percentageChange: number;
  dataPoints: StockData[];
  // Legacy properties for backward compatibility
  upIndex: number;
  downIndex: number;
  upTime: number;
  downTime: number;
  upPrice: number;
  downPrice: number;
}

export function detectPotentialLossSequences(data: StockData[]): PotentialLossSequence[] {
  if (data.length < 4) return []; // Need at least 4 points for down-up-down pattern
  
  const lossSequences: PotentialLossSequence[] = [];
  
  // Look for patterns where price goes down, then up (reversal), then immediately down
  for (let i = 2; i < data.length - 1; i++) {
    const beforeBeforePrice = data[i - 2].price;
    const beforePrice = data[i - 1].price;
    const currentPrice = data[i].price;
    const nextPrice = data[i + 1].price;
    
    // Check for down-up-down pattern:
    // 1. Price goes down from beforeBefore to before (downward interval before reversal)
    // 2. Price goes up from before to current (upward reversal)
    // 3. Price goes down from current to next (downward interval after reversal)
    const isDownBeforeReversal = beforePrice < beforeBeforePrice;
    const isUpwardReversal = currentPrice > beforePrice;
    const isDownAfterReversal = nextPrice < currentPrice;
    
    if (isDownBeforeReversal && isUpwardReversal && isDownAfterReversal) {
      const dollarLoss = currentPrice - nextPrice; // Loss from reversal peak to after drop
      const percentageChange = (dollarLoss / currentPrice) * 100;
      
      lossSequences.push({
        id: `loss-${i - 1}-${i}-${i + 1}`,
        beforeReversalIndex: i - 1,
        reversalIndex: i,
        afterReversalIndex: i + 1,
        beforeReversalTime: data[i - 1].timestamp,
        reversalTime: data[i].timestamp,
        afterReversalTime: data[i + 1].timestamp,
        beforeReversalPrice: beforePrice,
        reversalPrice: currentPrice,
        afterReversalPrice: nextPrice,
        dollarLoss: parseFloat(dollarLoss.toFixed(2)),
        percentageChange: parseFloat(percentageChange.toFixed(2)),
        dataPoints: [data[i - 2], data[i - 1], data[i], data[i + 1]], // Include all 4 points for full context
        // Legacy properties for backward compatibility
        upIndex: i,
        downIndex: i + 1,
        upTime: data[i].timestamp,
        downTime: data[i + 1].timestamp,
        upPrice: currentPrice,
        downPrice: nextPrice
      });
    }
  }
  
  return lossSequences;
}

export function formatPotentialLossSequence(sequence: PotentialLossSequence): {
  timeRange: string;
  priceRange: string;
  loss: string;
  percentage: string;
  fullPattern: string;
} {
  return {
    timeRange: `${formatTime(sequence.beforeReversalTime)} - ${formatTime(sequence.afterReversalTime)}`,
    priceRange: `${formatCurrency(sequence.beforeReversalPrice)} → ${formatCurrency(sequence.reversalPrice)} → ${formatCurrency(sequence.afterReversalPrice)}`,
    loss: `-${formatCurrency(sequence.dollarLoss)}`,
    percentage: `-${sequence.percentageChange.toFixed(2)}%`,
    fullPattern: `${formatCurrency(sequence.beforeReversalPrice)} → ${formatCurrency(sequence.reversalPrice)} → ${formatCurrency(sequence.afterReversalPrice)}`
  };
}