import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowUp, ArrowDown, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { formatCurrency, formatDate, formatTime } from '@/utils/stockUtils';
import { useStockStore } from '@/store/stockStore';

interface TradePairItemProps {
  tradePair: {
    id: string;
    buyTrade: any;
    sellTrade: any;
    duration: number;
    profit: number;
    profitPercentage: number;
  };
}

const TradePairItem: React.FC<TradePairItemProps> = ({ tradePair }) => {
  const { selectedStock } = useStockStore();
  const { buyTrade, sellTrade, duration, profit, profitPercentage } = tradePair;
  
  // Format duration
  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };
  
  const profitColor = profit > 0 ? Colors.light.chart.up : profit < 0 ? Colors.light.chart.down : Colors.light.subtext;
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stockName}>{selectedStock.name} Trade Pair</Text>
        <View style={styles.profitContainer}>
          <Text style={[styles.profitAmount, { color: profitColor }]}>
            {profit > 0 ? '+' : ''}{formatCurrency(profit)}
          </Text>
          <Text style={[styles.profitPercentage, { color: profitColor }]}>
            ({profit > 0 ? '+' : ''}{profitPercentage.toFixed(2)}%)
          </Text>
        </View>
      </View>
      
      <View style={styles.tradesContainer}>
        {/* Buy Trade */}
        <View style={styles.tradeSection}>
          <View style={styles.tradeHeader}>
            <View style={styles.tradeTypeContainer}>
              <ArrowUp size={18} color={Colors.light.chart.up} />
              <Text style={[styles.tradeType, { color: Colors.light.chart.up }]}>BUY</Text>
            </View>
            <Text style={styles.tradeAmount}>-{formatCurrency(buyTrade.total)}</Text>
          </View>
          
          <View style={styles.tradeDetails}>
            <Text style={styles.tradeInfo}>
              {buyTrade.shares} shares @ {formatCurrency(buyTrade.price)}
            </Text>
            <Text style={styles.tradeTime}>
              {formatDate(buyTrade.timestamp)} {formatTime(buyTrade.timestamp)}
            </Text>
          </View>
        </View>
        
        {/* Duration */}
        <View style={styles.durationContainer}>
          <Clock size={16} color={Colors.light.subtext} />
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        </View>
        
        {/* Sell Trade */}
        <View style={styles.tradeSection}>
          <View style={styles.tradeHeader}>
            <View style={styles.tradeTypeContainer}>
              <ArrowDown size={18} color={Colors.light.chart.down} />
              <Text style={[styles.tradeType, { color: Colors.light.chart.down }]}>SELL</Text>
            </View>
            <Text style={styles.tradeAmount}>+{formatCurrency(sellTrade.total)}</Text>
          </View>
          
          <View style={styles.tradeDetails}>
            <Text style={styles.tradeInfo}>
              {sellTrade.shares} shares @ {formatCurrency(sellTrade.price)}
            </Text>
            <Text style={styles.tradeTime}>
              {formatDate(sellTrade.timestamp)} {formatTime(sellTrade.timestamp)}
            </Text>
          </View>
        </View>
      </View>
      
      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Price Change</Text>
          <Text style={[styles.summaryValue, { color: profitColor }]}>
            {formatCurrency(buyTrade.price)} → {formatCurrency(sellTrade.price)}
          </Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Duration</Text>
          <Text style={styles.summaryValue}>{formatDuration(duration)}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Shares</Text>
          <Text style={styles.summaryValue}>{buyTrade.shares}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stockName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  profitContainer: {
    alignItems: 'flex-end',
  },
  profitAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  profitPercentage: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  tradesContainer: {
    marginBottom: 16,
  },
  tradeSection: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tradeTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tradeType: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  tradeAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  tradeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradeInfo: {
    fontSize: 14,
    color: Colors.light.subtext,
  },
  tradeTime: {
    fontSize: 12,
    color: Colors.light.subtext,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  durationText: {
    fontSize: 14,
    color: Colors.light.subtext,
    marginLeft: 6,
    fontWeight: '500',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.light.subtext,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
});

export default TradePairItem;