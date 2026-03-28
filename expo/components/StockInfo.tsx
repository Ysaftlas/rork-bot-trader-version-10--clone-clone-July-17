import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowUp, ArrowDown, Minus, Activity, Zap } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { formatCurrency } from '@/utils/stockUtils';
import { getCurrentStockPrice } from '@/utils/twelveDataApi';

interface StockInfoProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  livePrice?: number;
  lastIntervalPrice?: number;
  trendDirection?: {
    direction: 'up' | 'down' | 'neutral';
    strength: 'strong' | 'moderate' | 'weak';
  };
}

const StockInfo: React.FC<StockInfoProps> = ({
  symbol,
  name,
  price,
  change,
  changePercent,
  livePrice,
  lastIntervalPrice,
  trendDirection
}) => {
  const [currentLivePrice, setCurrentLivePrice] = useState<number>(livePrice || price);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  
  const isPositive = change > 0;
  const isNegative = change < 0;
  const color = isPositive ? Colors.light.chart.up : isNegative ? Colors.light.chart.down : Colors.light.subtext;
  
  // Determine trend indicator style based on direction
  const getTrendIndicatorStyle = () => {
    if (!trendDirection) return styles.neutralIndicator;
    
    switch (trendDirection.direction) {
      case 'up':
        return styles.upIndicator;
      case 'down':
        return styles.downIndicator;
      default:
        return styles.neutralIndicator;
    }
  };
  
  const getTrendIndicatorColor = () => {
    if (!trendDirection) return Colors.light.subtext;
    
    switch (trendDirection.direction) {
      case 'up':
        return Colors.light.chart.up;
      case 'down':
        return Colors.light.chart.down;
      default:
        return Colors.light.subtext;
    }
  };
  
  const getTrendText = () => {
    if (!trendDirection) return 'NEUTRAL';
    
    return `${trendDirection.direction.toUpperCase()} TREND`;
  };
  
  // Update live price every second
  useEffect(() => {
    const updateLivePrice = async () => {
      try {
        setIsUpdating(true);
        const newPrice = await getCurrentStockPrice(symbol);
        setCurrentLivePrice(newPrice);
      } catch (error) {
        console.error('Failed to update live price:', error);
      } finally {
        setIsUpdating(false);
      }
    };
    
    // Update immediately
    updateLivePrice();
    
    // Set up interval to update every second
    const interval = setInterval(updateLivePrice, 1000);
    
    return () => clearInterval(interval);
  }, [symbol]);
  
  // Update local state when prop changes
  useEffect(() => {
    if (livePrice !== undefined) {
      setCurrentLivePrice(livePrice);
    }
  }, [livePrice]);
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.symbol}>{symbol}</Text>
          <Text style={styles.name}>{name}</Text>
        </View>
        
        {/* Large Current Trend Indicator */}
        <View style={[styles.currentTrendIndicator, getTrendIndicatorStyle()]}>
          {trendDirection?.direction === 'up' && (
            <ArrowUp size={32} color="#FFFFFF" />
          )}
          {trendDirection?.direction === 'down' && (
            <ArrowDown size={32} color="#FFFFFF" />
          )}
          {trendDirection?.direction === 'neutral' && (
            <Minus size={32} color="#FFFFFF" />
          )}
          <Text style={styles.trendText}>{getTrendText()}</Text>
        </View>
      </View>
      
      <View style={styles.priceContainer}>
        <View style={styles.mainPriceSection}>
          <Text style={styles.price}>{formatCurrency(price)}</Text>
          
          <View style={styles.changeContainer}>
            {isPositive && <ArrowUp size={16} color={color} />}
            {isNegative && <ArrowDown size={16} color={color} />}
            {!isPositive && !isNegative && <Minus size={16} color={color} />}
            
            <Text style={[styles.change, { color }]}>
              {isPositive ? '+' : ''}{formatCurrency(change)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
            </Text>
          </View>
        </View>
        
        {/* Additional Price Information */}
        <View style={styles.additionalPricesContainer}>
          <View style={styles.additionalPriceItem}>
            <View style={styles.priceIconContainer}>
              <Zap size={14} color={isUpdating ? Colors.light.secondary : Colors.light.primary} />
              <Text style={[styles.additionalPriceLabel, isUpdating && styles.updatingLabel]}>Live</Text>
            </View>
            <Text style={[styles.additionalPriceValue, isUpdating && styles.updatingValue]}>
              {formatCurrency(currentLivePrice)}
            </Text>
          </View>
          
          {lastIntervalPrice !== undefined && (
            <View style={styles.additionalPriceItem}>
              <View style={styles.priceIconContainer}>
                <Activity size={14} color={Colors.light.secondary} />
                <Text style={styles.additionalPriceLabel}>Last Interval</Text>
              </View>
              <View style={styles.lastIntervalContainer}>
                <Text style={styles.additionalPriceValue}>{formatCurrency(lastIntervalPrice)}</Text>
                {/* Comparison indicator */}
                <View style={styles.comparisonIndicator}>
                  {currentLivePrice > lastIntervalPrice && (
                    <ArrowUp size={12} color={Colors.light.chart.up} />
                  )}
                  {currentLivePrice < lastIntervalPrice && (
                    <ArrowDown size={12} color={Colors.light.chart.down} />
                  )}
                  {currentLivePrice === lastIntervalPrice && (
                    <Minus size={12} color={Colors.light.subtext} />
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
      
      {/* Current Direction Status Bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusIndicator, { backgroundColor: getTrendIndicatorColor() }]} />
        <Text style={[styles.statusText, { color: getTrendIndicatorColor() }]}>
          Currently trending {trendDirection?.direction || 'neutral'} 
          {trendDirection?.strength && ` (${trendDirection.strength})`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  symbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    color: Colors.light.subtext,
  },
  currentTrendIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
  },
  upIndicator: {
    backgroundColor: Colors.light.chart.up,
  },
  downIndicator: {
    backgroundColor: Colors.light.chart.down,
  },
  neutralIndicator: {
    backgroundColor: Colors.light.subtext,
  },
  trendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  priceContainer: {
    marginBottom: 12,
  },
  mainPriceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  change: {
    fontSize: 16,
    marginLeft: 4,
  },
  additionalPricesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
  },
  additionalPriceItem: {
    alignItems: 'center',
    flex: 1,
  },
  priceIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  additionalPriceLabel: {
    fontSize: 12,
    color: Colors.light.subtext,
    marginLeft: 4,
    fontWeight: '600',
  },
  additionalPriceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  updatingLabel: {
    color: Colors.light.secondary,
    opacity: 0.7,
  },
  updatingValue: {
    color: Colors.light.secondary,
    opacity: 0.7,
  },
  lastIntervalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonIndicator: {
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default StockInfo;