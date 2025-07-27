import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { TrendingUp, Clock, DollarSign, ArrowUpDown, Calendar, Scissors, TrendingDown } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { PotentialProfitSequence, formatPotentialProfitSequence, PotentialLossSequence, formatPotentialLossSequence } from '@/utils/beatsPerMinute';

interface PotentialProfitProps {
  sequences: PotentialProfitSequence[];
  selectedSequence: PotentialProfitSequence | null;
  onSequenceSelect: (sequence: PotentialProfitSequence) => void;
  lossSequences: PotentialLossSequence[];
  selectedLossSequence: PotentialLossSequence | null;
  onLossSequenceSelect: (sequence: PotentialLossSequence | null) => void;
}

type FilterType = 'none' | 'intervals' | 'recent';
type ViewMode = 'profit' | 'loss';

const PotentialProfit: React.FC<PotentialProfitProps> = ({
  sequences,
  selectedSequence,
  onSequenceSelect,
  lossSequences,
  selectedLossSequence,
  onLossSequenceSelect
}) => {
  const [currentFilter, setCurrentFilter] = useState<FilterType>('none');
  const [viewMode, setViewMode] = useState<ViewMode>('profit');

  // Calculate total potential profit from all sequences
  const totalPotentialProfit = useMemo(() => {
    return sequences.reduce((sum, sequence) => sum + sequence.dollarGain, 0);
  }, [sequences]);
  
  // Calculate total potential loss from all loss sequences
  const totalPotentialLoss = useMemo(() => {
    return lossSequences.reduce((sum, sequence) => sum + sequence.dollarLoss, 0);
  }, [lossSequences]);

  const filteredAndSortedSequences = useMemo(() => {
    let result = [...sequences];
    
    switch (currentFilter) {
      case 'intervals':
        // Sort by number of intervals (least to greatest)
        result.sort((a, b) => (a.dataPoints.length - 1) - (b.dataPoints.length - 1));
        break;
      case 'recent':
        // Sort by most recent (latest end time first)
        result.sort((a, b) => b.endTime - a.endTime);
        break;
      case 'none':
      default:
        // Keep original order
        break;
    }
    
    return result;
  }, [sequences, currentFilter]);
  
  const filteredAndSortedLossSequences = useMemo(() => {
    let result = [...lossSequences];
    
    switch (currentFilter) {
      case 'recent':
        // Sort by most recent (latest after reversal time first)
        result.sort((a, b) => b.afterReversalTime - a.afterReversalTime);
        break;
      case 'none':
      default:
        // Keep original order
        break;
    }
    
    return result;
  }, [lossSequences, currentFilter]);

  const handleFilterToggle = (filterType: FilterType) => {
    if (currentFilter === filterType) {
      setCurrentFilter('none'); // Toggle off if already active
    } else {
      setCurrentFilter(filterType);
    }
  };

  const renderSequenceItem = ({ item }: { item: PotentialProfitSequence }) => {
    const formatted = formatPotentialProfitSequence(item);
    const isSelected = selectedSequence?.id === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.sequenceItem,
          isSelected && styles.selectedSequenceItem
        ]}
        onPress={() => onSequenceSelect(item)}
      >
        <View style={styles.sequenceHeader}>
          <View style={styles.sequenceInfo}>
            <View style={styles.timeContainer}>
              <Clock size={14} color={Colors.light.primary} />
              <Text style={styles.timeText}>{formatted.timeRange}</Text>
            </View>
            <Text style={styles.priceRange}>{formatted.priceRange}</Text>
          </View>
          
          <View style={styles.gainContainer}>
            <Text style={[
              styles.dollarGain,
              { color: item.dollarGain > 0 ? Colors.light.chart.up : Colors.light.chart.down }
            ]}>
              {formatted.gain}
            </Text>
            <Text style={[
              styles.percentageGain,
              { color: item.percentageChange > 0 ? Colors.light.chart.up : Colors.light.chart.down }
            ]}>
              {formatted.percentage}
            </Text>
          </View>
        </View>
        
        <View style={styles.sequenceStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>
              {Math.round((item.endTime - item.startTime) / 60000)}m
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Intervals</Text>
            <Text style={styles.statValue}>
              {item.dataPoints.length - 1}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Excluded</Text>
            <Text style={styles.statValue}>
              {item.excludedBeats} beats
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Avg/Interval</Text>
            <Text style={[
              styles.statValue,
              { color: item.dollarGain > 0 ? Colors.light.chart.up : Colors.light.chart.down }
            ]}>
              {formatCurrency(item.dollarGain / (item.dataPoints.length - 1))}
            </Text>
          </View>
        </View>
        
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedText}>Highlighted on chart</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderLossSequenceItem = ({ item }: { item: PotentialLossSequence }) => {
    const formatted = formatPotentialLossSequence(item);
    const isSelected = selectedLossSequence?.id === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.sequenceItem,
          isSelected && styles.selectedSequenceItem
        ]}
        onPress={() => {
          if (isSelected) {
            onLossSequenceSelect(null);
          } else {
            onLossSequenceSelect(item);
          }
        }}
      >
        <View style={styles.sequenceHeader}>
          <View style={styles.sequenceInfo}>
            <View style={styles.timeContainer}>
              <Clock size={14} color={Colors.light.primary} />
              <Text style={styles.timeText}>{formatted.timeRange}</Text>
            </View>
            <Text style={styles.priceRange}>{formatted.priceRange}</Text>
          </View>
          
          <View style={styles.gainContainer}>
            <Text style={[
              styles.dollarGain,
              { color: Colors.light.chart.down }
            ]}>
              {formatted.loss}
            </Text>
            <Text style={[
              styles.percentageGain,
              { color: Colors.light.chart.down }
            ]}>
              {formatted.percentage}
            </Text>
          </View>
        </View>
        
        <View style={styles.sequenceStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>
              {Math.round((item.afterReversalTime - item.beforeReversalTime) / 60000)}m
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Pattern</Text>
            <Text style={styles.statValue}>
              Down → Up → Down
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Before</Text>
            <Text style={styles.statValue}>
              {formatCurrency(item.beforeReversalPrice)}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Peak</Text>
            <Text style={[
              styles.statValue,
              { color: Colors.light.chart.up }
            ]}>
              {formatCurrency(item.reversalPrice)}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>After</Text>
            <Text style={[
              styles.statValue,
              { color: Colors.light.chart.down }
            ]}>
              {formatCurrency(item.afterReversalPrice)}
            </Text>
          </View>
        </View>
        
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedText}>Highlighted on chart</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      {viewMode === 'profit' ? (
        <>
          <TrendingUp size={32} color={Colors.light.subtext} />
          <Text style={styles.emptyText}>No potential profit sequences found</Text>
          <Text style={styles.emptySubtext}>
            Potential profit sequences require beat sequences with at least 3 data points
          </Text>
        </>
      ) : (
        <>
          <TrendingDown size={32} color={Colors.light.subtext} />
          <Text style={styles.emptyText}>No potential loss sequences found</Text>
          <Text style={styles.emptySubtext}>
            Potential loss sequences require down-up-down price patterns
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {viewMode === 'profit' ? (
            <TrendingUp size={20} color={Colors.light.primary} />
          ) : (
            <TrendingDown size={20} color={Colors.light.chart.down} />
          )}
          <Text style={styles.title}>
            {viewMode === 'profit' ? 'Potential Profit' : 'Potential Losses'}
          </Text>
        </View>
        
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {viewMode === 'profit' ? sequences.length : lossSequences.length} sequences
          </Text>
        </View>
      </View>
      
      {/* View Mode Toggle */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === 'profit' && styles.activeViewModeButton
          ]}
          onPress={() => {
            setViewMode('profit');
            setCurrentFilter('none');
          }}
        >
          <TrendingUp size={16} color={viewMode === 'profit' ? '#FFFFFF' : Colors.light.chart.up} />
          <Text style={[
            styles.viewModeButtonText,
            viewMode === 'profit' && styles.activeViewModeButtonText
          ]}>
            Potential Profit
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === 'loss' && styles.activeViewModeButton
          ]}
          onPress={() => {
            setViewMode('loss');
            setCurrentFilter('none');
          }}
        >
          <TrendingDown size={16} color={viewMode === 'loss' ? '#FFFFFF' : Colors.light.chart.down} />
          <Text style={[
            styles.viewModeButtonText,
            viewMode === 'loss' && styles.activeViewModeButtonText
          ]}>
            Potential Losses
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Total Display */}
      {viewMode === 'profit' && sequences.length > 0 && (
        <View style={styles.totalProfitContainer}>
          <View style={styles.totalProfitHeader}>
            <DollarSign size={18} color={totalPotentialProfit >= 0 ? Colors.light.chart.up : Colors.light.chart.down} />
            <Text style={styles.totalProfitLabel}>Total Potential Profit</Text>
          </View>
          <Text style={[
            styles.totalProfitValue,
            { color: totalPotentialProfit >= 0 ? Colors.light.chart.up : Colors.light.chart.down }
          ]}>
            {totalPotentialProfit >= 0 ? '+' : ''}{formatCurrency(totalPotentialProfit)}
          </Text>
        </View>
      )}
      
      {viewMode === 'loss' && lossSequences.length > 0 && (
        <View style={styles.totalProfitContainer}>
          <View style={styles.totalProfitHeader}>
            <DollarSign size={18} color={Colors.light.chart.down} />
            <Text style={styles.totalProfitLabel}>Total Potential Loss</Text>
          </View>
          <Text style={[
            styles.totalProfitValue,
            { color: Colors.light.chart.down }
          ]}>
            -{formatCurrency(totalPotentialLoss)}
          </Text>
        </View>
      )}
      
      <View style={styles.descriptionContainer}>
        <View style={styles.descriptionHeader}>
          {viewMode === 'profit' ? (
            <>
              <Scissors size={16} color={Colors.light.primary} />
              <Text style={styles.descriptionTitle}>Excludes First & Last Beat</Text>
            </>
          ) : (
            <>
              <TrendingDown size={16} color={Colors.light.chart.down} />
              <Text style={styles.descriptionTitle}>Down-Up-Down Pattern Detection</Text>
            </>
          )}
        </View>
        <Text style={styles.description}>
          {viewMode === 'profit' 
            ? 'Shows potential profit by excluding entry and exit beats from each sequence. Tap to highlight the trimmed sequence on chart.'
            : 'Shows sequences where price goes down, then up (reversal), then immediately down again. Each entry shows the three price points and the loss from peak to final drop.'
          }
        </Text>
      </View>
      
      {/* Filter Buttons */}
      {((viewMode === 'profit' && sequences.length > 0) || (viewMode === 'loss' && lossSequences.length > 0)) && (
        <View style={styles.filterContainer}>
          {viewMode === 'profit' && (
            <TouchableOpacity
              style={[
                styles.filterButton,
                currentFilter === 'intervals' && styles.activeFilterButton
              ]}
              onPress={() => handleFilterToggle('intervals')}
            >
              <ArrowUpDown size={16} color={currentFilter === 'intervals' ? '#FFFFFF' : Colors.light.primary} />
              <Text style={[
                styles.filterButtonText,
                currentFilter === 'intervals' && styles.activeFilterButtonText
              ]}>
                Intervals
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.filterButton,
              currentFilter === 'recent' && styles.activeFilterButton
            ]}
            onPress={() => handleFilterToggle('recent')}
          >
            <Calendar size={16} color={currentFilter === 'recent' ? '#FFFFFF' : Colors.light.primary} />
            <Text style={[
              styles.filterButtonText,
              currentFilter === 'recent' && styles.activeFilterButtonText
            ]}>
              Most Recent
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {viewMode === 'profit' ? (
        <FlatList<PotentialProfitSequence>
          data={filteredAndSortedSequences}
          keyExtractor={(item) => item.id}
          renderItem={renderSequenceItem}
          ListEmptyComponent={renderEmptyList}
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          style={styles.sequencesList}
          contentContainerStyle={styles.sequencesListContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <FlatList<PotentialLossSequence>
          data={filteredAndSortedLossSequences}
          keyExtractor={(item) => item.id}
          renderItem={renderLossSequenceItem}
          ListEmptyComponent={renderEmptyList}
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          style={styles.sequencesList}
          contentContainerStyle={styles.sequencesListContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
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
  countContainer: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  descriptionContainer: {
    backgroundColor: Colors.light.background,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  descriptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 6,
  },
  description: {
    fontSize: 14,
    color: Colors.light.subtext,
    lineHeight: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.background,
  },
  activeFilterButton: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: Colors.light.primary,
    marginLeft: 6,
    fontWeight: '600',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
  },
  sequencesList: {
    maxHeight: 400,
  },
  sequencesListContent: {
    paddingBottom: 16,
  },
  sequenceItem: {
    padding: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 4,
  },
  selectedSequenceItem: {
    backgroundColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sequenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sequenceInfo: {
    flex: 1,
    marginRight: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: Colors.light.primary,
    marginLeft: 6,
    fontWeight: '600',
  },
  priceRange: {
    fontSize: 14,
    color: Colors.light.subtext,
  },
  gainContainer: {
    alignItems: 'flex-end',
  },
  dollarGain: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  percentageGain: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  sequenceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    padding: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.subtext,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  selectedIndicator: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 4,
  },
  selectedText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    opacity: 0.9,
  },
  separator: {
    height: 8,
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
    lineHeight: 20,
  },
  totalProfitContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  totalProfitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalProfitLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginLeft: 8,
  },
  totalProfitValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.background,
    flex: 1,
    justifyContent: 'center',
  },
  activeViewModeButton: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  viewModeButtonText: {
    fontSize: 14,
    color: Colors.light.primary,
    marginLeft: 6,
    fontWeight: '600',
  },
  activeViewModeButtonText: {
    color: '#FFFFFF',
  },
});

export default PotentialProfit;