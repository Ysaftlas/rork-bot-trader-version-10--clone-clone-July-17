import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { ArrowUp, ArrowDown } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { formatCurrency } from '@/utils/stockUtils';

interface TradeControlsProps {
  currentPrice: number;
  maxShares: number;
  cashAvailable: number;
  onBuy: (shares: number) => void;
  onSell: (shares: number) => void;
  stockName: string;
}

const TradeControls: React.FC<TradeControlsProps> = ({
  currentPrice,
  maxShares,
  cashAvailable,
  onBuy,
  onSell,
  stockName
}) => {
  const [shares, setShares] = useState('1');
  const sharesNum = parseInt(shares, 10) || 0;
  const totalCost = sharesNum * currentPrice;
  const canBuy = sharesNum > 0 && totalCost <= cashAvailable;
  const canSell = sharesNum > 0 && sharesNum <= maxShares;
  
  const handleBuy = () => {
    if (!canBuy) {
      Alert.alert('Cannot Buy', 'You do not have enough cash for this trade.');
      return;
    }
    
    onBuy(sharesNum);
    setShares('1');
  };
  
  const handleSell = () => {
    if (!canSell) {
      Alert.alert('Cannot Sell', 'You do not have enough shares for this trade.');
      return;
    }
    
    onSell(sharesNum);
    setShares('1');
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trade {stockName} Stock</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Shares</Text>
        <TextInput
          style={styles.input}
          value={shares}
          onChangeText={setShares}
          keyboardType="numeric"
          placeholder="Enter number of shares"
        />
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Total Cost:</Text>
        <Text style={styles.infoValue}>{formatCurrency(totalCost)}</Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buyButton, !canBuy && styles.disabledButton]}
          onPress={handleBuy}
          disabled={!canBuy}
        >
          <ArrowUp size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Buy</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.sellButton, !canSell && styles.disabledButton]}
          onPress={handleSell}
          disabled={!canSell}
        >
          <ArrowDown size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Sell</Text>
        </TouchableOpacity>
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
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: Colors.light.subtext,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.light.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 16,
    color: Colors.light.subtext,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  buyButton: {
    backgroundColor: Colors.light.chart.up,
  },
  sellButton: {
    backgroundColor: Colors.light.chart.down,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  }
});

export default TradeControls;