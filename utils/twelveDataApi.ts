import { StockData } from '@/types/stock';

// TwelveData API endpoints
const BASE_URL = 'https://api.twelvedata.com';

// API key - will be set from settings
let API_KEY = '647dccbf0e9e4525b926e198c70d686c'; // Set the provided API key

// Interface for TwelveData API response item
interface TwelveDataTimeSeriesItem {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

// Function to set API credentials
export function setTwelveDataCredentials(apiKey: string) {
  API_KEY = apiKey;
  console.log('TwelveData API key set:', apiKey ? 'Yes' : 'No');
}

// Check if credentials are set
function checkCredentials() {
  if (!API_KEY) {
    throw new Error('TwelveData API key not set. Please set it in settings.');
  }
}

// Get current stock price for any symbol
export async function getCurrentStockPrice(symbol: string): Promise<number> {
  checkCredentials();
  
  try {
    const url = `${BASE_URL}/price?symbol=${symbol}&apikey=${API_KEY}`;
    console.log(`Fetching current ${symbol} price from TwelveData API...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`TwelveData Price API response for ${symbol}:`, data);
    
    if (data.status === 'error') {
      throw new Error(data.message || 'TwelveData API error');
    }
    
    if (!data.price) {
      throw new Error(`No price data received from TwelveData API for ${symbol}`);
    }
    
    const price = parseFloat(data.price);
    console.log(`Current ${symbol} price from TwelveData API:`, price);
    
    if (isNaN(price) || price <= 0) {
      throw new Error(`Invalid price data received from TwelveData API for ${symbol}`);
    }
    
    return price;
  } catch (error) {
    console.error(`Error fetching ${symbol} price from TwelveData:`, error);
    throw error;
  }
}

// Get historical stock data for any symbol
export async function getStockHistoricalData(
  symbol: string,
  interval: '1min' | '5min' | '15min' | '30min' | '45min' | '1h' | '2h' | '4h' | '1day' | '1week' | '1month' = '1day',
  outputsize: number = 30
): Promise<StockData[]> {
  checkCredentials();
  
  try {
    const url = `${BASE_URL}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${API_KEY}`;
    console.log(`Fetching ${symbol} ${interval} historical data from TwelveData API...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`TwelveData ${interval} API response status for ${symbol}:`, data.status);
    
    if (data.status === 'error') {
      throw new Error(data.message || 'TwelveData API error');
    }
    
    if (!data.values || !Array.isArray(data.values)) {
      throw new Error(`Invalid data format received from TwelveData API for ${symbol}`);
    }
    
    console.log(`TwelveData ${interval} data points received for ${symbol}:`, data.values.length);
    
    // Transform the data to match our StockData interface
    // TwelveData returns data in reverse chronological order (newest first), so we reverse it
    const transformedData = data.values
      .map((item: TwelveDataTimeSeriesItem) => {
        const timestamp = new Date(item.datetime).getTime();
        const price = parseFloat(item.close);
        const volume = parseInt(item.volume) || 0;
        
        // Validate the data
        if (isNaN(timestamp) || isNaN(price) || price <= 0) {
          console.warn(`Invalid data point from TwelveData for ${symbol}:`, item);
          return null;
        }
        
        return {
          timestamp,
          price: parseFloat(price.toFixed(2)),
          volume,
        };
      })
      .filter((item): item is StockData => item !== null) // Remove invalid data points
      .reverse(); // Reverse to get chronological order (oldest first)
    
    console.log(`TwelveData ${interval} transformed data points for ${symbol}:`, transformedData.length);
    
    if (transformedData.length > 0) {
      console.log(`TwelveData ${interval} first data point for ${symbol}:`, new Date(transformedData[0].timestamp).toLocaleString(), transformedData[0].price);
      console.log(`TwelveData ${interval} last data point for ${symbol}:`, new Date(transformedData[transformedData.length - 1].timestamp).toLocaleString(), transformedData[transformedData.length - 1].price);
    }
    
    return transformedData;
  } catch (error) {
    console.error(`Error fetching ${symbol} ${interval} historical data from TwelveData:`, error);
    throw error;
  }
}

// Get intraday data for more detailed charts - now using 1-minute intervals
export async function getStockIntradayData(
  symbol: string,
  interval: '1min' | '5min' | '15min' | '30min' = '1min',
  outputsize: number = 390
): Promise<StockData[]> {
  console.log(`Fetching ${symbol} intraday data with ${interval} intervals, ${outputsize} points from TwelveData`);
  return getStockHistoricalData(symbol, interval, outputsize);
}

// Get stock quote (more detailed current price info) for any symbol
export async function getStockQuote(symbol: string) {
  checkCredentials();
  
  try {
    const url = `${BASE_URL}/quote?symbol=${symbol}&apikey=${API_KEY}`;
    console.log(`Fetching ${symbol} quote from TwelveData API...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`TwelveData Quote API response for ${symbol}:`, data);
    
    if (data.status === 'error') {
      throw new Error(data.message || 'TwelveData API error');
    }
    
    return {
      price: parseFloat(data.close),
      open: parseFloat(data.open),
      high: parseFloat(data.high),
      low: parseFloat(data.low),
      volume: parseInt(data.volume),
      previousClose: parseFloat(data.previous_close),
      change: parseFloat(data.change),
      percentChange: parseFloat(data.percent_change)
    };
  } catch (error) {
    console.error(`Error fetching ${symbol} quote from TwelveData:`, error);
    throw error;
  }
}

// Test API connection
export async function testApiConnection(): Promise<boolean> {
  try {
    console.log('Testing TwelveData API connection with Tesla...');
    const price = await getCurrentStockPrice('TSLA');
    console.log('TwelveData API connection test successful, Tesla price:', price);
    return true;
  } catch (error) {
    console.error('TwelveData API connection test failed:', error);
    return false;
  }
}