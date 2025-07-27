import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput } from 'react-native';
import { RefreshCw, RotateCcw, Info, Key, CheckCircle, XCircle, Loader } from 'lucide-react-native';
import { useStockStore } from '@/store/stockStore';
import Colors from '@/constants/colors';

export default function SettingsScreen() {
  const {
    selectedStock,
    tradingSettings,
    updateTradingSettings,
    resetPortfolio,
    fetchStockData,
    apiCredentials,
    setApiCredentials,
    apiConnectionStatus,
    testApiConnection
  } = useStockStore();
  
  const [apiKey, setApiKey] = useState(apiCredentials.apiKey);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  const handleResetPortfolio = () => {
    Alert.alert(
      'Reset Portfolio',
      'Are you sure you want to reset your portfolio? This will clear all your trades and set your cash back to $10,000.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetPortfolio();
            Alert.alert('Success', 'Your portfolio has been reset.');
          }
        }
      ]
    );
  };
  
  const handleRefreshData = async () => {
    try {
      await fetchStockData();
      Alert.alert('Success', `${selectedStock.name} stock data has been refreshed from TwelveData.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh data. Please check your API key and connection.');
    }
  };
  
  const handleSaveApiCredentials = () => {
    setApiCredentials(apiKey);
    Alert.alert('Success', 'API credentials have been saved.');
  };
  
  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter your TwelveData API key first.');
      return;
    }
    
    setIsTestingConnection(true);
    
    // Save the API key first
    setApiCredentials(apiKey);
    
    try {
      const isConnected = await testApiConnection();
      
      if (isConnected) {
        Alert.alert('Success', 'Successfully connected to TwelveData API for stock data!');
      } else {
        Alert.alert('Error', 'Failed to connect to TwelveData API. Please check your API key.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to test connection. Please try again.');
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  const getConnectionStatusIcon = () => {
    switch (apiConnectionStatus) {
      case 'connected':
        return <CheckCircle size={20} color={Colors.light.chart.up} />;
      case 'testing':
        return <Loader size={20} color={Colors.light.primary} />;
      case 'disconnected':
      default:
        return <XCircle size={20} color={Colors.light.chart.down} />;
    }
  };
  
  const getConnectionStatusText = () => {
    switch (apiConnectionStatus) {
      case 'connected':
        return 'Connected to TwelveData';
      case 'testing':
        return 'Testing connection...';
      case 'disconnected':
      default:
        return 'Disconnected from TwelveData';
    }
  };
  
  const getConnectionStatusColor = () => {
    switch (apiConnectionStatus) {
      case 'connected':
        return Colors.light.chart.up;
      case 'testing':
        return Colors.light.primary;
      case 'disconnected':
      default:
        return Colors.light.chart.down;
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TwelveData API Settings</Text>
        
        <View style={styles.connectionStatus}>
          {getConnectionStatusIcon()}
          <Text style={[styles.connectionText, { color: getConnectionStatusColor() }]}>
            {getConnectionStatusText()}
          </Text>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>API Key</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="Enter your TwelveData API key"
            secureTextEntry={false}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.testButton]} 
            onPress={handleTestConnection}
            disabled={isTestingConnection}
          >
            {isTestingConnection ? (
              <Loader size={20} color="#FFFFFF" />
            ) : (
              <CheckCircle size={20} color="#FFFFFF" />
            )}
            <Text style={styles.testButtonText}>
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={handleSaveApiCredentials}>
            <Key size={20} color={Colors.light.primary} />
            <Text style={styles.buttonText}>Save API Key</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.apiNote}>
          Get your free API key at twelvedata.com. This app ONLY uses real stock data from TwelveData - no simulated data.
        </Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        
        <TouchableOpacity style={styles.button} onPress={handleRefreshData}>
          <RefreshCw size={20} color={Colors.light.primary} />
          <Text style={styles.buttonText}>Refresh {selectedStock.name} Data</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity style={styles.dangerButton} onPress={handleResetPortfolio}>
          <RotateCcw size={20} color={Colors.light.danger} />
          <Text style={styles.dangerButtonText}>Reset Portfolio</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.infoContainer}>
        <Info size={20} color={Colors.light.subtext} />
        <Text style={styles.infoText}>
          This app uses ONLY real stock data from TwelveData API. No simulated or fake data is ever shown. This is a simulation app - no real money is at risk.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 8,
  },
  connectionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    color: Colors.light.text,
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  testButton: {
    backgroundColor: Colors.light.primary,
  },
  buttonText: {
    fontSize: 16,
    color: Colors.light.primary,
    marginLeft: 12,
  },
  testButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
  },
  dangerButtonText: {
    fontSize: 16,
    color: Colors.light.danger,
    marginLeft: 12,
  },
  infoContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    margin: 16,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.subtext,
    marginLeft: 12,
    flex: 1,
  },
  apiNote: {
    fontSize: 14,
    color: Colors.light.subtext,
    marginTop: 8,
    fontStyle: 'italic',
  }
});