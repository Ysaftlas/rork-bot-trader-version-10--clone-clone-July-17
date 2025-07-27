export interface StockData {
  timestamp: number;
  price: number;
  volume: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface TradeHistory {
  id: string;
  timestamp: number;
  type: 'BUY' | 'SELL';
  price: number;
  shares: number;
  total: number;
  profit: number; // Added profit field to track profit/loss per trade
}

export interface Portfolio {
  cash: number;
  shares: number;
  averageBuyPrice: number;
  totalInvested: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercentage: number;
}

export interface TradingSettings {
  enabled: boolean;
  maxInvestmentPerTrade: number; // maximum amount to invest per trade (dollars or shares based on investmentType)
  investmentType: 'dollars' | 'shares'; // whether maxInvestmentPerTrade is in dollars or shares
}