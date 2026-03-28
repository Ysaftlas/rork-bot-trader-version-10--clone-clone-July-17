import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { Bot, Plus, Play, Pause, Trash2, TrendingUp, TrendingDown, DollarSign, BarChart3, Clock, Calendar, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus, ShoppingCart, Wallet, Shield, Target, AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { TradingBot, BotTradeHistory } from '@/types/bot';
import { AVAILABLE_STOCKS } from '@/constants/stocks';
import { formatCurrency, formatTime, formatDate } from '@/utils/stockUtils';
import { useStockStore } from '@/store/stockStore';
import { getCurrentStockPrice, getStockIntradayData } from '@/utils/twelveDataApi';

interface MyBotsProps {
  bots: TradingBot[];
  onCreateBot: (bot: Omit<TradingBot, 'id' | 'createdAt' | 'stats'>) => void;
  onToggleBot: (botId: string) => void;
  onDeleteBot: (botId: string) => void;
}

interface BotStatus {
  botId: string;
  trendDirection: 'up' | 'down' | 'neutral';
  currentPrice: number;
  lastUpdated: number;
  tradingStatus: 'just_bought' | 'just_sold' | 'inactive';
  currentShares: number;
  averageBuyPrice: number;
  lastTradePrice: number | null;
  lastTradeTime: number | null;
}

const MyBots: React.FC<MyBotsProps> = ({
  bots,
  onCreateBot,
  onToggleBot,
  onDeleteBot
}) => {
  const { botTradeHistory, selectedStock, intradayData, fiveMinuteData, oneSecondData } = useStockStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [selectedStockForBot, setSelectedStockForBot] = useState(AVAILABLE_STOCKS[0]);
  const [maxInvestment, setMaxInvestment] = useState('2000');
  const [investmentType, setInvestmentType] = useState<'dollars' | 'shares'>('dollars');
  const [chartPeriod, setChartPeriod] = useState<'1sec' | '5min' | '1D' | '1DSec' | '5MinSec'>('1D');
  const [tradingMethod, setTradingMethod] = useState<'trend_reversal' | 'direction_change_reference' | 'direction_change_buy' | 'price_comparison' | 'slope_analysis'>('trend_reversal');
  const [dollarDropThreshold, setDollarDropThreshold] = useState('5');
  // Enhanced Dollar Drop settings
  const [dollarDropEnabled, setDollarDropEnabled] = useState(false);
  const [profitTakingEnabled, setProfitTakingEnabled] = useState(false);
  const [profitTakingPercentage, setProfitTakingPercentage] = useState('10');
  const [profitTakingDollarAmount, setProfitTakingDollarAmount] = useState('0');
  const [dollarDropTriggerAmount, setDollarDropTriggerAmount] = useState('0.10');
  const [sellAtBuyPriceEnabled, setSellAtBuyPriceEnabled] = useState(false);
  const [consecutiveFallsEnabled, setConsecutiveFallsEnabled] = useState(false);
  const [consecutiveFallsCount, setConsecutiveFallsCount] = useState('3');
  // Enhanced Dollar Drop Protection with timing delays
  const [enhancedDropProtectionEnabled, setEnhancedDropProtectionEnabled] = useState(false);
  const [firstDelaySeconds, setFirstDelaySeconds] = useState('15');
  const [secondDelaySeconds, setSecondDelaySeconds] = useState('30');
  const [expandedBots, setExpandedBots] = useState<Set<string>>(new Set());
  const [botStatuses, setBotStatuses] = useState<BotStatus[]>([]);

  // Calculate bot position and trading status
  const calculateBotStatus = (botId: string, trendDirection: 'up' | 'down' | 'neutral', currentPrice: number): {
    tradingStatus: 'just_bought' | 'just_sold' | 'inactive';
    currentShares: number;
    averageBuyPrice: number;
    lastTradePrice: number | null;
    lastTradeTime: number | null;
  } => {
    const bot = bots.find(b => b.id === botId);
    if (!bot) {
      return {
        tradingStatus: 'inactive',
        currentShares: 0,
        averageBuyPrice: 0,
        lastTradePrice: null,
        lastTradeTime: null
      };
    }

    // Get bot's trade history
    const botTrades = botTradeHistory
      .filter(trade => trade.botId === botId)
      .sort((a, b) => a.timestamp - b.timestamp); // Chronological order

    if (botTrades.length === 0) {
      // No trades yet - show inactive
      return {
        tradingStatus: 'inactive',
        currentShares: 0,
        averageBuyPrice: 0,
        lastTradePrice: null,
        lastTradeTime: null
      };
    }

    // Calculate current position
    const buyTrades = botTrades.filter(t => t.type === 'BUY');
    const sellTrades = botTrades.filter(t => t.type === 'SELL');
    
    const totalBought = buyTrades.reduce((sum, t) => sum + t.shares, 0);
    const totalSold = sellTrades.reduce((sum, t) => sum + t.shares, 0);
    const currentShares = totalBought - totalSold;

    // Calculate average buy price for current holdings
    let averageBuyPrice = 0;
    if (currentShares > 0 && buyTrades.length > 0) {
      const totalCost = buyTrades.reduce((sum, t) => sum + t.total, 0);
      averageBuyPrice = totalCost / totalBought;
    }

    // Get last trade info
    const lastTrade = botTrades[botTrades.length - 1];
    const lastTradePrice = lastTrade ? lastTrade.price : null;
    const lastTradeTime = lastTrade ? lastTrade.timestamp : null;

    // Determine trading status - simplified to only show bought/sold/inactive
    let tradingStatus: 'just_bought' | 'just_sold' | 'inactive' = 'inactive';

    if (!bot.isActive) {
      tradingStatus = 'inactive';
    } else {
      // If bot has current shares, show as bought
      if (currentShares > 0) {
        tradingStatus = 'just_bought';
      } else {
        // If no current shares but has trade history, show as sold
        if (botTrades.length > 0) {
          tradingStatus = 'just_sold';
        } else {
          tradingStatus = 'inactive';
        }
      }
    }

    return {
      tradingStatus,
      currentShares,
      averageBuyPrice,
      lastTradePrice,
      lastTradeTime
    };
  };

  // Update bot statuses periodically
  useEffect(() => {
    const updateBotStatuses = async () => {
      const newStatuses: BotStatus[] = [];
      
      for (const bot of bots) {
        try {
          let currentPrice = 0;
          let trendData: any[] = [];
          
          // Get current price and trend data for the bot's stock
          if (bot.stockSymbol === selectedStock.symbol) {
            // Use current data if it's the same stock
            currentPrice = await getCurrentStockPrice(bot.stockSymbol);
            
            switch (bot.settings.chartPeriod) {
              case '1sec':
                trendData = [...oneSecondData];
                break;
              case '5min':
                trendData = [...fiveMinuteData];
                break;
              case '1D':
                trendData = [...intradayData];
                break;
            }
          } else {
            // Fetch data for different stock
            currentPrice = await getCurrentStockPrice(bot.stockSymbol);
            
            switch (bot.settings.chartPeriod) {
              case '1sec':
                trendData = await getStockIntradayData(bot.stockSymbol, '1min', 10);
                break;
              case '5min':
                trendData = await getStockIntradayData(bot.stockSymbol, '5min', 10);
                break;
              case '1D':
                trendData = await getStockIntradayData(bot.stockSymbol, '1min', 50);
                break;
            }
          }
          
          // Calculate trend direction using simple slope
          let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';
          
          if (trendData.length >= 2) {
            const lastPoint = trendData[trendData.length - 1];
            const previousPoint = trendData[trendData.length - 2];
            const priceDifference = lastPoint.price - previousPoint.price;
            
            if (priceDifference > 0) {
              trendDirection = 'up';
            } else if (priceDifference < 0) {
              trendDirection = 'down';
            }
          }

          // Calculate detailed bot status
          const statusDetails = calculateBotStatus(bot.id, trendDirection, currentPrice);
          
          newStatuses.push({
            botId: bot.id,
            trendDirection,
            currentPrice,
            lastUpdated: Date.now(),
            ...statusDetails
          });
        } catch (error) {
          console.error(`Error updating status for bot ${bot.name}:`, error);
          const statusDetails = calculateBotStatus(bot.id, 'neutral', 0);
          newStatuses.push({
            botId: bot.id,
            trendDirection: 'neutral',
            currentPrice: 0,
            lastUpdated: Date.now(),
            ...statusDetails
          });
        }
      }
      
      setBotStatuses(newStatuses);
    };

    if (bots.length > 0) {
      updateBotStatuses();
      
      // Update every 30 seconds
      const interval = setInterval(updateBotStatuses, 30000);
      return () => clearInterval(interval);
    }
  }, [bots, selectedStock.symbol, intradayData, fiveMinuteData, oneSecondData, botTradeHistory]);

  const handleCreateBot = () => {
    if (!newBotName.trim()) {
      Alert.alert('Error', 'Please enter a bot name.');
      return;
    }

    const investment = parseFloat(maxInvestment);
    if (isNaN(investment) || investment <= 0) {
      Alert.alert('Error', 'Please enter a valid investment amount.');
      return;
    }

    const newBot: Omit<TradingBot, 'id' | 'createdAt' | 'stats'> = {
      name: newBotName.trim(),
      stockSymbol: selectedStockForBot.symbol,
      stockName: selectedStockForBot.name,
      isActive: false,
      settings: {
        maxInvestmentPerTrade: investment,
        investmentType,
        chartPeriod,
        tradingMethod,
        dollarDropThreshold: tradingMethod === 'direction_change_reference' ? parseFloat(dollarDropThreshold) || 5 : undefined,
        // Enhanced Dollar Drop settings
        dollarDropEnabled,
        profitTakingEnabled: dollarDropEnabled ? profitTakingEnabled : false,
        profitTakingPercentage: dollarDropEnabled && profitTakingEnabled ? parseFloat(profitTakingPercentage) || 10 : undefined,
        profitTakingDollarAmount: dollarDropEnabled && profitTakingEnabled ? parseFloat(profitTakingDollarAmount) || 0 : undefined,
        dollarDropTriggerAmount: dollarDropEnabled && profitTakingEnabled ? parseFloat(dollarDropTriggerAmount) || 0.10 : undefined,
        sellAtBuyPriceEnabled: dollarDropEnabled ? sellAtBuyPriceEnabled : false,
        consecutiveFallsEnabled: dollarDropEnabled ? consecutiveFallsEnabled : false,
        consecutiveFallsCount: dollarDropEnabled && consecutiveFallsEnabled ? parseInt(consecutiveFallsCount) || 3 : undefined,
        // Enhanced Dollar Drop Protection with timing delays
        enhancedDropProtectionEnabled: dollarDropEnabled ? enhancedDropProtectionEnabled : false,
        firstDelaySeconds: dollarDropEnabled && enhancedDropProtectionEnabled ? parseInt(firstDelaySeconds) || 15 : undefined,
        secondDelaySeconds: dollarDropEnabled && enhancedDropProtectionEnabled ? parseInt(secondDelaySeconds) || 30 : undefined
      }
    };

    onCreateBot(newBot);
    
    // Reset form
    setNewBotName('');
    setMaxInvestment('2000');
    setInvestmentType('dollars');
    setChartPeriod('1D');
    setTradingMethod('trend_reversal');
    setDollarDropThreshold('5');
    // Reset Enhanced Dollar Drop settings
    setDollarDropEnabled(false);
    setProfitTakingEnabled(false);
    setProfitTakingPercentage('10');
    setProfitTakingDollarAmount('0');
    setDollarDropTriggerAmount('0.10');
    setSellAtBuyPriceEnabled(false);
    setConsecutiveFallsEnabled(false);
    setConsecutiveFallsCount('3');
    // Reset Enhanced Dollar Drop Protection settings
    setEnhancedDropProtectionEnabled(false);
    setFirstDelaySeconds('15');
    setSecondDelaySeconds('30');
    setShowCreateModal(false);
  };

  const handleDeleteBot = (botId: string, botName: string) => {
    console.log(`Delete button clicked for bot: ${botName} (ID: ${botId})`);
    
    Alert.alert(
      'Delete Bot',
      `Are you sure you want to delete "${botName}"? This will permanently remove the bot and all its trade history.`,
      [
        { 
          text: 'No', 
          style: 'cancel',
          onPress: () => {
            console.log('Bot deletion cancelled');
          }
        },
        { 
          text: 'Yes', 
          style: 'destructive',
          onPress: () => {
            console.log(`Confirming deletion of bot with ID: ${botId}`);
            
            // Call the delete function
            onDeleteBot(botId);
            
            // Remove from expanded bots if it was expanded
            const newExpanded = new Set(expandedBots);
            newExpanded.delete(botId);
            setExpandedBots(newExpanded);
            
            console.log(`Bot "${botName}" deletion completed`);
          }
        }
      ]
    );
  };

  const toggleBotHistory = (botId: string) => {
    const newExpanded = new Set(expandedBots);
    if (newExpanded.has(botId)) {
      newExpanded.delete(botId);
    } else {
      newExpanded.add(botId);
    }
    setExpandedBots(newExpanded);
  };

  const getBotStatus = (botId: string): BotStatus | null => {
    return botStatuses.find(status => status.botId === botId) || null;
  };

  const getBotTrades = (botId: string): BotTradeHistory[] => {
    return botTradeHistory
      .filter(trade => trade.botId === botId)
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
  };

  const getChartPeriodIcon = (period: '1sec' | '5min' | '1D' | '1DSec' | '5MinSec') => {
    switch (period) {
      case '1sec':
        return <BarChart3 size={14} color={Colors.light.primary} />;
      case '5min':
        return <Clock size={14} color={Colors.light.primary} />;
      case '1D':
        return <Calendar size={14} color={Colors.light.primary} />;
    }
  };

  const getChartPeriodLabel = (period: '1sec' | '5min' | '1D' | '1DSec' | '5MinSec') => {
    switch (period) {
      case '1sec':
        return '1-Second Chart';
      case '5min':
        return '5-Minute Chart';
      case '1D':
        return '1-Day Chart';
    }
  };

  const getTrendIcon = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return <TrendingUp size={16} color={Colors.light.chart.up} />;
      case 'down':
        return <TrendingDown size={16} color={Colors.light.chart.down} />;
      case 'neutral':
        return <Minus size={16} color={Colors.light.subtext} />;
    }
  };

  const getTrendColor = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return Colors.light.chart.up;
      case 'down':
        return Colors.light.chart.down;
      case 'neutral':
        return Colors.light.subtext;
    }
  };

  const getTradingStatusIcon = (status: 'just_bought' | 'just_sold' | 'inactive') => {
    switch (status) {
      case 'just_bought':
        return <ShoppingCart size={16} color={Colors.light.chart.up} />;
      case 'just_sold':
        return <DollarSign size={16} color={Colors.light.chart.down} />;
      case 'inactive':
        return <Pause size={16} color={Colors.light.subtext} />;
    }
  };

  const getTradingStatusText = (status: 'just_bought' | 'just_sold' | 'inactive') => {
    switch (status) {
      case 'just_bought':
        return 'Bot Bought';
      case 'just_sold':
        return 'Bot Sold';
      case 'inactive':
        return 'Inactive';
    }
  };

  const getTradingStatusColor = (status: 'just_bought' | 'just_sold' | 'inactive') => {
    switch (status) {
      case 'just_bought':
        return Colors.light.chart.up;
      case 'just_sold':
        return Colors.light.chart.down;
      case 'inactive':
        return Colors.light.subtext;
    }
  };

  const renderBotTradeItem = ({ item }: { item: BotTradeHistory }) => (
    <View style={styles.tradeItem}>
      <View style={styles.tradeHeader}>
        <View style={styles.tradeInfo}>
          <View style={styles.tradeTypeContainer}>
            {item.type === 'BUY' ? (
              <ArrowUp size={16} color={Colors.light.chart.up} />
            ) : (
              <ArrowDown size={16} color={Colors.light.chart.down} />
            )}
            <Text style={[
              styles.tradeType,
              { color: item.type === 'BUY' ? Colors.light.chart.up : Colors.light.chart.down }
            ]}>
              {item.type}
            </Text>
          </View>
          <Text style={styles.tradeDetails}>
            {item.shares} shares @ {formatCurrency(item.price)}
          </Text>
        </View>
        
        <View style={styles.tradeAmounts}>
          <Text style={[
            styles.tradeTotal,
            { color: item.type === 'BUY' ? Colors.light.chart.down : Colors.light.chart.up }
          ]}>
            {item.type === 'BUY' ? '-' : '+'}{formatCurrency(item.total)}
          </Text>
          {item.type === 'SELL' && (
            <Text style={[
              styles.tradeProfit,
              { color: item.profit > 0 ? Colors.light.chart.up : item.profit < 0 ? Colors.light.chart.down : Colors.light.subtext }
            ]}>
              P/L: {item.profit > 0 ? '+' : ''}{formatCurrency(item.profit)}
            </Text>
          )}
        </View>
      </View>
      
      <Text style={styles.tradeTime}>
        {formatDate(item.timestamp)} {formatTime(item.timestamp)}
      </Text>
    </View>
  );

  const renderBotItem = ({ item }: { item: TradingBot }) => {
    const botStatus = getBotStatus(item.id);
    const botTrades = getBotTrades(item.id);
    const isExpanded = expandedBots.has(item.id);
    
    // Calculate profit/loss for display
    const currentValue = botStatus && botStatus.currentShares > 0 ? botStatus.currentPrice * botStatus.currentShares : 0;
    const investedValue = botStatus && botStatus.currentShares > 0 ? botStatus.averageBuyPrice * botStatus.currentShares : 0;
    const profitLoss = currentValue - investedValue;
    const profitLossPercentage = investedValue > 0 ? (profitLoss / investedValue) * 100 : 0;
    
    return (
      <View style={styles.botItem}>
        <View style={styles.botHeader}>
          <View style={styles.botInfo}>
            <Text style={styles.botName}>{item.name}</Text>
            <Text style={styles.botStock}>{item.stockSymbol} - {item.stockName}</Text>
          </View>
          
          <View style={styles.botControls}>
            <TouchableOpacity
              style={[styles.controlButton, item.isActive ? styles.pauseButton : styles.playButton]}
              onPress={() => onToggleBot(item.id)}
            >
              {item.isActive ? (
                <Pause size={16} color="#FFFFFF" />
              ) : (
                <Play size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteBot(item.id, item.name)}
            >
              <Trash2 size={16} color={Colors.light.danger} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Enhanced Status Section */}
        <View style={styles.statusSection}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Trading Status</Text>
            <View style={styles.statusValueContainer}>
              {botStatus ? getTradingStatusIcon(botStatus.tradingStatus) : <Pause size={16} color={Colors.light.subtext} />}
              <Text style={[
                styles.statusValue,
                { color: botStatus ? getTradingStatusColor(botStatus.tradingStatus) : Colors.light.subtext }
              ]}>
                {botStatus ? getTradingStatusText(botStatus.tradingStatus) : 'Loading'}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Trend Direction</Text>
            <View style={styles.statusValueContainer}>
              {botStatus ? getTrendIcon(botStatus.trendDirection) : <Minus size={16} color={Colors.light.subtext} />}
              <Text style={[
                styles.statusValue,
                { color: botStatus ? getTrendColor(botStatus.trendDirection) : Colors.light.subtext }
              ]}>
                {botStatus ? botStatus.trendDirection.toUpperCase() : 'LOADING'}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Current Price</Text>
            <Text style={styles.statusValue}>
              {botStatus ? formatCurrency(botStatus.currentPrice) : 'Loading...'}
            </Text>
            {/* Show buy price right next to current price */}
            {botStatus && botStatus.currentShares > 0 && (
              <View style={styles.priceComparisonContainer}>
                <Text style={styles.buyPriceLabel}>Bought at:</Text>
                <Text style={styles.buyPriceValue}>
                  {formatCurrency(botStatus.averageBuyPrice)}
                </Text>
              </View>
            )}
            {/* Show profit/loss if bot has shares */}
            {botStatus && botStatus.currentShares > 0 && (
              <View style={styles.profitLossContainer}>
                <Text style={[
                  styles.profitLossText,
                  { color: profitLoss >= 0 ? Colors.light.chart.up : Colors.light.chart.down }
                ]}>
                  {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)} ({profitLoss >= 0 ? '+' : ''}{profitLossPercentage.toFixed(2)}%)
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Position Information */}
        {botStatus && botStatus.currentShares > 0 && (
          <View style={styles.positionSection}>
            <View style={styles.positionItem}>
              <Text style={styles.positionLabel}>Current Holdings</Text>
              <Text style={styles.positionValue}>{botStatus.currentShares} shares</Text>
            </View>
            
            <View style={styles.positionItem}>
              <Text style={styles.positionLabel}>Avg Buy Price</Text>
              <Text style={styles.positionValue}>{formatCurrency(botStatus.averageBuyPrice)}</Text>
            </View>
            
            <View style={styles.positionItem}>
              <Text style={styles.positionLabel}>Current Value</Text>
              <Text style={[
                styles.positionValue,
                { 
                  color: (botStatus.currentPrice * botStatus.currentShares) > (botStatus.averageBuyPrice * botStatus.currentShares)
                    ? Colors.light.chart.up 
                    : Colors.light.chart.down 
                }
              ]}>
                {formatCurrency(botStatus.currentPrice * botStatus.currentShares)}
              </Text>
            </View>
          </View>
        )}

        {/* Last Trade Information */}
        {botStatus && botStatus.lastTradePrice && botStatus.lastTradeTime && (
          <View style={styles.lastTradeSection}>
            <Text style={styles.lastTradeTitle}>Last Trade</Text>
            <View style={styles.lastTradeInfo}>
              <Text style={styles.lastTradeText}>
                Price: {formatCurrency(botStatus.lastTradePrice)}
              </Text>
              <Text style={styles.lastTradeText}>
                Time: {formatTime(botStatus.lastTradeTime)}
              </Text>
            </View>
          </View>
        )}
        
        {/* Chart Period Section */}
        <View style={styles.chartSection}>
          <View style={styles.chartPeriodContainer}>
            {getChartPeriodIcon(item.settings.chartPeriod)}
            <Text style={styles.chartPeriodText}>
              Trading on {getChartPeriodLabel(item.settings.chartPeriod)}
            </Text>
          </View>
        </View>
        
        <View style={styles.botStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Trades</Text>
            <Text style={styles.statValue}>{item.stats.totalTrades}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Profit</Text>
            <Text style={[
              styles.statValue,
              { color: item.stats.totalProfit > 0 ? Colors.light.chart.up : item.stats.totalProfit < 0 ? Colors.light.chart.down : Colors.light.text }
            ]}>
              {item.stats.totalProfit > 0 ? '+' : ''}{formatCurrency(item.stats.totalProfit)}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Win Rate</Text>
            <Text style={styles.statValue}>{item.stats.winRate.toFixed(1)}%</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Max/Trade</Text>
            <Text style={styles.statValue}>
              {item.settings.investmentType === 'dollars' 
                ? formatCurrency(item.settings.maxInvestmentPerTrade)
                : `${item.settings.maxInvestmentPerTrade} shares`
              }
            </Text>
          </View>
        </View>
        
        {/* Trade History Toggle */}
        <TouchableOpacity 
          style={styles.historyToggle}
          onPress={() => toggleBotHistory(item.id)}
        >
          <Text style={styles.historyToggleText}>
            Trade History ({botTrades.length})
          </Text>
          {isExpanded ? (
            <ChevronUp size={20} color={Colors.light.primary} />
          ) : (
            <ChevronDown size={20} color={Colors.light.primary} />
          )}
        </TouchableOpacity>
        
        {/* Trade History List */}
        {isExpanded && (
          <View style={styles.historyContainer}>
            {botTrades.length > 0 ? (
              <FlatList
                data={botTrades.slice(0, 10)} // Show last 10 trades
                keyExtractor={(trade) => trade.id}
                renderItem={renderBotTradeItem}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.tradeSeparator} />}
              />
            ) : (
              <Text style={styles.noTradesText}>No trades yet</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Bot size={48} color={Colors.light.subtext} />
      <Text style={styles.emptyText}>No trading bots yet</Text>
      <Text style={styles.emptySubtext}>Create your first bot to start automated trading</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Bot size={20} color={Colors.light.primary} />
          <Text style={styles.title}>My Bots</Text>
        </View>
        
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create Bot</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={bots}
        keyExtractor={(item) => item.id}
        renderItem={renderBotItem}
        ListEmptyComponent={renderEmptyList}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.botsList}
        ItemSeparatorComponent={() => <View style={styles.botSeparator} />}
      />

      {/* Create Bot Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New Bot</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bot Name</Text>
              <TextInput
                style={styles.input}
                value={newBotName}
                onChangeText={setNewBotName}
                placeholder="Enter bot name"
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Stock</Text>
              <View style={styles.stockSelector}>
                {AVAILABLE_STOCKS.map((stock) => (
                  <TouchableOpacity
                    key={stock.symbol}
                    style={[
                      styles.stockOption,
                      selectedStockForBot.symbol === stock.symbol && styles.selectedStockOption
                    ]}
                    onPress={() => setSelectedStockForBot(stock)}
                  >
                    <Text style={[
                      styles.stockOptionText,
                      selectedStockForBot.symbol === stock.symbol && styles.selectedStockOptionText
                    ]}>
                      {stock.symbol}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Chart Period</Text>
              <Text style={styles.inputDescription}>
                Select which chart the bot will use for trading decisions
              </Text>
              <View style={styles.chartPeriodSelector}>
                <TouchableOpacity
                  style={[
                    styles.chartPeriodOption,
                    chartPeriod === '1sec' && styles.selectedChartPeriodOption
                  ]}
                  onPress={() => setChartPeriod('1sec')}
                >
                  <BarChart3 size={16} color={chartPeriod === '1sec' ? '#FFFFFF' : Colors.light.subtext} />
                  <Text style={[
                    styles.chartPeriodOptionText,
                    chartPeriod === '1sec' && styles.selectedChartPeriodOptionText
                  ]}>
                    1sec
                  </Text>
                  <Text style={[
                    styles.chartPeriodDescription,
                    chartPeriod === '1sec' && styles.selectedChartPeriodDescription
                  ]}>
                    Real-time
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.chartPeriodOption,
                    chartPeriod === '5min' && styles.selectedChartPeriodOption
                  ]}
                  onPress={() => setChartPeriod('5min')}
                >
                  <Clock size={16} color={chartPeriod === '5min' ? '#FFFFFF' : Colors.light.subtext} />
                  <Text style={[
                    styles.chartPeriodOptionText,
                    chartPeriod === '5min' && styles.selectedChartPeriodOptionText
                  ]}>
                    5min
                  </Text>
                  <Text style={[
                    styles.chartPeriodDescription,
                    chartPeriod === '5min' && styles.selectedChartPeriodDescription
                  ]}>
                    Short-term
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.chartPeriodOption,
                    chartPeriod === '1D' && styles.selectedChartPeriodOption
                  ]}
                  onPress={() => setChartPeriod('1D')}
                >
                  <Calendar size={16} color={chartPeriod === '1D' ? '#FFFFFF' : Colors.light.subtext} />
                  <Text style={[
                    styles.chartPeriodOptionText,
                    chartPeriod === '1D' && styles.selectedChartPeriodOptionText
                  ]}>
                    1D
                  </Text>
                  <Text style={[
                    styles.chartPeriodDescription,
                    chartPeriod === '1D' && styles.selectedChartPeriodDescription
                  ]}>
                    Intraday
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Trading Method</Text>
              <Text style={styles.inputDescription}>
                Choose how the bot makes trading decisions
              </Text>
              <View style={styles.tradingMethodContainer}>
                <TouchableOpacity
                  style={[
                    styles.tradingMethodOption,
                    tradingMethod === 'trend_reversal' && styles.activeTradingMethodOption
                  ]}
                  onPress={() => setTradingMethod('trend_reversal')}
                >
                  <View style={styles.tradingMethodHeader}>
                    <TrendingUp size={16} color={tradingMethod === 'trend_reversal' ? '#FFFFFF' : Colors.light.subtext} />
                    <Text style={[
                      styles.tradingMethodTitle,
                      tradingMethod === 'trend_reversal' && styles.activeTradingMethodTitle
                    ]}>
                      Trend Reversal
                    </Text>
                  </View>
                  <Text style={[
                    styles.tradingMethodDescription,
                    tradingMethod === 'trend_reversal' && styles.activeTradingMethodDescription
                  ]}>
                    Buys when price trend changes from down to up, sells when trend changes from up to down
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.tradingMethodOption,
                    tradingMethod === 'direction_change_reference' && styles.activeTradingMethodOption
                  ]}
                  onPress={() => setTradingMethod('direction_change_reference')}
                >
                  <View style={styles.tradingMethodHeader}>
                    <BarChart3 size={16} color={tradingMethod === 'direction_change_reference' ? '#FFFFFF' : Colors.light.subtext} />
                    <Text style={[
                      styles.tradingMethodTitle,
                      tradingMethod === 'direction_change_reference' && styles.activeTradingMethodTitle
                    ]}>
                      Direction Reference
                    </Text>
                  </View>
                  <Text style={[
                    styles.tradingMethodDescription,
                    tradingMethod === 'direction_change_reference' && styles.activeTradingMethodDescription
                  ]}>
                    Buys when price is above the last direction change point, sells when price drops by a set dollar amount
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.tradingMethodOption,
                    tradingMethod === 'direction_change_buy' && styles.activeTradingMethodOption
                  ]}
                  onPress={() => setTradingMethod('direction_change_buy')}
                >
                  <View style={styles.tradingMethodHeader}>
                    <BarChart3 size={16} color={tradingMethod === 'direction_change_buy' ? '#FFFFFF' : Colors.light.subtext} />
                    <Text style={[
                      styles.tradingMethodTitle,
                      tradingMethod === 'direction_change_buy' && styles.activeTradingMethodTitle
                    ]}>
                      Direction Buy
                    </Text>
                  </View>
                  <Text style={[
                    styles.tradingMethodDescription,
                    tradingMethod === 'direction_change_buy' && styles.activeTradingMethodDescription
                  ]}>
                    Only buys at new direction changes from down to up, sells when trend reverses to down
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.tradingMethodOption,
                    tradingMethod === 'price_comparison' && styles.activeTradingMethodOption
                  ]}
                  onPress={() => setTradingMethod('price_comparison')}
                >
                  <View style={styles.tradingMethodHeader}>
                    <TrendingUp size={16} color={tradingMethod === 'price_comparison' ? '#FFFFFF' : Colors.light.subtext} />
                    <Text style={[
                      styles.tradingMethodTitle,
                      tradingMethod === 'price_comparison' && styles.activeTradingMethodTitle
                    ]}>
                      Price Comparison
                    </Text>
                  </View>
                  <Text style={[
                    styles.tradingMethodDescription,
                    tradingMethod === 'price_comparison' && styles.activeTradingMethodDescription
                  ]}>
                    Buys when current price is higher than previous interval, sells when current price is lower
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.tradingMethodOption,
                    tradingMethod === 'slope_analysis' && styles.activeTradingMethodOption
                  ]}
                  onPress={() => setTradingMethod('slope_analysis')}
                >
                  <View style={styles.tradingMethodHeader}>
                    <BarChart3 size={16} color={tradingMethod === 'slope_analysis' ? '#FFFFFF' : Colors.light.subtext} />
                    <Text style={[
                      styles.tradingMethodTitle,
                      tradingMethod === 'slope_analysis' && styles.activeTradingMethodTitle
                    ]}>
                      Slope
                    </Text>
                  </View>
                  <Text style={[
                    styles.tradingMethodDescription,
                    tradingMethod === 'slope_analysis' && styles.activeTradingMethodDescription
                  ]}>
                    Analyzes the last two intervals: buys when slope is positive (price rising), sells when slope is negative (price falling)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {tradingMethod === 'direction_change_reference' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Dollar Drop Threshold</Text>
                <Text style={styles.inputDescription}>
                  Sell when price drops by this amount from buy price
                </Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.unit}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={dollarDropThreshold}
                    onChangeText={setDollarDropThreshold}
                    keyboardType="numeric"
                    placeholder="5"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Investment Type</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    investmentType === 'dollars' && styles.activeToggleButton
                  ]}
                  onPress={() => setInvestmentType('dollars')}
                >
                  <DollarSign size={16} color={investmentType === 'dollars' ? '#FFFFFF' : Colors.light.subtext} />
                  <Text style={[
                    styles.toggleButtonText,
                    investmentType === 'dollars' && styles.activeToggleButtonText
                  ]}>
                    Dollars
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    investmentType === 'shares' && styles.activeToggleButton
                  ]}
                  onPress={() => setInvestmentType('shares')}
                >
                  <TrendingUp size={16} color={investmentType === 'shares' ? '#FFFFFF' : Colors.light.subtext} />
                  <Text style={[
                    styles.toggleButtonText,
                    investmentType === 'shares' && styles.activeToggleButtonText
                  ]}>
                    Shares
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Maximum {investmentType === 'dollars' ? 'Investment' : 'Shares'} per Trade
              </Text>
              <View style={styles.inputContainer}>
                {investmentType === 'dollars' && <Text style={styles.unit}>$</Text>}
                <TextInput
                  style={styles.input}
                  value={maxInvestment}
                  onChangeText={setMaxInvestment}
                  keyboardType="numeric"
                  placeholder={investmentType === 'dollars' ? '2000' : '10'}
                />
                {investmentType === 'shares' && <Text style={styles.unit}>shares</Text>}
              </View>
            </View>
            
            {/* Enhanced Dollar Drop Settings */}
            <View style={styles.inputGroup}>
              <View style={styles.switchContainer}>
                <View style={styles.switchLabelContainer}>
                  <Shield size={20} color={Colors.light.primary} />
                  <Text style={styles.inputLabel}>Enhanced Dollar Drop Protection</Text>
                </View>
                <TouchableOpacity
                  style={[styles.switch, dollarDropEnabled && styles.switchActive]}
                  onPress={() => setDollarDropEnabled(!dollarDropEnabled)}
                >
                  <View style={[styles.switchThumb, dollarDropEnabled && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
              <Text style={styles.inputDescription}>
                Apply advanced Dollar Drop logic across all trading methods
              </Text>
            </View>
            
            {dollarDropEnabled && (
              <>
                <View style={styles.inputGroup}>
                  <View style={styles.switchContainer}>
                    <View style={styles.switchLabelContainer}>
                      <Target size={16} color={Colors.light.chart.up} />
                      <Text style={styles.switchLabel}>Profit Taking with Drop Trigger</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.switch, profitTakingEnabled && styles.switchActive]}
                      onPress={() => setProfitTakingEnabled(!profitTakingEnabled)}
                    >
                      <View style={[styles.switchThumb, profitTakingEnabled && styles.switchThumbActive]} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.inputDescription}>
                    Sell when profit target is reached and price drops by trigger amount
                  </Text>
                </View>
                
                {profitTakingEnabled && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.switchLabel}>Profit Percentage Threshold</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.input}
                          value={profitTakingPercentage}
                          onChangeText={setProfitTakingPercentage}
                          keyboardType="numeric"
                          placeholder="10"
                        />
                        <Text style={styles.unit}>%</Text>
                      </View>
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.switchLabel}>Profit Dollar Threshold (optional)</Text>
                      <View style={styles.inputContainer}>
                        <Text style={styles.unit}>$</Text>
                        <TextInput
                          style={styles.input}
                          value={profitTakingDollarAmount}
                          onChangeText={setProfitTakingDollarAmount}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.switchLabel}>Price Drop Trigger Amount</Text>
                      <View style={styles.inputContainer}>
                        <Text style={styles.unit}>$</Text>
                        <TextInput
                          style={styles.input}
                          value={dollarDropTriggerAmount}
                          onChangeText={setDollarDropTriggerAmount}
                          keyboardType="numeric"
                          placeholder="0.10"
                        />
                      </View>
                    </View>
                  </>
                )}
                
                <View style={styles.inputGroup}>
                  <View style={styles.switchContainer}>
                    <View style={styles.switchLabelContainer}>
                      <AlertTriangle size={16} color={Colors.light.chart.down} />
                      <Text style={styles.switchLabel}>Sell at/below Buy Price</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.switch, sellAtBuyPriceEnabled && styles.switchActive]}
                      onPress={() => setSellAtBuyPriceEnabled(!sellAtBuyPriceEnabled)}
                    >
                      <View style={[styles.switchThumb, sellAtBuyPriceEnabled && styles.switchThumbActive]} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.inputDescription}>
                    Automatically sell if price falls to or below the original buy price
                  </Text>
                </View>
                
                <View style={styles.inputGroup}>
                  <View style={styles.switchContainer}>
                    <View style={styles.switchLabelContainer}>
                      <TrendingDown size={16} color={Colors.light.chart.down} />
                      <Text style={styles.switchLabel}>Sell after Consecutive Falls</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.switch, consecutiveFallsEnabled && styles.switchActive]}
                      onPress={() => setConsecutiveFallsEnabled(!consecutiveFallsEnabled)}
                    >
                      <View style={[styles.switchThumb, consecutiveFallsEnabled && styles.switchThumbActive]} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.inputDescription}>
                    Sell if price falls for consecutive intervals
                  </Text>
                </View>
                
                {consecutiveFallsEnabled && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.switchLabel}>Number of Consecutive Falls</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        value={consecutiveFallsCount}
                        onChangeText={setConsecutiveFallsCount}
                        keyboardType="numeric"
                        placeholder="3"
                      />
                      <Text style={styles.unit}>intervals</Text>
                    </View>
                  </View>
                )}
                
                <View style={styles.inputGroup}>
                  <View style={styles.switchContainer}>
                    <View style={styles.switchLabelContainer}>
                      <Shield size={16} color={Colors.light.primary} />
                      <Text style={styles.switchLabel}>Enhanced Drop Protection</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.switch, enhancedDropProtectionEnabled && styles.switchActive]}
                      onPress={() => setEnhancedDropProtectionEnabled(!enhancedDropProtectionEnabled)}
                    >
                      <View style={[styles.switchThumb, enhancedDropProtectionEnabled && styles.switchThumbActive]} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.inputDescription}>
                    Wait for specified delays after last interval, then check live price twice before selling
                  </Text>
                </View>
                
                {enhancedDropProtectionEnabled && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.switchLabel}>First delay (seconds)</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.input}
                          value={firstDelaySeconds}
                          onChangeText={setFirstDelaySeconds}
                          keyboardType="numeric"
                          placeholder="15"
                        />
                        <Text style={styles.unit}>s</Text>
                      </View>
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.switchLabel}>Second delay (seconds)</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.input}
                          value={secondDelaySeconds}
                          onChangeText={setSecondDelaySeconds}
                          keyboardType="numeric"
                          placeholder="30"
                        />
                      </View>
                    </View>
                    
                    <View style={styles.enhancedProtectionDescription}>
                      <Text style={styles.enhancedProtectionText}>
                        📊 Enhanced Protection Logic:
                      </Text>
                      <Text style={styles.enhancedProtectionBullet}>
                        • After last interval, wait {firstDelaySeconds || '15'}s and check live price
                      </Text>
                      <Text style={styles.enhancedProtectionBullet}>
                        • Wait another {secondDelaySeconds || '30'}s and check again
                      </Text>
                      <Text style={styles.enhancedProtectionBullet}>
                        • If both live prices are lower than last interval price, trigger sell
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          {/* Fixed Create Button at Bottom */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.createBotButton} onPress={handleCreateBot}>
              <Text style={styles.createBotButtonText}>Create Bot</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    marginVertical: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginLeft: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  botsList: {
    // Removed maxHeight to show all bots without scrolling
  },
  botItem: {
    padding: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  botSeparator: {
    height: 12,
  },
  botHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  botInfo: {
    flex: 1,
  },
  botName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  botStock: {
    fontSize: 14,
    color: Colors.light.subtext,
  },
  botControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  playButton: {
    backgroundColor: Colors.light.chart.up,
  },
  pauseButton: {
    backgroundColor: Colors.light.chart.down,
  },
  deleteButton: {
    padding: 8,
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    padding: 12,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.light.subtext,
    marginBottom: 4,
  },
  statusValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 4,
  },
  priceComparisonContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  buyPriceLabel: {
    fontSize: 10,
    color: Colors.light.subtext,
    marginBottom: 2,
  },
  buyPriceValue: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.text,
  },
  profitLossContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  profitLossText: {
    fontSize: 11,
    fontWeight: '600',
  },
  positionSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: Colors.light.chart.up,
    borderRadius: 8,
    padding: 12,
  },
  positionItem: {
    alignItems: 'center',
    flex: 1,
  },
  positionLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginBottom: 4,
    opacity: 0.9,
  },
  positionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  lastTradeSection: {
    marginBottom: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    padding: 12,
  },
  lastTradeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  lastTradeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lastTradeText: {
    fontSize: 12,
    color: Colors.light.subtext,
  },
  chartSection: {
    marginBottom: 12,
  },
  chartPeriodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    padding: 8,
  },
  chartPeriodText: {
    fontSize: 14,
    color: Colors.light.primary,
    marginLeft: 8,
    fontWeight: '600',
  },
  botStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.subtext,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  historyToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  historyToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  historyContainer: {
    marginTop: 8,
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    padding: 12,
  },
  tradeItem: {
    paddingVertical: 8,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  tradeInfo: {
    flex: 1,
  },
  tradeTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  tradeType: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  tradeDetails: {
    fontSize: 12,
    color: Colors.light.subtext,
  },
  tradeAmounts: {
    alignItems: 'flex-end',
  },
  tradeTotal: {
    fontSize: 14,
    fontWeight: '600',
  },
  tradeProfit: {
    fontSize: 12,
    fontWeight: '500',
  },
  tradeTime: {
    fontSize: 11,
    color: Colors.light.subtext,
    marginTop: 4,
  },
  tradeSeparator: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
  },
  noTradesText: {
    textAlign: 'center',
    color: Colors.light.subtext,
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.subtext,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: Colors.light.primary,
  },
  modalScrollView: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 32,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  inputDescription: {
    fontSize: 14,
    color: Colors.light.subtext,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.light.text,
    flex: 1,
  },
  stockSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stockOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  selectedStockOption: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  stockOptionText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  selectedStockOptionText: {
    color: '#FFFFFF',
  },
  chartPeriodSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  chartPeriodOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  selectedChartPeriodOption: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  chartPeriodOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 4,
  },
  selectedChartPeriodOptionText: {
    color: '#FFFFFF',
  },
  chartPeriodDescription: {
    fontSize: 12,
    color: Colors.light.subtext,
    marginTop: 2,
  },
  selectedChartPeriodDescription: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.border,
    borderRadius: 8,
    padding: 2,
    flexWrap: 'wrap',
    gap: 2,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: '30%',
  },
  activeToggleButton: {
    backgroundColor: Colors.light.primary,
  },
  toggleButtonText: {
    fontSize: 14,
    color: Colors.light.subtext,
    fontWeight: '500',
    marginLeft: 4,
  },
  activeToggleButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  unit: {
    fontSize: 16,
    color: Colors.light.subtext,
    paddingHorizontal: 4,
  },
  createBotButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  createBotButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    color: Colors.light.text,
    marginLeft: 8,
    fontWeight: '500',
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: Colors.light.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  tradingMethodContainer: {
    gap: 12,
  },
  tradingMethodOption: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: Colors.light.background,
  },
  activeTradingMethodOption: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  tradingMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tradingMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 8,
  },
  activeTradingMethodTitle: {
    color: '#FFFFFF',
  },
  tradingMethodDescription: {
    fontSize: 14,
    color: Colors.light.subtext,
    lineHeight: 20,
  },
  activeTradingMethodDescription: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
  enhancedProtectionDescription: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.primary,
  },
  enhancedProtectionText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  enhancedProtectionBullet: {
    fontSize: 13,
    color: Colors.light.subtext,
    marginLeft: 8,
    marginBottom: 4,
    lineHeight: 18,
  }
});

export default MyBots;