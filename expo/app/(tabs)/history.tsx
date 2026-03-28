import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useStockStore } from '@/store/stockStore';
import TradeHistoryItem from '@/components/TradeHistoryItem';
import TradePairItem from '@/components/TradePairItem';
import Colors from '@/constants/colors';
import { formatCurrency } from '@/utils/stockUtils';

export default function HistoryScreen() {
  const { tradeHistory, portfolio, selectedStock } = useStockStore();
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell' | 'pairs'>('pairs');
  
  // Calculate total profit/loss from trades
  const totalProfit = tradeHistory
    .filter(trade => trade.type === 'SELL')
    .reduce((sum, trade) => sum + (trade.profit || 0), 0);
  
  // Create trade pairs (buy-sell combinations)
  const tradePairs = useMemo(() => {
    const pairs: Array<{
      id: string;
      buyTrade: any;
      sellTrade: any;
      duration: number;
      profit: number;
      profitPercentage: number;
    }> = [];
    
    // Sort trades chronologically
    const sortedTrades = [...tradeHistory].sort((a, b) => a.timestamp - b.timestamp);
    
    // Simple FIFO matching: match each sell with the earliest unmatched buy
    const unmatchedBuys: any[] = [];
    
    sortedTrades.forEach(trade => {
      if (trade.type === 'BUY') {
        unmatchedBuys.push({ ...trade, remainingShares: trade.shares });
      } else if (trade.type === 'SELL') {
        let sellSharesRemaining = trade.shares;
        
        while (sellSharesRemaining > 0 && unmatchedBuys.length > 0) {
          const buyTrade = unmatchedBuys[0];
          const sharesToMatch = Math.min(sellSharesRemaining, buyTrade.remainingShares);
          
          // Create a trade pair
          const duration = trade.timestamp - buyTrade.timestamp;
          const profit = (trade.price - buyTrade.price) * sharesToMatch;
          const profitPercentage = ((trade.price - buyTrade.price) / buyTrade.price) * 100;
          
          pairs.push({
            id: `${buyTrade.id}-${trade.id}-${pairs.length}`,
            buyTrade: {
              ...buyTrade,
              shares: sharesToMatch
            },
            sellTrade: {
              ...trade,
              shares: sharesToMatch
            },
            duration,
            profit,
            profitPercentage
          });
          
          // Update remaining shares
          sellSharesRemaining -= sharesToMatch;
          buyTrade.remainingShares -= sharesToMatch;
          
          // Remove buy trade if fully matched
          if (buyTrade.remainingShares <= 0) {
            unmatchedBuys.shift();
          }
        }
      }
    });
    
    return pairs.reverse(); // Most recent first
  }, [tradeHistory]);
  
  // Filter trades based on selected filter
  const getFilteredData = () => {
    if (filter === 'pairs') {
      return tradePairs;
    } else {
      return tradeHistory.filter(trade => {
        if (filter === 'all') return true;
        if (filter === 'buy') return trade.type === 'BUY';
        if (filter === 'sell') return trade.type === 'SELL';
        return true;
      });
    }
  };
  
  const filteredData = getFilteredData();
  
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No trade history yet</Text>
      <Text style={styles.emptySubtext}>
        Your {selectedStock.name} trading activity will appear here
      </Text>
    </View>
  );
  
  const renderItem = ({ item }: { item: any }) => {
    if (filter === 'pairs') {
      return <TradePairItem tradePair={item} />;
    } else {
      return <TradeHistoryItem trade={item} />;
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{selectedStock.name} Trade History</Text>
        
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Trades</Text>
            <Text style={styles.summaryValue}>{tradeHistory.length}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Completed Pairs</Text>
            <Text style={styles.summaryValue}>{tradePairs.length}</Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Profit/Loss</Text>
            <Text style={[
              styles.summaryValue, 
              { color: totalProfit > 0 ? Colors.light.chart.up : totalProfit < 0 ? Colors.light.chart.down : Colors.light.text }
            ]}>
              {totalProfit > 0 ? '+' : ''}{formatCurrency(totalProfit)}
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Current Holdings</Text>
            <Text style={styles.summaryValue}>{portfolio.shares} shares</Text>
          </View>
        </View>
        
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'pairs' && styles.activeFilterButton]}
            onPress={() => setFilter('pairs')}
          >
            <Text style={[styles.filterText, filter === 'pairs' && styles.activeFilterText]}>Pairs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.activeFilterButton]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>All</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filter === 'buy' && styles.activeFilterButton]}
            onPress={() => setFilter('buy')}
          >
            <Text style={[styles.filterText, filter === 'buy' && styles.activeFilterText]}>Buy</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, filter === 'sell' && styles.activeFilterButton]}
            onPress={() => setFilter('sell')}
          >
            <Text style={[styles.filterText, filter === 'sell' && styles.activeFilterText]}>Sell</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <FlatList
        data={filteredData}
        keyExtractor={(item) => filter === 'pairs' ? item.id : item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmptyList}
        contentContainerStyle={filteredData.length === 0 ? { flex: 1 } : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 12,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.light.subtext,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 4,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeFilterButton: {
    backgroundColor: Colors.light.primary,
  },
  filterText: {
    fontSize: 14,
    color: Colors.light.subtext,
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.light.subtext,
    textAlign: 'center',
  }
});