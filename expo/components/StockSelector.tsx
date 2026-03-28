import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { TrendingUp } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { AVAILABLE_STOCKS, Stock } from '@/constants/stocks';

interface StockSelectorProps {
  selectedStock: Stock;
  onStockSelect: (stock: Stock) => void;
}

const StockSelector: React.FC<StockSelectorProps> = ({
  selectedStock,
  onStockSelect
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TrendingUp size={20} color={Colors.light.primary} />
        <Text style={styles.title}>Select Stock</Text>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {AVAILABLE_STOCKS.map((stock) => (
          <TouchableOpacity
            key={stock.symbol}
            style={[
              styles.stockButton,
              selectedStock.symbol === stock.symbol && styles.selectedStockButton
            ]}
            onPress={() => onStockSelect(stock)}
          >
            <Text style={[
              styles.stockSymbol,
              selectedStock.symbol === stock.symbol && styles.selectedStockSymbol
            ]}>
              {stock.symbol}
            </Text>
            <Text style={[
              styles.stockName,
              selectedStock.symbol === stock.symbol && styles.selectedStockName
            ]}>
              {stock.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginLeft: 8,
  },
  scrollContainer: {
    paddingHorizontal: 4,
  },
  stockButton: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedStockButton: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  stockSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 2,
  },
  selectedStockSymbol: {
    color: '#FFFFFF',
  },
  stockName: {
    fontSize: 12,
    color: Colors.light.subtext,
  },
  selectedStockName: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
});

export default StockSelector;