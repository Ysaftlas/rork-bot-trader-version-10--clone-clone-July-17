import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder, Platform, TouchableOpacity } from 'react-native';
import Svg, { Line, Polyline, Circle, Rect } from 'react-native-svg';
import { StockData } from '@/types/stock';
import { BeatSequence } from '@/utils/beatsPerMinute';
import Colors from '@/constants/colors';
import { formatCurrency, formatTime } from '@/utils/stockUtils';
import { useStockStore } from '@/store/stockStore';

interface StockChartProps {
  data: StockData[];
  period: '1sec' | '5min' | '1D' | '1DSec' | '5MinSec' | '5min+1Min';
  height?: number;
  highlightedSequence?: BeatSequence | null;
}

const StockChart: React.FC<StockChartProps> = ({
  data,
  period,
  height = 400,
  highlightedSequence
}) => {
  const { selectedStock, intradayData, fiveMinuteData, oneSecondData } = useStockStore();
  const [chartData, setChartData] = useState<StockData[]>([]);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showOHLCV, setShowOHLCV] = useState<boolean>(false);
  const [showStrength, setShowStrength] = useState<boolean>(false);
  const [showDirectionChanges, setShowDirectionChanges] = useState<boolean>(false);
  const [hoverPoint, setHoverPoint] = useState<{
    x: number;
    y: number;
    data: StockData;
    screenX: number;
  } | null>(null);
  const [dimensions] = useState({
    width: Dimensions.get('window').width - 40,
    height
  });

  useEffect(() => {
    let filteredData: StockData[] = [];
    
    if (period === '1sec') {
      // For 1sec, use the dedicated real-time data (last 10 minutes + live updates)
      filteredData = [...oneSecondData];
      console.log(`Using 1-second real-time data for 1sec chart (${selectedStock.symbol}):`, filteredData.length, 'points');
    } else if (period === '5min') {
      // For 5min, use the dedicated 5-minute data from TwelveData
      filteredData = [...fiveMinuteData];
      console.log(`Using 5-minute data from TwelveData for 5min chart (${selectedStock.symbol}):`, filteredData.length, 'points');
    } else if (period === '1D') {
      // For 1D, use all 1-minute intraday data
      filteredData = [...intradayData];
      console.log(`Using 1-minute intraday data for 1D chart (${selectedStock.symbol}):`, filteredData.length, 'points');
    } else if (period === '1DSec') {
      // For 1DSec, use the full trading day second-by-second data
      // This now contains data from 9:30 AM onwards, continuously filled throughout the day
      filteredData = [...oneSecondData];
      console.log(`Using full trading day second-by-second data for 1DSec chart (${selectedStock.symbol}):`, filteredData.length, 'points');
    } else if (period === '5MinSec') {
      // For 5MinSec, combine 5-minute data with recent second-by-second data
      const now = Date.now();
      const tenMinutesAgo = now - (10 * 60 * 1000);
      
      // Get older 5-minute data (older than 10 minutes)
      const olderFiveMinData = fiveMinuteData.filter(d => d.timestamp < tenMinutesAgo);
      
      // Get recent second-by-second data (last 10 minutes)
      const recentSecondData = oneSecondData.filter(d => d.timestamp >= tenMinutesAgo);
      
      // Combine them
      filteredData = [...olderFiveMinData, ...recentSecondData];
      console.log(`Using combined data for 5MinSec chart (${selectedStock.symbol}): ${olderFiveMinData.length} 5-minute points + ${recentSecondData.length} second points = ${filteredData.length} total points`);
    } else if (period === '5min+1Min') {
      // For 5min+1Min, combine 5-minute data with recent 1-minute data for last 4 minutes
      const now = Date.now();
      const fourMinutesAgo = now - (4 * 60 * 1000);
      
      // Get older 5-minute data (older than 4 minutes)
      const olderFiveMinData = fiveMinuteData.filter(d => d.timestamp < fourMinutesAgo);
      
      // Get recent 1-minute data (last 4 minutes)
      const recentOneMinData = intradayData.filter(d => d.timestamp >= fourMinutesAgo);
      
      // Combine them
      filteredData = [...olderFiveMinData, ...recentOneMinData];
      console.log(`Using combined data for 5min+1Min chart (${selectedStock.symbol}): ${olderFiveMinData.length} 5-minute points + ${recentOneMinData.length} 1-minute points = ${filteredData.length} total points`);
    }
    
    // Sort by timestamp to ensure chronological order
    filteredData.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`${period} chart data points for ${selectedStock.symbol}:`, filteredData.length);
    if (filteredData.length > 0) {
      console.log(`${period} chart first point for ${selectedStock.symbol}:`, new Date(filteredData[0].timestamp).toLocaleString(), filteredData[0].price);
      console.log(`${period} chart last point for ${selectedStock.symbol}:`, new Date(filteredData[filteredData.length - 1].timestamp).toLocaleString(), filteredData[filteredData.length - 1].price);
    }
    
    setChartData(filteredData);
    setHoverPoint(null);
  }, [data, intradayData, fiveMinuteData, oneSecondData, period, selectedStock.symbol]);

  // Create pan responder for mobile touch interactions
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      handleHover(evt.nativeEvent.locationX, evt.nativeEvent.pageX);
    },
    onPanResponderMove: (evt) => {
      handleHover(evt.nativeEvent.locationX, evt.nativeEvent.pageX);
    },
    onPanResponderRelease: () => {
      // Keep the hover point visible even after release on mobile
    },
  });

  // Calculate trading day time bounds (9:30 AM to 4:00 PM EST)
  const getTradingDayBounds = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 9:30 AM EST
    const marketOpen = new Date(today);
    marketOpen.setHours(9, 30, 0, 0);
    
    // 4:00 PM EST
    const marketClose = new Date(today);
    marketClose.setHours(16, 0, 0, 0);
    
    return { marketOpen: marketOpen.getTime(), marketClose: marketClose.getTime() };
  };
  
  const { marketOpen, marketClose } = getTradingDayBounds();
  const tradingDayDuration = marketClose - marketOpen; // Total trading day in milliseconds
  
  // Calculate chart dimensions
  const padding = 20;
  const fullChartWidth = dimensions.width - (padding * 2);
  const volumeHeight = showVolume ? 80 : 0;
  const priceChartHeight = dimensions.height - volumeHeight;

  const handleHover = (locationX: number, screenX: number) => {
    if (chartData.length === 0) return;
    
    // Calculate price range
    const prices = chartData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const paddedMinPrice = minPrice - priceRange * 0.05;
    const paddedMaxPrice = maxPrice + priceRange * 0.05;
    const paddedRange = paddedMaxPrice - paddedMinPrice;
    
    // Find the closest data point to the hover position (accounting for padding)
    let closestIndex = 0;
    let minDistance = Infinity;
    
    chartData.forEach((d, index) => {
      const timeProgress = Math.min(1, Math.max(0, (d.timestamp - marketOpen) / tradingDayDuration));
      const x = timeProgress * fullChartWidth;
      const distance = Math.abs((locationX - padding) - x);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });
    
    const selectedData = chartData[closestIndex];
    const timeProgress = Math.min(1, Math.max(0, (selectedData.timestamp - marketOpen) / tradingDayDuration));
    const x = timeProgress * fullChartWidth + padding;
    const y = paddedRange > 0 
      ? priceChartHeight - ((selectedData.price - paddedMinPrice) / paddedRange) * priceChartHeight
      : priceChartHeight / 2;
    
    setHoverPoint({
      x,
      y,
      data: selectedData,
      screenX
    });
  };

  // Mouse event handlers for web
  const handleMouseMove = (event: any) => {
    if (Platform.OS === 'web') {
      const rect = event.currentTarget.getBoundingClientRect();
      const locationX = event.clientX - rect.left;
      const screenX = event.clientX;
      handleHover(locationX, screenX);
    }
  };

  const handleMouseLeave = () => {
    if (Platform.OS === 'web') {
      setHoverPoint(null);
    }
  };

  const getChartDescription = () => {
    switch (period) {
      case '1sec':
        return 'Last 10 minutes (1-minute intervals) + Real-time updates every second';
      case '5min':
        return "Today's trading session (5-minute intervals)";
      case '1D':
        return "Today's trading session (1-minute intervals)";
      case '1DSec':
        return "Full trading day (9:30 AM - 4:00 PM) with continuous second-by-second data";
      case '5MinSec':
        return "Today's trading session (5-minute intervals) + Last 10 minutes with second-by-second updates";
      case '5min+1Min':
        return "Today's trading session (5-minute intervals) + Last 4 minutes with 1-minute intervals";
      default:
        return '';
    }
  };

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.noDataText}>No {selectedStock.name} data available for {period}</Text>
        <Text style={styles.noDataSubtext}>
          {period === '1sec' 
            ? `Waiting for real-time ${selectedStock.name} data from TwelveData...` 
            : period === '1D' 
              ? `Waiting for today's 1-minute ${selectedStock.name} data from TwelveData...` 
              : period === '1DSec'
                ? `Waiting for combined ${selectedStock.name} data from TwelveData...`
                : period === '5MinSec'
                  ? `Waiting for combined 5-minute + real-time ${selectedStock.name} data from TwelveData...`
                  : period === '5min+1Min'
                    ? `Waiting for combined 5-minute + 1-minute ${selectedStock.name} data from TwelveData...`
                    : `Waiting for today's 5-minute ${selectedStock.name} data from TwelveData...`}
        </Text>
      </View>
    );
  }

  // Calculate chart points with proper padding
  
  const prices = chartData.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const paddedMinPrice = minPrice - priceRange * 0.05;
  const paddedMaxPrice = maxPrice + priceRange * 0.05;
  const paddedRange = paddedMaxPrice - paddedMinPrice;
  
  // Calculate the current progress through the trading day
  const getCurrentProgress = () => {
    if (chartData.length === 0) return 0;
    
    const latestDataTime = chartData[chartData.length - 1].timestamp;
    const currentTime = Math.min(Date.now(), marketClose);
    const timeToUse = Math.max(latestDataTime, Math.max(currentTime, marketOpen));
    
    const progress = Math.min(1, Math.max(0, (timeToUse - marketOpen) / tradingDayDuration));
    return progress;
  };
  
  const currentProgress = getCurrentProgress();
  const chartWidth = fullChartWidth * currentProgress; // Progressive width based on time
  
  // Calculate volume data
  const volumes = chartData.map(d => d.volume);
  const maxVolume = Math.max(...volumes);
  
  // Calculate strength indicators
  const calculateStrength = (currentPrice: number, previousPrice: number, avgVolume: number, currentVolume: number): 'Weak' | 'Moderate' | 'Strong' => {
    const priceChange = Math.abs(currentPrice - previousPrice);
    const priceChangePercent = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    
    // Combine price movement and volume to determine strength
    const strengthScore = priceChangePercent * volumeRatio;
    
    if (strengthScore >= 0.5) return 'Strong';
    if (strengthScore >= 0.2) return 'Moderate';
    return 'Weak';
  };
  
  const avgVolume = volumes.length > 0 ? volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length : 0;
  const strengthIndicators = chartData.map((d, i) => {
    if (i === 0) return 'Moderate'; // First point has no previous data
    return calculateStrength(d.price, chartData[i - 1].price, avgVolume, d.volume);
  });
  
  // Calculate direction changes
  const getDirectionChanges = () => {
    if (chartData.length < 3) return [];
    
    const directionChanges: number[] = [];
    
    for (let i = 1; i < chartData.length - 1; i++) {
      const prevPrice = chartData[i - 1].price;
      const currentPrice = chartData[i].price;
      const nextPrice = chartData[i + 1].price;
      
      // Check if this is a local minimum (uptrend starts)
      const isLocalMin = prevPrice > currentPrice && currentPrice < nextPrice;
      // Check if this is a local maximum (downtrend starts)
      const isLocalMax = prevPrice < currentPrice && currentPrice > nextPrice;
      
      if (isLocalMin || isLocalMax) {
        directionChanges.push(i);
      }
    }
    
    return directionChanges;
  };
  
  const directionChangeIndices = getDirectionChanges();
  
  const points = chartData.map((d, i) => {
    // Map each data point to its actual time position within the trading day
    const timeProgress = Math.min(1, Math.max(0, (d.timestamp - marketOpen) / tradingDayDuration));
    const x = timeProgress * fullChartWidth + padding;
    const y = paddedRange > 0 
      ? priceChartHeight - ((d.price - paddedMinPrice) / paddedRange) * priceChartHeight
      : priceChartHeight / 2;
    return { x, y };
  });
  
  // Calculate volume bars
  const volumeBars = showVolume ? chartData.map((d, i) => {
    const timeProgress = Math.min(1, Math.max(0, (d.timestamp - marketOpen) / tradingDayDuration));
    const x = timeProgress * fullChartWidth + padding;
    const barWidth = Math.max(1, fullChartWidth / Math.max(chartData.length, 390) * 0.8); // 390 minutes in trading day
    const barHeight = maxVolume > 0 ? (d.volume / maxVolume) * (volumeHeight - 10) : 0; // 10px padding
    const y = priceChartHeight + (volumeHeight - barHeight);
    return { x: x - barWidth / 2, y, width: barWidth, height: barHeight };
  }) : [];
  
  const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');
  
  // Determine price color
  const firstPrice = chartData[0].price;
  const lastPrice = chartData[chartData.length - 1].price;
  const priceColor = lastPrice >= firstPrice ? Colors.light.chart.up : Colors.light.chart.down;

  // Calculate highlighted sequence points if provided
  const highlightedPoints: { x: number; y: number; index: number }[] = [];
  if (highlightedSequence) {
    // Find the indices in chartData that correspond to the highlighted sequence
    for (let i = 0; i < chartData.length; i++) {
      const dataPoint = chartData[i];
      const isInSequence = highlightedSequence.dataPoints.some(
        seqPoint => Math.abs(seqPoint.timestamp - dataPoint.timestamp) < 1000 // Within 1 second
      );
      
      if (isInSequence) {
        highlightedPoints.push({
          x: points[i].x,
          y: points[i].y,
          index: i
        });
      }
    }
  }

  return (
    <View style={styles.container}>
      {/* Floating tooltip that follows mouse */}
      {hoverPoint && (
        <View style={[
          styles.floatingTooltip, 
          { 
            left: Math.min(Math.max(hoverPoint.x - 60, 10), dimensions.width - 130),
            top: Math.max(hoverPoint.y - (showOHLCV ? 120 : 80), 10)
          }
        ]}>
          {showOHLCV ? (
            <>
              <Text style={styles.tooltipTime}>{formatTime(hoverPoint.data.timestamp)}</Text>
              <Text style={styles.tooltipOHLCV}>O: {formatCurrency(hoverPoint.data.open || hoverPoint.data.price)}</Text>
              <Text style={styles.tooltipOHLCV}>H: {formatCurrency(hoverPoint.data.high || hoverPoint.data.price)}</Text>
              <Text style={styles.tooltipOHLCV}>L: {formatCurrency(hoverPoint.data.low || hoverPoint.data.price)}</Text>
              <Text style={styles.tooltipOHLCV}>C: {formatCurrency(hoverPoint.data.close || hoverPoint.data.price)}</Text>
              <Text style={styles.tooltipVolume}>V: {hoverPoint.data.volume.toLocaleString()}</Text>
              {showStrength && (
                <Text style={styles.tooltipStrength}>
                  Strength: {strengthIndicators[chartData.findIndex(d => d.timestamp === hoverPoint.data.timestamp)] || 'N/A'}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.tooltipPrice}>{formatCurrency(hoverPoint.data.price)}</Text>
              <Text style={styles.tooltipTime}>{formatTime(hoverPoint.data.timestamp)}</Text>
              {showStrength && (
                <Text style={styles.tooltipStrength}>
                  Strength: {strengthIndicators[chartData.findIndex(d => d.timestamp === hoverPoint.data.timestamp)] || 'N/A'}
                </Text>
              )}
            </>
          )}
        </View>
      )}
      
      <View
        style={{ width: dimensions.width, height: dimensions.height }}
        {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
        {...(Platform.OS === 'web' ? {
          onMouseMove: handleMouseMove,
          onMouseLeave: handleMouseLeave,
        } : {})}
      >
        <Svg width={dimensions.width} height={dimensions.height}>
          {/* Trading day progress background */}
          <Rect
            x={padding}
            y={0}
            width={fullChartWidth}
            height={priceChartHeight}
            fill="#F8F9FA"
            opacity={0.3}
          />
          
          {/* Current progress area */}
          <Rect
            x={padding}
            y={0}
            width={chartWidth}
            height={priceChartHeight}
            fill="#E3F2FD"
            opacity={0.2}
          />
          
          {/* Progress line indicator */}
          <Line
            x1={padding + chartWidth}
            y1={0}
            x2={padding + chartWidth}
            y2={priceChartHeight}
            stroke={Colors.light.primary}
            strokeWidth={2}
            opacity={0.6}
            strokeDasharray="5,5"
          />
          
          {/* Time axis markers */}
          {(() => {
            const timeMarkers = [];
            const intervals = [0, 0.25, 0.5, 0.75, 1]; // 9:30, 11:15, 1:00, 2:45, 4:00
            const timeLabels = ['9:30', '11:15', '1:00', '2:45', '4:00'];
            
            for (let i = 0; i < intervals.length; i++) {
              const progress = intervals[i];
              const x = padding + progress * fullChartWidth;
              const isActive = progress <= currentProgress;
              
              timeMarkers.push(
                <Line
                  key={`time-marker-${i}`}
                  x1={x}
                  y1={priceChartHeight - 5}
                  x2={x}
                  y2={priceChartHeight + 5}
                  stroke={isActive ? Colors.light.text : Colors.light.border}
                  strokeWidth={1}
                  opacity={isActive ? 0.8 : 0.4}
                />
              );
            }
            
            return timeMarkers;
          })()}
          {/* Price line */}
          {points.length > 1 && (
            <Polyline
              points={pointsString}
              fill="none"
              stroke={priceColor}
              strokeWidth={2}
            />
          )}
          
          {/* Single point if only one data point */}
          {points.length === 1 && (
            <Circle
              cx={points[0].x}
              cy={points[0].y}
              r={4}
              fill={priceColor}
            />
          )}
          
          {/* Highlighted sequence dots */}
          {highlightedPoints.map((point, index) => (
            <Circle
              key={`highlight-${point.index}`}
              cx={point.x}
              cy={point.y}
              r={6}
              fill={Colors.light.primary}
              stroke="#FFFFFF"
              strokeWidth={2}
              opacity={0.9}
            />
          ))}
          
          {/* Volume bars */}
          {showVolume && volumeBars.map((bar, index) => (
            <Rect
              key={`volume-${index}`}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              fill={Colors.light.chart.volume}
              opacity={0.6}
            />
          ))}
          
          {/* Strength indicators */}
          {showStrength && points.map((point, index) => {
            const strength = strengthIndicators[index];
            const strengthColor = strength === 'Strong' ? '#22C55E' : strength === 'Moderate' ? '#F59E0B' : '#EF4444';
            const strengthSize = strength === 'Strong' ? 8 : strength === 'Moderate' ? 6 : 4;
            
            return (
              <Circle
                key={`strength-${index}`}
                cx={point.x}
                cy={point.y - 15} // Position above the price line
                r={strengthSize}
                fill={strengthColor}
                opacity={0.8}
              />
            );
          })}
          
          {/* Direction change indicators */}
          {showDirectionChanges && directionChangeIndices.map((index) => {
            const point = points[index];
            const prevPrice = chartData[index - 1]?.price;
            const currentPrice = chartData[index].price;
            const nextPrice = chartData[index + 1]?.price;
            
            // Determine if it's a peak (red) or valley (green)
            const isPeak = prevPrice < currentPrice && currentPrice > nextPrice;
            const dotColor = isPeak ? '#EF4444' : '#22C55E'; // Red for peaks, green for valleys
            
            return (
              <Circle
                key={`direction-change-${index}`}
                cx={point.x}
                cy={point.y}
                r={5}
                fill={dotColor}
                stroke="#FFFFFF"
                strokeWidth={2}
                opacity={0.9}
              />
            );
          })}
          
          {/* Hover line and point - only vertical line */}
          {hoverPoint && (
            <>
              {/* Vertical line at hover position - solid line */}
              <Line
                x1={hoverPoint.x}
                y1={0}
                x2={hoverPoint.x}
                y2={dimensions.height}
                stroke={Colors.light.text}
                strokeWidth={2}
                opacity={0.8}
              />
              
              {/* Hover point */}
              <Circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r={6}
                fill={priceColor}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </>
          )}
        </Svg>
      </View>
      
      {/* Toggle controls */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={styles.toggle}
          onPress={() => setShowVolume(!showVolume)}
        >
          <View style={[
            styles.toggleSwitch,
            showVolume && styles.toggleSwitchActive
          ]}>
            <View style={[
              styles.toggleKnob,
              showVolume && styles.toggleKnobActive
            ]} />
          </View>
          <Text style={styles.toggleText}>Volume Bars</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.toggle}
          onPress={() => setShowOHLCV(!showOHLCV)}
        >
          <View style={[
            styles.toggleSwitch,
            showOHLCV && styles.toggleSwitchActive
          ]}>
            <View style={[
              styles.toggleKnob,
              showOHLCV && styles.toggleKnobActive
            ]} />
          </View>
          <Text style={styles.toggleText}>Show OHLCV Data</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.toggle}
          onPress={() => setShowStrength(!showStrength)}
        >
          <View style={[
            styles.toggleSwitch,
            showStrength && styles.toggleSwitchActive
          ]}>
            <View style={[
              styles.toggleKnob,
              showStrength && styles.toggleKnobActive
            ]} />
          </View>
          <Text style={styles.toggleText}>Strength Indicator</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.toggle}
          onPress={() => setShowDirectionChanges(!showDirectionChanges)}
        >
          <View style={[
            styles.toggleSwitch,
            showDirectionChanges && styles.toggleSwitchActive
          ]}>
            <View style={[
              styles.toggleKnob,
              showDirectionChanges && styles.toggleKnobActive
            ]} />
          </View>
          <Text style={styles.toggleText}>Show Direction Changes</Text>
        </TouchableOpacity>
      </View>
      
      {/* Time axis labels */}
      <View style={styles.timeAxisContainer}>
        {(() => {
          const intervals = [0, 0.25, 0.5, 0.75, 1];
          const timeLabels = ['9:30', '11:15', '1:00', '2:45', '4:00'];
          
          return intervals.map((progress, i) => {
            const x = padding + progress * fullChartWidth;
            const isActive = progress <= currentProgress;
            
            return (
              <Text
                key={`time-label-${i}`}
                style={[
                  styles.timeLabel,
                  { 
                    left: x - 20, // Center the text
                    color: isActive ? Colors.light.text : Colors.light.border,
                    opacity: isActive ? 1 : 0.5
                  }
                ]}
              >
                {timeLabels[i]}
              </Text>
            );
          });
        })()}
      </View>
      
      {/* Progress indicator */}
      <View style={styles.progressIndicator}>
        <Text style={styles.progressText}>
          Trading Day Progress: {Math.round(currentProgress * 100)}%
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${currentProgress * 100}%` }
            ]} 
          />
        </View>
      </View>
      
      {/* Data source info */}
      <View style={styles.dataIndicator}>
        <Text style={styles.dataIndicatorText}>
          📊 Real {selectedStock.name} Data - {getChartDescription()}
        </Text>
        {chartData.length > 0 && (
          <Text style={styles.dataRangeText}>
            {formatTime(chartData[0].timestamp)} - {formatTime(chartData[chartData.length - 1].timestamp)}
            {(period === '1sec' || period === '1DSec' || period === '5MinSec') && ' (Updates every second)'}
            {period === '5min+1Min' && ' (5-min + 1-min intervals)'}
          </Text>
        )}
        {highlightedSequence && (
          <Text style={styles.highlightedText}>
            🔵 Highlighted: Beat sequence from {formatTime(highlightedSequence.startTime)} to {formatTime(highlightedSequence.endTime)}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    marginVertical: 10,
    position: 'relative',
  },
  noDataText: {
    textAlign: 'center',
    color: Colors.light.subtext,
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
  },
  noDataSubtext: {
    textAlign: 'center',
    color: Colors.light.subtext,
    marginTop: 8,
    fontSize: 14,
  },
  floatingTooltip: {
    position: 'absolute',
    backgroundColor: Colors.light.text,
    borderRadius: 8,
    padding: 8,
    minWidth: 120,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tooltipPrice: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tooltipVolume: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
  tooltipTime: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 4,
  },
  tooltipOHLCV: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'left',
    opacity: 0.9,
    fontFamily: 'monospace',
  },
  dataIndicator: {
    marginTop: 8,
    alignItems: 'center',
  },
  dataIndicatorText: {
    fontSize: 12,
    color: Colors.light.chart.up,
    fontWeight: '600',
    textAlign: 'center',
  },
  dataRangeText: {
    fontSize: 11,
    color: Colors.light.subtext,
    marginTop: 2,
    textAlign: 'center',
  },
  highlightedText: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 5,
    gap: 15,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: Colors.light.primary,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  toggleText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  tooltipStrength: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.9,
    marginTop: 2,
    fontWeight: '600',
  },
  timeAxisContainer: {
    position: 'relative',
    height: 20,
    marginTop: 5,
  },
  timeLabel: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    width: 40,
  },
  progressIndicator: {
    marginTop: 10,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '600',
    marginBottom: 5,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
  },
});

export default StockChart;