import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity } from 'react-native';
import { Settings } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { TradingSettings } from '@/types/stock';

interface AutomatedTradingSettingsProps {
  settings: TradingSettings & {
    tradingMethod?: 'trend_reversal' | 'direction_change_reference' | 'confirmed_recovery' | 'price_comparison' | 'slope_analysis';
    dollarDropThreshold?: number;
    // Enhanced Dollar Drop settings
    dollarDropEnabled?: boolean;
    profitTakingEnabled?: boolean;
    profitTakingPercentage?: number;
    profitTakingDollarAmount?: number;
    dollarDropTriggerAmount?: number;
    sellAtBuyPriceEnabled?: boolean;
    consecutiveFallsEnabled?: boolean;
    consecutiveFallsCount?: number;
    // Enhanced Dollar Drop Protection with timing delays
    enhancedDropProtectionEnabled?: boolean;
    firstDelaySeconds?: number;
    secondDelaySeconds?: number;
    // Confirmed Recovery settings
    confirmedRecoveryFirstDelay?: number;
    confirmedRecoverySecondDelay?: number;
  };
  onUpdate: (settings: Partial<TradingSettings & {
    tradingMethod?: 'trend_reversal' | 'direction_change_reference' | 'confirmed_recovery' | 'price_comparison' | 'slope_analysis';
    dollarDropThreshold?: number;
    // Enhanced Dollar Drop settings
    dollarDropEnabled?: boolean;
    profitTakingEnabled?: boolean;
    profitTakingPercentage?: number;
    profitTakingDollarAmount?: number;
    dollarDropTriggerAmount?: number;
    sellAtBuyPriceEnabled?: boolean;
    consecutiveFallsEnabled?: boolean;
    consecutiveFallsCount?: number;
    // Enhanced Dollar Drop Protection with timing delays
    enhancedDropProtectionEnabled?: boolean;
    firstDelaySeconds?: number;
    secondDelaySeconds?: number;
    // Confirmed Recovery settings
    confirmedRecoveryFirstDelay?: number;
    confirmedRecoverySecondDelay?: number;
  }>) => void;
}

const AutomatedTradingSettings: React.FC<AutomatedTradingSettingsProps> = ({
  settings,
  onUpdate
}) => {
  const [expanded, setExpanded] = useState(false);
  const [maxInvestment, setMaxInvestment] = useState(settings.maxInvestmentPerTrade.toString());
  const [dollarDropThreshold, setDollarDropThreshold] = useState((settings.dollarDropThreshold || 5).toString());
  const [profitTakingPercentage, setProfitTakingPercentage] = useState((settings.profitTakingPercentage || 10).toString());
  const [profitTakingDollarAmount, setProfitTakingDollarAmount] = useState((settings.profitTakingDollarAmount || 0).toString());
  const [dollarDropTriggerAmount, setDollarDropTriggerAmount] = useState((settings.dollarDropTriggerAmount || 0.10).toString());
  const [consecutiveFallsCount, setConsecutiveFallsCount] = useState((settings.consecutiveFallsCount || 3).toString());
  const [firstDelaySeconds, setFirstDelaySeconds] = useState((settings.firstDelaySeconds || 15).toString());
  const [secondDelaySeconds, setSecondDelaySeconds] = useState((settings.secondDelaySeconds || 30).toString());
  const [confirmedRecoveryFirstDelay, setConfirmedRecoveryFirstDelay] = useState((settings.confirmedRecoveryFirstDelay || 15).toString());
  const [confirmedRecoverySecondDelay, setConfirmedRecoverySecondDelay] = useState((settings.confirmedRecoverySecondDelay || 30).toString());
  
  const handleToggle = (value: boolean) => {
    onUpdate({ enabled: value });
  };
  
  const handleInvestmentTypeToggle = (type: 'dollars' | 'shares') => {
    onUpdate({ investmentType: type });
  };
  
  const handleSave = () => {
    const updates: any = {
      maxInvestmentPerTrade: parseFloat(maxInvestment) || (settings.investmentType === 'dollars' ? 2000 : 10)
    };
    
    if (settings.tradingMethod === 'direction_change_reference') {
      updates.dollarDropThreshold = parseFloat(dollarDropThreshold) || 5;
    }
    
    // Enhanced Dollar Drop settings
    if (settings.dollarDropEnabled) {
      updates.profitTakingPercentage = parseFloat(profitTakingPercentage) || 10;
      updates.profitTakingDollarAmount = parseFloat(profitTakingDollarAmount) || 0;
      updates.dollarDropTriggerAmount = parseFloat(dollarDropTriggerAmount) || 0.10;
      updates.consecutiveFallsCount = parseInt(consecutiveFallsCount) || 3;
    }
    
    if (settings.enhancedDropProtectionEnabled) {
      updates.firstDelaySeconds = parseInt(firstDelaySeconds) || 15;
      updates.secondDelaySeconds = parseInt(secondDelaySeconds) || 30;
    }
    
    if (settings.tradingMethod === 'confirmed_recovery') {
      updates.confirmedRecoveryFirstDelay = parseInt(confirmedRecoveryFirstDelay) || 15;
      updates.confirmedRecoverySecondDelay = parseInt(confirmedRecoverySecondDelay) || 30;
    }
    
    onUpdate(updates);
    setExpanded(false);
  };
  
  const handleTradingMethodChange = (method: 'trend_reversal' | 'direction_change_reference' | 'confirmed_recovery' | 'price_comparison' | 'slope_analysis') => {
    onUpdate({ tradingMethod: method });
  };
  
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.header} 
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.titleContainer}>
          <Settings size={20} color={Colors.light.primary} />
          <Text style={styles.title}>Bot Trading</Text>
        </View>
        
        <Switch
          value={settings.enabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#E5E9F0', true: Colors.light.primary }}
          thumbColor="#FFFFFF"
        />
      </TouchableOpacity>
      
      <View style={styles.description}>
        <Text style={styles.descriptionText}>
          🤖 Bot trading strategy:
        </Text>
        {settings.tradingMethod === 'direction_change_reference' ? (
          <>
            <Text style={styles.descriptionBullet}>• BUY when current price {'>'} last direction-change point</Text>
            <Text style={styles.descriptionBullet}>• SELL when price drops by set dollar amount from buy price</Text>
          </>
        ) : settings.tradingMethod === 'confirmed_recovery' ? (
          <>
            <Text style={styles.descriptionBullet}>• BUY after confirming upward recovery from downtrend</Text>
            <Text style={styles.descriptionBullet}>• Wait 15s + 30s to confirm two positive beats after downtrend</Text>
            <Text style={styles.descriptionBullet}>• SELL when trend changes from UP to DOWN</Text>
          </>
        ) : settings.tradingMethod === 'price_comparison' ? (
          <>
            <Text style={styles.descriptionBullet}>• BUY when current price {'>'} previous interval price</Text>
            <Text style={styles.descriptionBullet}>• SELL when current price {'<'} previous interval price</Text>
          </>
        ) : settings.tradingMethod === 'slope_analysis' ? (
          <>
            <Text style={styles.descriptionBullet}>• BUY when slope between last 2 intervals is positive (rising)</Text>
            <Text style={styles.descriptionBullet}>• SELL when slope between last 2 intervals is negative (falling)</Text>
          </>
        ) : (
          <>
            <Text style={styles.descriptionBullet}>• BUY when trend changes from DOWN to UP</Text>
            <Text style={styles.descriptionBullet}>• SELL when trend changes from UP to DOWN</Text>
          </>
        )}
        {settings.dollarDropEnabled && (
          <Text style={styles.descriptionBullet}>• Enhanced Dollar Drop protection enabled</Text>
        )}
        {settings.enhancedDropProtectionEnabled && (
          <Text style={styles.descriptionBullet}>• Enhanced Drop Protection with timing delays enabled</Text>
        )}
      </View>
      
      {expanded && (
        <View style={styles.content}>
          <Text style={styles.sectionLabel}>Trading Method</Text>
          
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Strategy</Text>
            <View style={styles.fiveToggleButtons}>
              <TouchableOpacity
                style={[
                  styles.fiveToggleButton,
                  (settings.tradingMethod || 'trend_reversal') === 'trend_reversal' && styles.activeToggleButton
                ]}
                onPress={() => handleTradingMethodChange('trend_reversal')}
              >
                <Text style={[
                  styles.fiveToggleButtonText,
                  (settings.tradingMethod || 'trend_reversal') === 'trend_reversal' && styles.activeToggleButtonText
                ]}>
                  Trend
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.fiveToggleButton,
                  settings.tradingMethod === 'direction_change_reference' && styles.activeToggleButton
                ]}
                onPress={() => handleTradingMethodChange('direction_change_reference')}
              >
                <Text style={[
                  styles.fiveToggleButtonText,
                  settings.tradingMethod === 'direction_change_reference' && styles.activeToggleButtonText
                ]}>
                  Dir Ref
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.fiveToggleButton,
                  settings.tradingMethod === 'confirmed_recovery' && styles.activeToggleButton
                ]}
                onPress={() => handleTradingMethodChange('confirmed_recovery')}
              >
                <Text style={[
                  styles.fiveToggleButtonText,
                  settings.tradingMethod === 'confirmed_recovery' && styles.activeToggleButtonText
                ]}>
                  Recovery
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.fiveToggleButton,
                  settings.tradingMethod === 'price_comparison' && styles.activeToggleButton
                ]}
                onPress={() => handleTradingMethodChange('price_comparison')}
              >
                <Text style={[
                  styles.fiveToggleButtonText,
                  settings.tradingMethod === 'price_comparison' && styles.activeToggleButtonText
                ]}>
                  Price
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.fiveToggleButton,
                  settings.tradingMethod === 'slope_analysis' && styles.activeToggleButton
                ]}
                onPress={() => handleTradingMethodChange('slope_analysis')}
              >
                <Text style={[
                  styles.fiveToggleButtonText,
                  settings.tradingMethod === 'slope_analysis' && styles.activeToggleButtonText
                ]}>
                  Slope
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.sectionLabel}>Trade Settings</Text>
          
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Investment Type</Text>
            <View style={styles.toggleButtons}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  settings.investmentType === 'dollars' && styles.activeToggleButton
                ]}
                onPress={() => handleInvestmentTypeToggle('dollars')}
              >
                <Text style={[
                  styles.toggleButtonText,
                  settings.investmentType === 'dollars' && styles.activeToggleButtonText
                ]}>
                  Dollars
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  settings.investmentType === 'shares' && styles.activeToggleButton
                ]}
                onPress={() => handleInvestmentTypeToggle('shares')}
              >
                <Text style={[
                  styles.toggleButtonText,
                  settings.investmentType === 'shares' && styles.activeToggleButtonText
                ]}>
                  Shares
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.inputRow}>
            <Text style={styles.label}>
              Maximum {settings.investmentType === 'dollars' ? 'investment' : 'shares'} per trade
            </Text>
            <View style={styles.inputContainer}>
              {settings.investmentType === 'dollars' && <Text style={styles.unit}>$</Text>}
              <TextInput
                style={styles.input}
                value={maxInvestment}
                onChangeText={setMaxInvestment}
                keyboardType="numeric"
                placeholder={settings.investmentType === 'dollars' ? '2000' : '10'}
              />
              {settings.investmentType === 'shares' && <Text style={styles.unit}>shares</Text>}
            </View>
          </View>
          
          {settings.tradingMethod === 'direction_change_reference' && (
            <View style={styles.inputRow}>
              <Text style={styles.label}>
                Dollar drop threshold for selling
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
          
          {settings.tradingMethod === 'confirmed_recovery' && (
            <>
              <Text style={styles.sectionLabel}>Confirmed Recovery Settings</Text>
              
              <View style={styles.inputRow}>
                <Text style={styles.label}>First delay (seconds)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={confirmedRecoveryFirstDelay}
                    onChangeText={setConfirmedRecoveryFirstDelay}
                    keyboardType="numeric"
                    placeholder="15"
                  />
                  <Text style={styles.unit}>s</Text>
                </View>
              </View>
              
              <View style={styles.inputRow}>
                <Text style={styles.label}>Second delay (seconds)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={confirmedRecoverySecondDelay}
                    onChangeText={setConfirmedRecoverySecondDelay}
                    keyboardType="numeric"
                    placeholder="30"
                  />
                </View>
              </View>
              
              <View style={styles.enhancedProtectionDescription}>
                <Text style={styles.enhancedProtectionText}>
                  🔄 Confirmed Recovery Logic:
                </Text>
                <Text style={styles.enhancedProtectionBullet}>
                  • Wait for last interval to be in downward direction
                </Text>
                <Text style={styles.enhancedProtectionBullet}>
                  • Wait {confirmedRecoveryFirstDelay || '15'}s and check if price is still going down
                </Text>
                <Text style={styles.enhancedProtectionBullet}>
                  • Wait another {confirmedRecoverySecondDelay || '30'}s and check if price is now going up
                </Text>
                <Text style={styles.enhancedProtectionBullet}>
                  • If both follow-up checks show upward movement, trigger BUY
                </Text>
              </View>
            </>
          )}
          
          <Text style={styles.sectionLabel}>Enhanced Dollar Drop Settings</Text>
          
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Apply Dollar Drop across all methods</Text>
            <Switch
              value={settings.dollarDropEnabled || false}
              onValueChange={(value) => onUpdate({ dollarDropEnabled: value })}
              trackColor={{ false: '#E5E9F0', true: Colors.light.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          
          {settings.dollarDropEnabled && (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Profit taking with drop trigger</Text>
                <Switch
                  value={settings.profitTakingEnabled || false}
                  onValueChange={(value) => onUpdate({ profitTakingEnabled: value })}
                  trackColor={{ false: '#E5E9F0', true: Colors.light.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              
              {settings.profitTakingEnabled && (
                <>
                  <View style={styles.inputRow}>
                    <Text style={styles.label}>Profit percentage threshold</Text>
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
                  
                  <View style={styles.inputRow}>
                    <Text style={styles.label}>Profit dollar threshold (optional)</Text>
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
                  
                  <View style={styles.inputRow}>
                    <Text style={styles.label}>Price drop trigger amount</Text>
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
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Sell at/below buy price</Text>
                <Switch
                  value={settings.sellAtBuyPriceEnabled || false}
                  onValueChange={(value) => onUpdate({ sellAtBuyPriceEnabled: value })}
                  trackColor={{ false: '#E5E9F0', true: Colors.light.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Sell after consecutive falls</Text>
                <Switch
                  value={settings.consecutiveFallsEnabled || false}
                  onValueChange={(value) => onUpdate({ consecutiveFallsEnabled: value })}
                  trackColor={{ false: '#E5E9F0', true: Colors.light.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              
              {settings.consecutiveFallsEnabled && (
                <View style={styles.inputRow}>
                  <Text style={styles.label}>Number of consecutive falls</Text>
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
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enhanced Drop Protection</Text>
                <Switch
                  value={settings.enhancedDropProtectionEnabled || false}
                  onValueChange={(value) => onUpdate({ enhancedDropProtectionEnabled: value })}
                  trackColor={{ false: '#E5E9F0', true: Colors.light.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              
              {settings.enhancedDropProtectionEnabled && (
                <>
                  <View style={styles.inputRow}>
                    <Text style={styles.label}>First delay (seconds)</Text>
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
                  
                  <View style={styles.inputRow}>
                    <Text style={styles.label}>Second delay (seconds)</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        value={secondDelaySeconds}
                        onChangeText={setSecondDelaySeconds}
                        keyboardType="numeric"
                        placeholder="30"
                      />
                      <Text style={styles.unit}>s</Text>
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
          
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </TouchableOpacity>
        </View>
      )}
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
  description: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  descriptionBullet: {
    fontSize: 14,
    color: Colors.light.subtext,
    marginLeft: 8,
    marginBottom: 4,
  },
  content: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 8,
    marginBottom: 12,
  },
  toggleContainer: {
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 16,
    color: Colors.light.subtext,
    marginBottom: 8,
  },
  toggleButtons: {
    flexDirection: 'row',
    backgroundColor: Colors.light.border,
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  threeToggleButtons: {
    flexDirection: 'row',
    backgroundColor: Colors.light.border,
    borderRadius: 8,
    padding: 2,
  },
  threeToggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  threeToggleButtonText: {
    fontSize: 12,
    color: Colors.light.subtext,
    fontWeight: '500',
    textAlign: 'center',
  },
  fourToggleButtons: {
    flexDirection: 'row',
    backgroundColor: Colors.light.border,
    borderRadius: 8,
    padding: 2,
  },
  fourToggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  fourToggleButtonText: {
    fontSize: 10,
    color: Colors.light.subtext,
    fontWeight: '500',
    textAlign: 'center',
  },
  fiveToggleButtons: {
    flexDirection: 'row',
    backgroundColor: Colors.light.border,
    borderRadius: 8,
    padding: 2,
  },
  fiveToggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  fiveToggleButtonText: {
    fontSize: 9,
    color: Colors.light.subtext,
    fontWeight: '500',
    textAlign: 'center',
  },
  sixToggleButtons: {
    flexDirection: 'row',
    backgroundColor: Colors.light.border,
    borderRadius: 8,
    padding: 2,
  },
  sixToggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  sixToggleButtonText: {
    fontSize: 8,
    color: Colors.light.subtext,
    fontWeight: '500',
    textAlign: 'center',
  },
  activeToggleButton: {
    backgroundColor: Colors.light.primary,
  },
  toggleButtonText: {
    fontSize: 14,
    color: Colors.light.subtext,
    fontWeight: '500',
  },
  activeToggleButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: Colors.light.subtext,
    flex: 1,
    marginRight: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    width: 120,
  },
  input: {
    padding: 8,
    fontSize: 16,
    color: Colors.light.text,
    flex: 1,
  },
  unit: {
    fontSize: 16,
    color: Colors.light.subtext,
  },
  saveButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: Colors.light.subtext,
    flex: 1,
    marginRight: 8,
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

export default AutomatedTradingSettings;