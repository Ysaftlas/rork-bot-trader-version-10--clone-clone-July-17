import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StockData, TradeHistory, Portfolio, TradingSettings } from '@/types/stock';
import { TradingBot, BotTradeHistory } from '@/types/bot';
import { Stock, DEFAULT_STOCK } from '@/constants/stocks';
import { 
  calculatePortfolioValue, 
  getPriceMovement,
  getTrendDirection
} from '@/utils/stockUtils';
import {
  setTwelveDataCredentials,
  getCurrentStockPrice,
  getStockHistoricalData,
  getStockIntradayData,
  testApiConnection
} from '@/utils/twelveDataApi';
import {
  makeTradingDecision,
  calculateSharesToBuy
} from '@/utils/tradingBotUtils';

interface StockState {
  selectedStock: Stock;
  stockData: StockData[];
  intradayData: StockData[]; // 1-minute data for 1D chart
  fiveMinuteData: StockData[]; // 5-minute data for 5min chart
  oneSecondData: StockData[]; // Pure second-by-second data for 1sec chart
  oneDaySecondData: StockData[]; // Full trading day second-by-second data for 1DSec chart (9:30 AM - 4:00 PM)
  currentPrice: number;
  priceMovement: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
  };
  trendDirection: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
    strength: 'strong' | 'moderate' | 'weak';
  };
  previousTrendDirection: 'up' | 'down' | 'neutral'; // Track previous trend for change detection
  portfolio: Portfolio;
  tradeHistory: TradeHistory[];
  tradingSettings: TradingSettings;
  isLoading: boolean;
  lastUpdated: number | null;
  apiCredentials: {
    apiKey: string;
  };
  apiConnectionStatus: 'connected' | 'disconnected' | 'testing';
  realTimeInterval: NodeJS.Timeout | null;
  
  // Bot management
  bots: TradingBot[];
  botTradeHistory: BotTradeHistory[];
  
  // Actions
  setSelectedStock: (stock: Stock) => void;
  fetchStockData: () => Promise<void>;
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
  executeTrade: (type: 'BUY' | 'SELL', shares: number, price: number) => void;
  updateTradingSettings: (settings: Partial<TradingSettings>) => void;
  resetPortfolio: () => void;
  checkAndExecuteAutomatedTrades: () => void;
  setApiCredentials: (apiKey: string) => void;
  testApiConnection: () => Promise<boolean>;
  
  // Bot actions
  createBot: (bot: Omit<TradingBot, 'id' | 'createdAt' | 'stats'>) => void;
  toggleBot: (botId: string) => void;
  deleteBot: (botId: string) => void;
  executeBotTrade: (botId: string, type: 'BUY' | 'SELL', shares: number, price: number, stockSymbol: string) => void;
  checkAndExecuteBotTrades: () => Promise<void>;
}

export const useStockStore = create<StockState>()(
  persist(
    (set, get) => ({
      selectedStock: DEFAULT_STOCK,
      stockData: [],
      intradayData: [],
      fiveMinuteData: [],
      oneSecondData: [],
      oneDaySecondData: [],
      currentPrice: 0,
      priceMovement: {
        direction: 'neutral',
        percentage: 0
      },
      trendDirection: {
        direction: 'neutral',
        percentage: 0,
        strength: 'weak'
      },
      previousTrendDirection: 'neutral',
      portfolio: {
        cash: 10000, // Start with $10,000
        shares: 0,
        averageBuyPrice: 0,
        totalInvested: 0,
        totalValue: 10000,
        profitLoss: 0,
        profitLossPercentage: 0
      },
      tradeHistory: [],
      tradingSettings: {
        enabled: false,
        maxInvestmentPerTrade: 2000, // Default $2000 per trade
        investmentType: 'dollars', // Default to dollars
      },
      isLoading: false,
      lastUpdated: null,
      apiCredentials: {
        apiKey: '647dccbf0e9e4525b926e198c70d686c' // Set the provided API key
      },
      apiConnectionStatus: 'disconnected',
      realTimeInterval: null,
      
      // Bot state
      bots: [],
      botTradeHistory: [],
      
      setSelectedStock: (stock) => {
        const currentStock = get().selectedStock;
        if (currentStock.symbol !== stock.symbol) {
          // Stop real-time updates for the previous stock
          get().stopRealTimeUpdates();
          
          // Clear existing data
          set({
            selectedStock: stock,
            stockData: [],
            intradayData: [],
            fiveMinuteData: [],
            oneSecondData: [],
            oneDaySecondData: [],
            currentPrice: 0,
            isLoading: true
          });
          
          // Fetch data for the new stock
          get().fetchStockData();
        }
      },
      
      setApiCredentials: (apiKey) => {
        set({ apiCredentials: { apiKey } });
        setTwelveDataCredentials(apiKey);
      },
      
      testApiConnection: async () => {
        set({ apiConnectionStatus: 'testing' });
        
        try {
          const isConnected = await testApiConnection();
          set({ apiConnectionStatus: isConnected ? 'connected' : 'disconnected' });
          return isConnected;
        } catch (error) {
          set({ apiConnectionStatus: 'disconnected' });
          return false;
        }
      },
      
      startRealTimeUpdates: () => {
        const { realTimeInterval, selectedStock } = get();
        
        // Clear existing interval if any
        if (realTimeInterval) {
          clearInterval(realTimeInterval);
        }
        
        console.log(`Starting pure second-by-second real-time updates for ${selectedStock.symbol}...`);
        
        // Start new interval for pure 1-second updates
        const interval = setInterval(async () => {
          try {
            const currentPrice = await getCurrentStockPrice(selectedStock.symbol);
            const now = Date.now();
            const currentDate = new Date(now);
            
            console.log(`Pure second-by-second update for ${selectedStock.symbol}: Recording data point`, currentPrice, 'at', currentDate.toLocaleTimeString());
            
            set(state => {
              // Create new data point with current price and exact timestamp
              const newDataPoint: StockData = {
                timestamp: now,
                price: currentPrice,
                volume: 100000 // Default volume for real-time updates
              };
              
              // Update pure 1sec data - add the new point
              let updatedOneSecondData = [...state.oneSecondData, newDataPoint];
              updatedOneSecondData.sort((a, b) => a.timestamp - b.timestamp);
              
              // Update 1DSec trading day data - accumulate throughout trading day (9:30 AM - 4:00 PM)
              let updatedOneDaySecondData = [...state.oneDaySecondData, newDataPoint];
              
              // Define trading hours (9:30 AM to 4:00 PM EST)
              const today = new Date();
              const tradingDayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30, 0, 0);
              const tradingDayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0, 0, 0);
              
              // Keep all data from today's trading session (9:30 AM onwards) for 1DSec
              updatedOneDaySecondData = updatedOneDaySecondData
                .filter(d => d.timestamp >= tradingDayStart.getTime())
                .sort((a, b) => a.timestamp - b.timestamp);
              
              console.log(`Pure 1sec data for ${selectedStock.symbol}: ${updatedOneSecondData.length} total points recorded`);
              console.log(`1DSec trading day data for ${selectedStock.symbol}: ${updatedOneDaySecondData.length} points accumulated`);
              
              if (updatedOneSecondData.length > 0) {
                const firstPoint = updatedOneSecondData[0];
                const lastPoint = updatedOneSecondData[updatedOneSecondData.length - 1];
                console.log('Pure 1sec data range:', 
                  new Date(firstPoint.timestamp).toLocaleTimeString(),
                  'to',
                  new Date(lastPoint.timestamp).toLocaleTimeString()
                );
              }
              
              if (updatedOneDaySecondData.length > 0) {
                const totalTradingSeconds = (tradingDayEnd.getTime() - tradingDayStart.getTime()) / 1000;
                const currentTradingSeconds = Math.max(0, (now - tradingDayStart.getTime()) / 1000);
                const progressPercentage = Math.min(100, (currentTradingSeconds / totalTradingSeconds) * 100);
                console.log(`1DSec trading day progress: ${progressPercentage.toFixed(1)}%`);
              }
              
              // Update current price and portfolio
              const updatedPortfolio = calculatePortfolioValue(
                state.portfolio.shares,
                currentPrice,
                state.portfolio.cash,
                state.portfolio.averageBuyPrice
              );
              
              return {
                oneSecondData: updatedOneSecondData,
                oneDaySecondData: updatedOneDaySecondData,
                currentPrice,
                portfolio: updatedPortfolio,
                lastUpdated: now
              };
            });
          } catch (error) {
            console.error(`Real-time update failed for ${selectedStock.symbol}:`, error);
          }
        }, 1000); // Update every 1 second for pure second-by-second data recording
        
        set({ realTimeInterval: interval });
      },
      
      stopRealTimeUpdates: () => {
        const { realTimeInterval } = get();
        if (realTimeInterval) {
          clearInterval(realTimeInterval);
          set({ realTimeInterval: null });
          console.log('Stopped real-time updates for 1-second chart');
        }
      },
      
      fetchStockData: async () => {
        const { selectedStock } = get();
        set({ isLoading: true });
        
        try {
          console.log(`Fetching REAL ${selectedStock.name} data from TwelveData API...`);
          
          // Set API credentials first
          setTwelveDataCredentials(get().apiCredentials.apiKey);
          
          // Get current price first
          const currentPrice = await getCurrentStockPrice(selectedStock.symbol);
          console.log(`Current ${selectedStock.name} price from TwelveData API:`, currentPrice);
          
          // Get historical daily data for the past year (365 days) for longer-term charts
          const dailyData = await getStockHistoricalData(selectedStock.symbol, '1day', 365);
          console.log(`Daily data points from TwelveData API for ${selectedStock.name} (past year):`, dailyData.length);
          
          // Get today's 1-minute intraday data for 1D chart
          let intradayData: StockData[] = [];
          try {
            console.log(`Fetching 1-minute intraday data for 1D chart for ${selectedStock.name} from TwelveData /time_series endpoint...`);
            // Get 1-minute data for today - request enough points to cover full trading day
            intradayData = await getStockIntradayData(selectedStock.symbol, '1min', 500);
            console.log(`Raw 1-minute intraday data points from TwelveData /time_series for ${selectedStock.name}:`, intradayData.length);
            
            // Filter to only include data from today
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
            
            intradayData = intradayData.filter(d => {
              const dataDate = new Date(d.timestamp);
              return dataDate >= todayStart && dataDate <= todayEnd;
            });
            
            console.log(`Filtered today 1-minute intraday data points from /time_series for ${selectedStock.name}:`, intradayData.length);
            
            if (intradayData.length > 0) {
              console.log(`First 1-minute intraday point from /time_series for ${selectedStock.name}:`, new Date(intradayData[0].timestamp).toLocaleString(), intradayData[0].price);
              console.log(`Last 1-minute intraday point from /time_series for ${selectedStock.name}:`, new Date(intradayData[intradayData.length - 1].timestamp).toLocaleString(), intradayData[intradayData.length - 1].price);
            } else {
              console.log(`No 1-minute intraday data for today from /time_series for ${selectedStock.name}, creating current price point`);
              // If no intraday data, create a point with current price
              const now = new Date();
              intradayData = [{
                timestamp: now.getTime(),
                price: currentPrice,
                volume: 100000 // Default volume
              }];
            }
          } catch (intradayError) {
            console.error(`Could not fetch 1-minute intraday data from TwelveData /time_series for ${selectedStock.name}:`, intradayError);
            // If we can't get intraday data, create a single point for now with current price
            const now = new Date();
            intradayData = [{
              timestamp: now.getTime(),
              price: currentPrice,
              volume: 100000 // Default volume
            }];
          }
          
          // Get today's 5-minute data for 5min chart
          let fiveMinuteData: StockData[] = [];
          try {
            console.log(`Fetching 5-minute data for 5min chart for ${selectedStock.name} from TwelveData /time_series endpoint...`);
            // Get 5-minute data for today - request enough points to cover full trading day (78 intervals in a trading day)
            fiveMinuteData = await getStockIntradayData(selectedStock.symbol, '5min', 100);
            console.log(`Raw 5-minute data points from TwelveData /time_series for ${selectedStock.name}:`, fiveMinuteData.length);
            
            // Filter to only include data from today
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
            
            fiveMinuteData = fiveMinuteData.filter(d => {
              const dataDate = new Date(d.timestamp);
              return dataDate >= todayStart && dataDate <= todayEnd;
            });
            
            console.log(`Filtered today 5-minute data points from /time_series for ${selectedStock.name}:`, fiveMinuteData.length);
            
            if (fiveMinuteData.length > 0) {
              console.log(`First 5-minute point from /time_series for ${selectedStock.name}:`, new Date(fiveMinuteData[0].timestamp).toLocaleString(), fiveMinuteData[0].price);
              console.log(`Last 5-minute point from /time_series for ${selectedStock.name}:`, new Date(fiveMinuteData[fiveMinuteData.length - 1].timestamp).toLocaleString(), fiveMinuteData[fiveMinuteData.length - 1].price);
            } else {
              console.log(`No 5-minute data for today from /time_series for ${selectedStock.name}, creating current price point`);
              // If no 5-minute data, create a point with current price
              const now = new Date();
              fiveMinuteData = [{
                timestamp: now.getTime(),
                price: currentPrice,
                volume: 100000 // Default volume
              }];
            }
          } catch (fiveMinError) {
            console.error(`Could not fetch 5-minute data from TwelveData /time_series for ${selectedStock.name}:`, fiveMinError);
            // If we can't get 5-minute data, create a single point for now with current price
            const now = new Date();
            fiveMinuteData = [{
              timestamp: now.getTime(),
              price: currentPrice,
              volume: 100000 // Default volume
            }];
          }
          
          // Initialize pure 1-second chart data (starts empty, will be filled with real-time data)
          let oneSecondData: StockData[] = [];
          console.log(`Initializing pure 1-second chart for ${selectedStock.name} (starts empty, fills with real-time data)...`);
          
          // Initialize 1DSec trading day data with today's trading day foundation (9:30 AM onwards)
          let oneDaySecondData: StockData[] = [];
          try {
            console.log(`Initializing 1DSec trading day chart with foundation for ${selectedStock.name}...`);
            
            // Use the same intraday data we already fetched for the 1D chart as a foundation
            // This gives us 1-minute data from the beginning of the trading day
            const today = new Date();
            const tradingDayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30, 0, 0);
            const tradingDayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0, 0, 0);
            
            // Filter intraday data to start from 9:30 AM today as foundation for 1DSec
            oneDaySecondData = intradayData
              .filter(d => d.timestamp >= tradingDayStart.getTime())
              .sort((a, b) => a.timestamp - b.timestamp);
            
            console.log(`Foundation 1-minute data points for 1DSec chart for ${selectedStock.name}:`, oneDaySecondData.length);
            
            if (oneDaySecondData.length > 0) {
              console.log(`First foundation point for 1DSec chart for ${selectedStock.name}:`, new Date(oneDaySecondData[0].timestamp).toLocaleString(), oneDaySecondData[0].price);
              console.log(`Last foundation point for 1DSec chart for ${selectedStock.name}:`, new Date(oneDaySecondData[oneDaySecondData.length - 1].timestamp).toLocaleString(), oneDaySecondData[oneDaySecondData.length - 1].price);
            } else {
              console.log(`No foundation data for 1DSec chart for ${selectedStock.name}, creating starting point at 9:30 AM`);
              // If no trading day data, create a starting point at 9:30 AM with current price
              const now = Date.now();
              const startTime = now >= tradingDayStart.getTime() ? now : tradingDayStart.getTime();
              oneDaySecondData = [{
                timestamp: startTime,
                price: currentPrice,
                volume: 100000 // Default volume
              }];
            }
            
            // Calculate expected data points for full trading day (6.5 hours = 23,400 seconds)
            const totalTradingSeconds = (tradingDayEnd.getTime() - tradingDayStart.getTime()) / 1000;
            console.log(`1DSec chart will accumulate up to ${totalTradingSeconds} data points throughout the trading day (9:30 AM - 4:00 PM)`);
            
          } catch (oneDaySecError) {
            console.error(`Could not initialize 1DSec chart foundation for ${selectedStock.name}:`, oneDaySecError);
            // If we can't get foundation data, create a starting point with current price
            const now = Date.now();
            const today = new Date();
            const tradingDayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30, 0, 0);
            const startTime = now >= tradingDayStart.getTime() ? now : tradingDayStart.getTime();
            
            oneDaySecondData = [{
              timestamp: startTime,
              price: currentPrice,
              volume: 100000 // Default volume
            }];
          }
          
          // Use the most recent price from available data as current price
          let finalCurrentPrice = currentPrice;
          if (intradayData.length > 0) {
            finalCurrentPrice = intradayData[intradayData.length - 1].price;
            console.log(`Using most recent 1-minute price as current for ${selectedStock.name}:`, finalCurrentPrice);
          } else if (fiveMinuteData.length > 0) {
            finalCurrentPrice = fiveMinuteData[fiveMinuteData.length - 1].price;
            console.log(`Using most recent 5-minute price as current for ${selectedStock.name}:`, finalCurrentPrice);
          } else {
            console.log(`Using TwelveData API current price for ${selectedStock.name}:`, finalCurrentPrice);
          }
          
          console.log(`Final historical data points for ${selectedStock.name}:`, dailyData.length);
          console.log(`Final 1-minute intraday data points from /time_series for ${selectedStock.name}:`, intradayData.length);
          console.log(`Final 5-minute data points from /time_series for ${selectedStock.name}:`, fiveMinuteData.length);
          console.log(`Final pure 1sec initialization data points for ${selectedStock.name}:`, oneSecondData.length);
          console.log(`Final 1DSec initialization data points for ${selectedStock.name}:`, oneDaySecondData.length);
          console.log(`Final current price from TwelveData for ${selectedStock.name}:`, finalCurrentPrice);
          
          if (dailyData.length > 0) {
            console.log(`Historical data range for ${selectedStock.name}:`, 
              new Date(dailyData[0].timestamp).toLocaleString(), 
              'to', 
              new Date(dailyData[dailyData.length - 1].timestamp).toLocaleString()
            );
          }
          
          // Calculate price movement and trend from intraday data if available, otherwise from daily data
          const dataForAnalysis = intradayData.length > 0 ? intradayData : fiveMinuteData.length > 0 ? fiveMinuteData : dailyData;
          const priceMovement = getPriceMovement(dataForAnalysis);
          const trendDirection = getTrendDirection(dataForAnalysis, 0.5);
          
          set(state => {
            // Store previous trend direction for change detection
            const previousTrendDirection = state.trendDirection.direction;
            
            return {
              stockData: dailyData,
              intradayData: intradayData, // Store 1-minute data for 1D chart
              fiveMinuteData: fiveMinuteData, // Store 5-minute data for 5min chart
              oneSecondData: oneSecondData, // Pure second-by-second data for 1sec chart
              oneDaySecondData: oneDaySecondData, // Trading day second-by-second data for 1DSec chart
              currentPrice: finalCurrentPrice,
              priceMovement,
              trendDirection,
              previousTrendDirection,
              isLoading: false,
              lastUpdated: Date.now(),
              apiConnectionStatus: 'connected'
            };
          });
          
          // Update portfolio value with new price
          const { portfolio } = get();
          const updatedPortfolio = calculatePortfolioValue(
            portfolio.shares,
            finalCurrentPrice,
            portfolio.cash,
            portfolio.averageBuyPrice
          );
          
          set({ portfolio: updatedPortfolio });
          
          // Check for automated trades
          get().checkAndExecuteAutomatedTrades();
          
          // Check for bot trades
          get().checkAndExecuteBotTrades();
        } catch (error) {
          console.error(`CRITICAL ERROR: Failed to fetch real data from TwelveData API for ${selectedStock.name}:`, error);
          set({ 
            isLoading: false, 
            apiConnectionStatus: 'disconnected',
            stockData: [],
            intradayData: [],
            fiveMinuteData: [],
            oneSecondData: [],
            oneDaySecondData: [],
            currentPrice: 0
          });
          
          throw new Error(`Failed to fetch real ${selectedStock.name} data: ${(error as Error).message}`);
        }
      },
      
      executeTrade: (type, shares, price) => {
        const { portfolio, tradeHistory } = get();
        const total = shares * price;
        
        let newPortfolio = { ...portfolio };
        let profit = 0;
        
        if (type === 'BUY') {
          // Check if enough cash
          if (portfolio.cash < total) {
            console.error('Not enough cash to execute trade');
            return;
          }
          
          // Update average buy price
          const newTotalShares = portfolio.shares + shares;
          const newAverageBuyPrice = newTotalShares > 0
            ? (portfolio.shares * portfolio.averageBuyPrice + total) / newTotalShares
            : 0;
          
          newPortfolio = {
            ...portfolio,
            cash: portfolio.cash - total,
            shares: newTotalShares,
            averageBuyPrice: parseFloat(newAverageBuyPrice.toFixed(2)),
          };
        } else if (type === 'SELL') {
          // Check if enough shares
          if (portfolio.shares < shares) {
            console.error('Not enough shares to sell');
            return;
          }
          
          // Calculate profit/loss for this trade
          profit = (price - portfolio.averageBuyPrice) * shares;
          
          newPortfolio = {
            ...portfolio,
            cash: portfolio.cash + total,
            shares: portfolio.shares - shares,
          };
          
          // If all shares sold, reset average buy price
          if (newPortfolio.shares === 0) {
            newPortfolio.averageBuyPrice = 0;
          }
        }
        
        // Recalculate portfolio value
        const updatedPortfolio = calculatePortfolioValue(
          newPortfolio.shares,
          price,
          newPortfolio.cash,
          newPortfolio.averageBuyPrice
        );
        
        // Add to trade history
        const newTrade: TradeHistory = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          type,
          price,
          shares,
          total,
          profit
        };
        
        set({
          portfolio: updatedPortfolio,
          tradeHistory: [newTrade, ...tradeHistory]
        });
      },
      
      updateTradingSettings: (settings) => {
        set(state => ({
          tradingSettings: {
            ...state.tradingSettings,
            ...settings
          }
        }));
      },
      
      resetPortfolio: () => {
        set({
          portfolio: {
            cash: 10000,
            shares: 0,
            averageBuyPrice: 0,
            totalInvested: 0,
            totalValue: 10000,
            profitLoss: 0,
            profitLossPercentage: 0
          },
          tradeHistory: []
        });
      },
      
      checkAndExecuteAutomatedTrades: () => {
        const { 
          tradingSettings, 
          trendDirection,
          previousTrendDirection,
          currentPrice, 
          portfolio,
          selectedStock
        } = get();
        
        // If automated trading is disabled, do nothing
        if (!tradingSettings.enabled) return;
        
        console.log(`Checking automated trades for ${selectedStock.name}:`, {
          currentTrend: trendDirection.direction,
          previousTrend: previousTrendDirection,
          currentPrice,
          shares: portfolio.shares,
          cash: portfolio.cash
        });
        
        // Check for trend direction change and execute trades accordingly
        if (previousTrendDirection !== trendDirection.direction) {
          console.log(`Trend direction changed from ${previousTrendDirection} to ${trendDirection.direction} for ${selectedStock.name}`);
          
          // BUY when trend changes from DOWN to UP
          if (previousTrendDirection === 'down' && trendDirection.direction === 'up') {
            let sharesToBuy = 0;
            
            if (tradingSettings.investmentType === 'dollars') {
              // Calculate shares based on dollar amount
              if (portfolio.cash >= tradingSettings.maxInvestmentPerTrade) {
                sharesToBuy = Math.floor(tradingSettings.maxInvestmentPerTrade / currentPrice);
              }
            } else {
              // Use shares directly
              const maxAffordableShares = Math.floor(portfolio.cash / currentPrice);
              sharesToBuy = Math.min(tradingSettings.maxInvestmentPerTrade, maxAffordableShares);
            }
            
            if (sharesToBuy > 0) {
              get().executeTrade('BUY', sharesToBuy, currentPrice);
              console.log(`AUTO BUY: ${sharesToBuy} shares of ${selectedStock.name} at $${currentPrice} (trend changed from DOWN to UP)`);
            }
          }
          
          // SELL when trend changes from UP to DOWN
          if (previousTrendDirection === 'up' && trendDirection.direction === 'down') {
            if (portfolio.shares > 0) {
              let sharesToSell = portfolio.shares;
              
              if (tradingSettings.investmentType === 'shares') {
                // Limit to max shares setting
                sharesToSell = Math.min(tradingSettings.maxInvestmentPerTrade, portfolio.shares);
              }
              
              get().executeTrade('SELL', sharesToSell, currentPrice);
              console.log(`AUTO SELL: ${sharesToSell} shares of ${selectedStock.name} at $${currentPrice} (trend changed from UP to DOWN)`);
            }
          }
        }
      },
      
      // Bot management actions
      createBot: (botData) => {
        const newBot: TradingBot = {
          ...botData,
          id: Date.now().toString(),
          createdAt: Date.now(),
          stats: {
            totalTrades: 0,
            totalProfit: 0,
            winRate: 0,
            lastTradeAt: null
          }
        };
        
        set(state => ({
          bots: [...state.bots, newBot]
        }));
      },
      
      toggleBot: (botId) => {
        set(state => ({
          bots: state.bots.map(bot =>
            bot.id === botId ? { ...bot, isActive: !bot.isActive } : bot
          )
        }));
      },
      
      deleteBot: (botId) => {
        set(state => ({
          bots: state.bots.filter(bot => bot.id !== botId),
          botTradeHistory: state.botTradeHistory.filter(trade => trade.botId !== botId)
        }));
      },
      
      executeBotTrade: (botId, type, shares, price, stockSymbol) => {
        const { bots, botTradeHistory } = get();
        const bot = bots.find(b => b.id === botId);
        
        if (!bot || !bot.isActive) return;
        
        const total = shares * price;
        let profit = 0;
        
        if (type === 'SELL') {
          // Calculate profit based on average buy price from bot's previous trades
          const botBuyTrades = botTradeHistory.filter(t => t.botId === botId && t.type === 'BUY');
          if (botBuyTrades.length > 0) {
            const totalBought = botBuyTrades.reduce((sum, t) => sum + t.total, 0);
            const totalShares = botBuyTrades.reduce((sum, t) => sum + t.shares, 0);
            const avgBuyPrice = totalShares > 0 ? totalBought / totalShares : 0;
            profit = (price - avgBuyPrice) * shares;
          }
        }
        
        // Create bot trade record
        const newBotTrade: BotTradeHistory = {
          id: Date.now().toString(),
          botId,
          timestamp: Date.now(),
          type,
          price,
          shares,
          total,
          profit,
          stockSymbol
        };
        
        // Update bot stats
        const updatedBots = bots.map(b => {
          if (b.id === botId) {
            const newTotalTrades = b.stats.totalTrades + 1;
            const newTotalProfit = b.stats.totalProfit + profit;
            
            // Calculate win rate (only for sell trades)
            let newWinRate = b.stats.winRate;
            if (type === 'SELL') {
              const botSellTrades = botTradeHistory.filter(t => t.botId === botId && t.type === 'SELL');
              const winningTrades = [...botSellTrades, newBotTrade].filter(t => t.profit > 0).length;
              const totalSellTrades = botSellTrades.length + 1;
              newWinRate = totalSellTrades > 0 ? (winningTrades / totalSellTrades) * 100 : 0;
            }
            
            return {
              ...b,
              stats: {
                totalTrades: newTotalTrades,
                totalProfit: newTotalProfit,
                winRate: newWinRate,
                lastTradeAt: Date.now()
              }
            };
          }
          return b;
        });
        
        set({
          bots: updatedBots,
          botTradeHistory: [newBotTrade, ...botTradeHistory]
        });
        
        console.log(`BOT ${bot.name}: ${type} ${shares} shares of ${stockSymbol} at $${price} (profit: ${profit > 0 ? '+' : ''}$${profit.toFixed(2)})`);
      },
      
      checkAndExecuteBotTrades: async () => {
        const { bots, selectedStock, currentPrice, intradayData, fiveMinuteData, oneSecondData, oneDaySecondData, stockData, botTradeHistory } = get();
        const activeBots = bots.filter(bot => bot.isActive);
        
        if (activeBots.length === 0) return;
        
        // Check each active bot for its specific stock
        for (const bot of activeBots) {
          try {
            // Get current price for the bot's stock
            let botCurrentPrice = currentPrice;
            if (bot.stockSymbol !== selectedStock.symbol) {
              botCurrentPrice = await getCurrentStockPrice(bot.stockSymbol);
            }
            
            // Get trend data for the bot's stock based on its chart period setting
            let trendData: StockData[] = [];
            if (bot.stockSymbol === selectedStock.symbol) {
              // Use current data if it's the same stock, based on bot's chart period
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
                case '1DSec':
                  trendData = [...oneDaySecondData];
                  break;
                case '5MinSec':
                  // For 5MinSec, combine 5-minute data with recent second-by-second data
                  const now5MinSec = Date.now();
                  const tenMinutesAgo5MinSec = now5MinSec - (10 * 60 * 1000);
                  const olderFiveMinData5MinSec = fiveMinuteData.filter(d => d.timestamp < tenMinutesAgo5MinSec);
                  const recentSecondData5MinSec = oneSecondData.filter(d => d.timestamp >= tenMinutesAgo5MinSec);
                  trendData = [...olderFiveMinData5MinSec, ...recentSecondData5MinSec];
                  break;
              }
            } else {
              // Fetch data for different stock based on bot's chart period
              try {
                switch (bot.settings.chartPeriod) {
                  case '1sec':
                    // For 1sec, get recent 1-minute data as base
                    trendData = await getStockIntradayData(bot.stockSymbol, '1min', 10);
                    break;
                  case '5min':
                    trendData = await getStockIntradayData(bot.stockSymbol, '5min', 10);
                    break;
                  case '1D':
                    trendData = await getStockIntradayData(bot.stockSymbol, '1min', 50);
                    break;
                  case '1DSec':
                    // For 1DSec, get recent 1-minute data as base
                    trendData = await getStockIntradayData(bot.stockSymbol, '1min', 15);
                    break;
                  case '5MinSec':
                    // For 5MinSec, get recent 5-minute data as base
                    trendData = await getStockIntradayData(bot.stockSymbol, '5min', 15);
                    break;
                }
              } catch (error) {
                console.error(`Failed to fetch ${bot.settings.chartPeriod} data for bot ${bot.name} (${bot.stockSymbol}):`, error);
                continue;
              }
            }
            
            if (trendData.length < 2) continue;
            
            // Calculate current position for this bot
            const botBuyTrades = botTradeHistory.filter(t => t.botId === bot.id && t.type === 'BUY');
            const botSellTrades = botTradeHistory.filter(t => t.botId === bot.id && t.type === 'SELL');
            
            const totalBought = botBuyTrades.reduce((sum, t) => sum + t.shares, 0);
            const totalSold = botSellTrades.reduce((sum, t) => sum + t.shares, 0);
            const currentShares = totalBought - totalSold;
            
            // Create current position for the bot if it has shares
            let currentPosition: TradingBot['currentPosition'] | undefined;
            if (currentShares > 0) {
              // Calculate average buy price from bot's buy trades
              const totalBoughtValue = botBuyTrades.reduce((sum, t) => sum + t.total, 0);
              const avgBuyPrice = totalBought > 0 ? totalBoughtValue / totalBought : 0;
              
              currentPosition = {
                buyPrice: avgBuyPrice,
                shares: currentShares,
                timestamp: botBuyTrades[botBuyTrades.length - 1]?.timestamp || Date.now(),
                priceHistory: bot.currentPosition?.priceHistory || [avgBuyPrice]
              };
            }
            
            // Create a temporary bot object with current position for decision making
            const botWithPosition: TradingBot = {
              ...bot,
              currentPosition
            };
            
            console.log(`Bot ${bot.name} current position: ${currentShares} shares (bought: ${totalBought}, sold: ${totalSold})`);
            
            // Use the enhanced trading decision logic
            const decision = makeTradingDecision(
              botWithPosition,
              trendData,
              botCurrentPrice,
              bot.lastProcessedIndex
            );
            
            console.log(`Bot ${bot.name} (${bot.stockSymbol}) decision:`, {
              action: decision.action,
              reason: decision.reason,
              currentShares,
              price: botCurrentPrice
            });
            
            // Execute the trading decision
            if (decision.action === 'BUY' && currentShares === 0) {
              const sharesToBuy = calculateSharesToBuy(
                bot.settings.maxInvestmentPerTrade,
                bot.settings.investmentType,
                botCurrentPrice,
                10000 // Assume unlimited virtual cash for bots
              );
              
              if (sharesToBuy > 0) {
                get().executeBotTrade(bot.id, 'BUY', sharesToBuy, botCurrentPrice, bot.stockSymbol);
                console.log(`BOT ${bot.name}: BUY ${sharesToBuy} shares at ${botCurrentPrice} - ${decision.reason}`);
                
                // Update bot's lastProcessedIndex if needed
                if (decision.newDirectionChange) {
                  set(state => ({
                    bots: state.bots.map(b => 
                      b.id === bot.id 
                        ? { ...b, lastProcessedIndex: decision.newDirectionChange!.index }
                        : b
                    )
                  }));
                }
              }
            } else if (decision.action === 'SELL' && currentShares > 0) {
              let sharesToSell = currentShares;
              
              if (bot.settings.investmentType === 'shares') {
                sharesToSell = Math.min(bot.settings.maxInvestmentPerTrade, currentShares);
              }
              
              get().executeBotTrade(bot.id, 'SELL', sharesToSell, botCurrentPrice, bot.stockSymbol);
              console.log(`BOT ${bot.name}: SELL ${sharesToSell} shares at ${botCurrentPrice} - ${decision.reason}`);
            }
            
            // Update bot position tracking if needed
            if (decision.updatePosition && currentPosition) {
              set(state => ({
                bots: state.bots.map(b => 
                  b.id === bot.id 
                    ? { 
                        ...b, 
                        currentPosition: currentPosition ? {
                          ...currentPosition,
                          ...decision.updatePosition
                        } : undefined
                      }
                    : b
                )
              }));
            }
          } catch (error) {
            console.error(`Error checking trades for bot ${bot.name}:`, error);
          }
        }
      }
    }),
    {
      name: 'multi-stock-trading-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        selectedStock: state.selectedStock,
        portfolio: state.portfolio,
        tradeHistory: state.tradeHistory,
        tradingSettings: state.tradingSettings,
        apiCredentials: state.apiCredentials,
        previousTrendDirection: state.previousTrendDirection,
        bots: state.bots,
        botTradeHistory: state.botTradeHistory
      })
    }
  )
);