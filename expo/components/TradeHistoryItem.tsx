import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowUp, ArrowDown } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { TradeHistory } from '@/types/stock';
import { formatCurrency, formatDate, formatTime } from '@/utils/stockUtils';
import { useStockStore } from '@/store/stockStore';

interface TradeHistoryItemProps {
  trade: TradeHistory;
}

const TradeHistoryItem: React.FC<TradeHistoryItemProps> = ({ trade }) => {
  const { selectedStock } = useStockStore();
  const { type, price, shares, total, timestamp, profit } = trade;
  const isBuy = type === 'BUY';
  const color = isBuy ? Colors.light.chart.up : Colors.light.chart.down;
  
  // For sell trades, show profit/loss
  const showProfit = !isBuy && profit !== undefined;
  const profitColor = profit > 0 ? Colors.light.chart.up : profit < 0 ? Colors.light.chart.down : Colors.light.subtext;
  
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {isBuy ? (
          <ArrowUp size={20} color={color} />
        ) : (
          <ArrowDown size={20} color={color} />
        )}
      </View>
      
      <View style={styles.detailsContainer}>
        <View style={styles.row}>
          <Text style={styles.type}>{isBuy ? 'Buy' : 'Sell'} {selectedStock.name}</Text>
          <Text style={[styles.total, { color }]}>
            {isBuy ? '-' : '+'}{formatCurrency(total)}
          </Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.details}>
            {shares} shares @ {formatCurrency(price)}
          </Text>
          <Text style={styles.timestamp}>
            {formatDate(timestamp)} {formatTime(timestamp)}
          </Text>
        </View>
        
        {showProfit && (
          <View style={styles.row}>
            <Text style={styles.profitLabel}>Profit/Loss:</Text>
            <Text style={[styles.profitValue, { color: profitColor }]}>
              {profit > 0 ? '+' : ''}{formatCurrency(profit)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  iconContainer: {
    marginRight: 16,
    justifyContent: 'center',
  },
  detailsContainer: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  type: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  total: {
    fontSize: 16,
    fontWeight: '600',
  },
  details: {
    fontSize: 14,
    color: Colors.light.subtext,
  },
  timestamp: {
    fontSize: 14,
    color: Colors.light.subtext,
  },
  profitLabel: {
    fontSize: 14,
    color: Colors.light.subtext,
  },
  profitValue: {
    fontSize: 14,
    fontWeight: '600',
  }
});

export default TradeHistoryItem;