import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useStockStore } from '@/store/stockStore';
import StockSelector from '@/components/StockSelector';
import StockInfo from '@/components/StockInfo';
import StockChart from '@/components/StockChart';


import MyBots from '@/components/MyBots';
import BeatsPerMinute from '@/components/BeatsPerMinute';
import PotentialProfit from '@/components/PotentialProfit';
import { getPriceMovement } from '@/utils/stockUtils';
import { detectBeatSequences, BeatSequence, calculatePotentialProfitSequences, PotentialProfitSequence, detectPotentialLossSequences, PotentialLossSequence } from '@/utils/beatsPerMinute';
import Colors from '@/constants/colors';

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'1sec' | '5min' | '1D' | '1DSec' | '5MinSec' | '5min+1Min'>('1D');
  const [selectedBeatSequence, setSelectedBeatSequence] = useState<BeatSequence | null>(null);
  const [selectedPotentialProfitSequence, setSelectedPotentialProfitSequence] = useState<PotentialProfitSequence | null>(null);
  const [selectedPotentialLossSequence, setSelectedPotentialLossSequence] = useState<PotentialLossSequence | null>(null);
  const [minConsecutiveIntervals, setMinConsecutiveIntervals] = useState<number>(4);
  
  const {
    selectedStock,
    setSelectedStock,
    stockData,
    intradayData,
    fiveMinuteData,
    oneSecondData,
    oneDaySecondData,
    currentPrice,

    isLoading,
    lastUpdated,
    fetchStockData,
    startRealTimeUpdates,
    stopRealTimeUpdates,


    apiCredentials,
    apiConnectionStatus,
    bots,
    createBot,
    toggleBot,
    deleteBot
  } = useStockStore();
  
  // Calculate trend direction based on the SPECIFIC selected chart period data using simple slope
  const { trendDirection, priceMovement } = useMemo(() => {
    let dataForAnalysis: any[] = [];
    
    // Get the exact data that corresponds to the selected chart
    if (chartPeriod === '1sec') {
      dataForAnalysis = [...oneSecondData];
    } else if (chartPeriod === '5min') {
      dataForAnalysis = [...fiveMinuteData];
    } else if (chartPeriod === '1D') {
      dataForAnalysis = [...intradayData];
    } else if (chartPeriod === '1DSec') {
      // For 1DSec, use the trading day accumulated second-by-second data
      // This contains data from 9:30 AM onwards, continuously filled throughout the trading day
      dataForAnalysis = [...oneDaySecondData];
    } else if (chartPeriod === '5MinSec') {
      // For 5MinSec, combine 5-minute data with recent second-by-second data
      const now = Date.now();
      const tenMinutesAgo = now - (10 * 60 * 1000);
      
      // Get older 5-minute data (older than 10 minutes)
      const olderFiveMinData = fiveMinuteData.filter(d => d.timestamp < tenMinutesAgo);
      
      // Get recent second-by-second data (last 10 minutes)
      const recentSecondData = oneDaySecondData.filter(d => d.timestamp >= tenMinutesAgo);
      
      // Combine them
      dataForAnalysis = [...olderFiveMinData, ...recentSecondData];
    } else if (chartPeriod === '5min+1Min') {
      // For 5min+1Min, combine 5-minute data with recent 1-minute data for last 4 minutes
      const now = Date.now();
      const fourMinutesAgo = now - (4 * 60 * 1000);
      
      // Get older 5-minute data (older than 4 minutes)
      const olderFiveMinData = fiveMinuteData.filter(d => d.timestamp < fourMinutesAgo);
      
      // Get recent 1-minute data (last 4 minutes)
      const recentOneMinData = intradayData.filter(d => d.timestamp >= fourMinutesAgo);
      
      // Combine them
      dataForAnalysis = [...olderFiveMinData, ...recentOneMinData];
    }
    
    // If no data for selected period, show neutral
    if (dataForAnalysis.length < 2) {
      return {
        trendDirection: {
          direction: 'neutral' as const,
          percentage: 0,
          strength: 'weak' as const
        },
        priceMovement: {
          direction: 'neutral' as const,
          percentage: 0
        }
      };
    }
    
    // Sort by timestamp to ensure chronological order
    dataForAnalysis.sort((a, b) => a.timestamp - b.timestamp);
    
    // Get the last two data points to calculate slope
    const lastPoint = dataForAnalysis[dataForAnalysis.length - 1];
    const previousPoint = dataForAnalysis[dataForAnalysis.length - 2];
    
    // Calculate slope (price difference)
    const priceDifference = lastPoint.price - previousPoint.price;
    const percentage = previousPoint.price > 0 ? (priceDifference / previousPoint.price) * 100 : 0;
    
    // Determine direction based on slope
    let direction: 'up' | 'down' | 'neutral' = 'neutral';
    if (priceDifference > 0) {
      direction = 'up';
    } else if (priceDifference < 0) {
      direction = 'down';
    }
    
    // Determine strength based on percentage change
    let strength: 'strong' | 'moderate' | 'weak' = 'weak';
    const absPercentage = Math.abs(percentage);
    
    if (absPercentage > 0.5) {
      strength = 'strong';
    } else if (absPercentage > 0.1) {
      strength = 'moderate';
    }
    
    console.log(`Simple slope analysis for ${chartPeriod} chart (${selectedStock.symbol}):`, {
      dataPoints: dataForAnalysis.length,
      previousPrice: previousPoint.price,
      lastPrice: lastPoint.price,
      priceDifference,
      direction,
      percentage: percentage.toFixed(4),
      strength
    });
    
    const calculatedTrendDirection = {
      direction,
      percentage: parseFloat(percentage.toFixed(2)),
      strength
    };
    
    const calculatedPriceMovement = getPriceMovement(dataForAnalysis);
    
    return {
      trendDirection: calculatedTrendDirection,
      priceMovement: calculatedPriceMovement
    };
  }, [chartPeriod, oneSecondData, oneDaySecondData, fiveMinuteData, intradayData, selectedStock.symbol]);
  
  // Calculate beat sequences for the current chart period
  const beatSequences = useMemo(() => {
    let dataForAnalysis: any[] = [];
    
    if (chartPeriod === '1sec') {
      dataForAnalysis = [...oneSecondData];
    } else if (chartPeriod === '5min') {
      dataForAnalysis = [...fiveMinuteData];
    } else if (chartPeriod === '1D') {
      dataForAnalysis = [...intradayData];
    } else if (chartPeriod === '1DSec') {
      // For 1DSec, use the trading day accumulated second-by-second data
      // This contains data from 9:30 AM onwards, continuously filled throughout the trading day
      dataForAnalysis = [...oneDaySecondData];
    } else if (chartPeriod === '5min+1Min') {
      // For 5min+1Min, combine 5-minute data with recent 1-minute data for last 4 minutes
      const now = Date.now();
      const fourMinutesAgo = now - (4 * 60 * 1000);
      
      // Get older 5-minute data (older than 4 minutes)
      const olderFiveMinData = fiveMinuteData.filter(d => d.timestamp < fourMinutesAgo);
      
      // Get recent 1-minute data (last 4 minutes)
      const recentOneMinData = intradayData.filter(d => d.timestamp >= fourMinutesAgo);
      
      // Combine them
      dataForAnalysis = [...olderFiveMinData, ...recentOneMinData];
    }
    
    if (dataForAnalysis.length < minConsecutiveIntervals + 1) return [];
    
    // Sort by timestamp to ensure chronological order
    dataForAnalysis.sort((a, b) => a.timestamp - b.timestamp);
    
    return detectBeatSequences(dataForAnalysis, minConsecutiveIntervals);
  }, [chartPeriod, oneSecondData, oneDaySecondData, fiveMinuteData, intradayData, minConsecutiveIntervals]);
  
  // Calculate potential profit sequences based on beat sequences
  const potentialProfitSequences = useMemo(() => {
    return calculatePotentialProfitSequences(beatSequences);
  }, [beatSequences]);
  
  // Calculate potential loss sequences for the current chart period
  const potentialLossSequences = useMemo(() => {
    let dataForAnalysis: any[] = [];
    
    if (chartPeriod === '1sec') {
      dataForAnalysis = [...oneSecondData];
    } else if (chartPeriod === '5min') {
      dataForAnalysis = [...fiveMinuteData];
    } else if (chartPeriod === '1D') {
      dataForAnalysis = [...intradayData];
    } else if (chartPeriod === '1DSec') {
      dataForAnalysis = [...oneDaySecondData];
    } else if (chartPeriod === '5min+1Min') {
      const now = Date.now();
      const fourMinutesAgo = now - (4 * 60 * 1000);
      const olderFiveMinData = fiveMinuteData.filter(d => d.timestamp < fourMinutesAgo);
      const recentOneMinData = intradayData.filter(d => d.timestamp >= fourMinutesAgo);
      dataForAnalysis = [...olderFiveMinData, ...recentOneMinData];
    }
    
    if (dataForAnalysis.length < 3) return [];
    
    dataForAnalysis.sort((a, b) => a.timestamp - b.timestamp);
    
    return detectPotentialLossSequences(dataForAnalysis);
  }, [chartPeriod, oneSecondData, oneDaySecondData, fiveMinuteData, intradayData]);
  
  // Calculate live price and last interval price
  const { livePrice, lastIntervalPrice } = useMemo(() => {
    let dataForCurrentChart: any[] = [];
    
    // Get data for current chart period
    if (chartPeriod === '1sec') {
      dataForCurrentChart = [...oneSecondData];
    } else if (chartPeriod === '5min') {
      dataForCurrentChart = [...fiveMinuteData];
    } else if (chartPeriod === '1D') {
      dataForCurrentChart = [...intradayData];
    } else if (chartPeriod === '1DSec') {
      // For 1DSec, use the trading day accumulated second-by-second data
      // This contains data from 9:30 AM onwards, continuously filled throughout the trading day
      dataForCurrentChart = [...oneDaySecondData];
    } else if (chartPeriod === '5min+1Min') {
      // For 5min+1Min, combine 5-minute data with recent 1-minute data for last 4 minutes
      const now = Date.now();
      const fourMinutesAgo = now - (4 * 60 * 1000);
      
      // Get older 5-minute data (older than 4 minutes)
      const olderFiveMinData = fiveMinuteData.filter(d => d.timestamp < fourMinutesAgo);
      
      // Get recent 1-minute data (last 4 minutes)
      const recentOneMinData = intradayData.filter(d => d.timestamp >= fourMinutesAgo);
      
      // Combine them
      dataForCurrentChart = [...olderFiveMinData, ...recentOneMinData];
    }
    
    // Sort by timestamp to get the most recent
    dataForCurrentChart.sort((a, b) => a.timestamp - b.timestamp);
    
    const livePrice = currentPrice; // This is the live price from API
    const lastIntervalPrice = dataForCurrentChart.length > 0 
      ? dataForCurrentChart[dataForCurrentChart.length - 1].price 
      : currentPrice;
    
    return { livePrice, lastIntervalPrice };
  }, [currentPrice, chartPeriod, oneSecondData, oneDaySecondData, fiveMinuteData, intradayData]);
  
  useEffect(() => {
    // Initialize API credentials and fetch data
    fetchStockData();
    
    // Set up interval to fetch data every 10 seconds for real-time updates
    const interval = setInterval(() => {
      fetchStockData();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [selectedStock.symbol]);
  
  useEffect(() => {
    // Start/stop real-time updates based on chart period
    if (chartPeriod === '1sec' || chartPeriod === '1DSec' || chartPeriod === '5MinSec') {
      startRealTimeUpdates();
    } else {
      stopRealTimeUpdates();
    }
    
    // Cleanup on unmount
    return () => {
      stopRealTimeUpdates();
    };
  }, [chartPeriod, selectedStock.symbol]);
  
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchStockData();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
    setRefreshing(false);
  };
  

  
  const renderPeriodSelector = () => {
    const periods: Array<'1sec' | '5min' | '1D' | '1DSec' | '5MinSec' | '5min+1Min'> = ['1sec', '5min', '1D', '1DSec', '5MinSec', '5min+1Min'];
    
    return (
      <View style={styles.periodContainer}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              chartPeriod === period && styles.activePeriodButton
            ]}
            onPress={() => {
              setChartPeriod(period);
              setSelectedBeatSequence(null); // Clear selection when changing period
              setSelectedPotentialProfitSequence(null); // Clear potential profit selection
            }}
          >
            <Text
              style={[
                styles.periodText,
                chartPeriod === period && styles.activePeriodText
              ]}
            >
              {period}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  const getDataSourceInfo = () => {
    switch (apiConnectionStatus) {
      case 'connected':
        return `TwelveData API (Live ${selectedStock.name} Data)`;
      case 'testing':
        return 'TwelveData API (Testing...)';
      case 'disconnected':
      default:
        return 'TwelveData API (Disconnected)';
    }
  };
  
  const handleBeatSequenceSelect = (sequence: BeatSequence) => {
    if (selectedBeatSequence?.id === sequence.id) {
      setSelectedBeatSequence(null); // Deselect if already selected
    } else {
      setSelectedBeatSequence(sequence);
      setSelectedPotentialProfitSequence(null); // Clear potential profit selection
    }
  };
  
  const handlePotentialProfitSequenceSelect = (sequence: PotentialProfitSequence) => {
    if (selectedPotentialProfitSequence?.id === sequence.id) {
      setSelectedPotentialProfitSequence(null); // Deselect if already selected
    } else {
      setSelectedPotentialProfitSequence(sequence);
      setSelectedBeatSequence(null); // Clear beat sequence selection
    }
  };
  
  const handleMinConsecutiveIntervalsChange = (value: number) => {
    setMinConsecutiveIntervals(value);
    setSelectedBeatSequence(null); // Clear selection when changing intervals
    setSelectedPotentialProfitSequence(null); // Clear potential profit selection
  };
  
  // Show error if no data available
  if (stockData.length === 0 && !isLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.errorContainer}>
        <StockSelector
          selectedStock={selectedStock}
          onStockSelect={setSelectedStock}
        />
        
        <Text style={styles.errorTitle}>Unable to Load {selectedStock.name} Data</Text>
        <Text style={styles.errorText}>
          Failed to fetch real {selectedStock.name} stock data from TwelveData API.
        </Text>
        <Text style={styles.errorSubtext}>
          Please check your API key and internet connection, then try refreshing.
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>Refresh Data</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }
  
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <StockSelector
        selectedStock={selectedStock}
        onStockSelect={setSelectedStock}
      />
      
      <StockInfo
        symbol={selectedStock.symbol}
        name={selectedStock.company}
        price={currentPrice}
        change={stockData.length > 0 ? currentPrice - stockData[0].price : 0}
        changePercent={priceMovement.percentage}
        livePrice={livePrice}
        lastIntervalPrice={lastIntervalPrice}
        trendDirection={trendDirection}
      />
      
      <View style={styles.trendInfoContainer}>
        <Text style={styles.trendInfoTitle}>
          Trend Analysis ({chartPeriod} Chart)
        </Text>
        <Text style={styles.trendInfoText}>
          Direction: <Text style={{ 
            color: trendDirection.direction === 'up' 
              ? Colors.light.chart.up 
              : trendDirection.direction === 'down' 
                ? Colors.light.chart.down 
                : Colors.light.subtext,
            fontWeight: 'bold'
          }}>
            {trendDirection.direction.toUpperCase()}
          </Text>
        </Text>
        <Text style={styles.trendInfoText}>
          Strength: {trendDirection.strength.toUpperCase()}
        </Text>
        <Text style={styles.trendInfoText}>
          Change: {trendDirection.percentage > 0 ? '+' : ''}{trendDirection.percentage.toFixed(4)}%
        </Text>
        <Text style={styles.trendInfoSubtext}>
          Based on slope between last two data points on {chartPeriod} chart
        </Text>
      </View>
      
      {renderPeriodSelector()}
      
      <StockChart
        data={stockData}
        period={chartPeriod}
        height={400}
        highlightedSequence={selectedBeatSequence || (selectedPotentialProfitSequence ? {
          id: selectedPotentialProfitSequence.id,
          startIndex: selectedPotentialProfitSequence.startIndex,
          endIndex: selectedPotentialProfitSequence.endIndex,
          startTime: selectedPotentialProfitSequence.startTime,
          endTime: selectedPotentialProfitSequence.endTime,
          startPrice: selectedPotentialProfitSequence.startPrice,
          endPrice: selectedPotentialProfitSequence.endPrice,
          dollarGain: selectedPotentialProfitSequence.dollarGain,
          percentageChange: selectedPotentialProfitSequence.percentageChange,
          dataPoints: selectedPotentialProfitSequence.dataPoints
        } : null)}
      />
      
      <BeatsPerMinute
        sequences={beatSequences}
        selectedSequence={selectedBeatSequence}
        onSequenceSelect={handleBeatSequenceSelect}
        minConsecutiveIntervals={minConsecutiveIntervals}
        onMinConsecutiveIntervalsChange={handleMinConsecutiveIntervalsChange}
      />
      
      <PotentialProfit
        sequences={potentialProfitSequences}
        selectedSequence={selectedPotentialProfitSequence}
        onSequenceSelect={handlePotentialProfitSequenceSelect}
        lossSequences={potentialLossSequences}
        selectedLossSequence={selectedPotentialLossSequence}
        onLossSequenceSelect={setSelectedPotentialLossSequence}
      />
      

      

      <MyBots
        bots={bots}
        onCreateBot={createBot}
        onToggleBot={toggleBot}
        onDeleteBot={deleteBot}
      />
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}
        </Text>
        <Text style={[
          styles.dataSourceText,
          { color: apiConnectionStatus === 'connected' ? Colors.light.chart.up : Colors.light.primary }
        ]}>
          Data source: {getDataSourceInfo()}
        </Text>
        {apiConnectionStatus === 'connected' && (
          <Text style={styles.realDataNotice}>
            ✅ Showing REAL {selectedStock.name} stock data from TwelveData
          </Text>
        )}
        {apiConnectionStatus === 'disconnected' && (
          <Text style={styles.errorNotice}>
            ❌ Failed to connect to TwelveData API. Check your API key in Settings.
          </Text>
        )}
        <Text style={styles.interactionHint}>
          💡 Hover over the chart to see detailed price and time information
        </Text>
        <Text style={styles.updateFrequency}>
          🔄 Auto-refreshing every 10 seconds for real-time data
          {(chartPeriod === '1sec' || chartPeriod === '1DSec' || chartPeriod === '5MinSec') && ' + continuous 1-second data accumulation (9:30 AM - 4:00 PM)'}
        </Text>
        {chartPeriod === '1sec' && (
          <Text style={styles.continuousDataInfo}>
            📈 1sec chart records pure second-by-second data points
            {oneSecondData.length > 0 && ` (${oneSecondData.length} data points recorded)`}
          </Text>
        )}
        {chartPeriod === '1DSec' && (
          <Text style={styles.continuousDataInfo}>
            📈 1DSec chart continuously fills with data throughout the trading day (9:30 AM - 4:00 PM)
            {oneDaySecondData.length > 0 && ` (${oneDaySecondData.length} data points accumulated)`}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.subtext,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.light.subtext,
    marginBottom: 24,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  trendInfoContainer: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
  },
  trendInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8,
  },
  trendInfoText: {
    fontSize: 14,
    color: Colors.light.subtext,
    marginBottom: 4,
  },
  trendInfoSubtext: {
    fontSize: 12,
    color: Colors.light.subtext,
    fontStyle: 'italic',
    marginTop: 4,
  },
  periodContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 4,
    marginVertical: 10,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activePeriodButton: {
    backgroundColor: Colors.light.primary,
  },
  periodText: {
    fontSize: 16,
    color: Colors.light.subtext,
    fontWeight: '500',
  },
  activePeriodText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.subtext,
  },
  dataSourceText: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  realDataNotice: {
    fontSize: 12,
    color: Colors.light.chart.up,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorNotice: {
    fontSize: 12,
    color: Colors.light.chart.down,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  interactionHint: {
    fontSize: 12,
    color: Colors.light.primary,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  updateFrequency: {
    fontSize: 12,
    color: Colors.light.secondary,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  continuousDataInfo: {
    fontSize: 11,
    color: Colors.light.chart.up,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
    fontStyle: 'italic',
  }
});