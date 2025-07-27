import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Portfolio } from '@/types/stock';
import { formatCurrency } from '@/utils/stockUtils';

interface PortfolioSummaryProps {
  portfolio: Portfolio;
  currentPrice: number;
  stockName: string;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  portfolio,
  currentPrice,
  stockName
}) => {
  const {
    cash,
    shares,
    averageBuyPrice,
    totalValue,
    profitLoss,
    profitLossPercentage
  } = portfolio;
  
  const isPositive = profitLoss > 0;
  const isNegative = profitLoss < 0;
  const color = isPositive ? Colors.light.chart.up : isNegative ? Colors.light.chart.down : Colors.light.subtext;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Portfolio Summary</Text>
      
      <View style={styles.row}>
        <Text style={styles.label}>Total Value</Text>
        <Text style={styles.value}>{formatCurrency(totalValue)}</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Cash Available</Text>
        <Text style={styles.value}>{formatCurrency(cash)}</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>{stockName} Shares</Text>
        <Text style={styles.value}>{shares} @ {formatCurrency(currentPrice)}</Text>
      </View>
      
      {shares > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>Average Buy Price</Text>
          <Text style={styles.value}>{formatCurrency(averageBuyPrice)}</Text>
        </View>
      )}
      
      <View style={styles.divider} />
      
      <View style={styles.row}>
        <Text style={styles.label}>Profit/Loss</Text>
        <View style={styles.profitContainer}>
          {isPositive && <ArrowUp size={16} color={color} />}
          {isNegative && <ArrowDown size={16} color={color} />}
          {!isPositive && !isNegative && <Minus size={16} color={color} />}
          
          <Text style={[styles.profitValue, { color }]}>
            {isPositive ? '+' : ''}{formatCurrency(profitLoss)} ({isPositive ? '+' : ''}{profitLossPercentage.toFixed(2)}%)
          </Text>
        </View>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: Colors.light.subtext,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
  profitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profitValue: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  }
});

export default PortfolioSummary;