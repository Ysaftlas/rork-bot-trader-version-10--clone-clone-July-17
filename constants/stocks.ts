export interface Stock {
  symbol: string;
  name: string;
  company: string;
}

export const AVAILABLE_STOCKS: Stock[] = [
  {
    symbol: 'TSLA',
    name: 'Tesla',
    company: 'Tesla, Inc.'
  },
  {
    symbol: 'META',
    name: 'Meta',
    company: 'Meta Platforms, Inc.'
  },
  {
    symbol: 'MSTR',
    name: 'MicroStrategy',
    company: 'MicroStrategy Incorporated'
  },
  {
    symbol: 'APP',
    name: 'AppLovin',
    company: 'AppLovin Corporation'
  }
];

export const DEFAULT_STOCK = AVAILABLE_STOCKS[0]; // Tesla as default