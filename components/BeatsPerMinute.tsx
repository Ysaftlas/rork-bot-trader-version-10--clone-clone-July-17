import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Activity, Clock, DollarSign, ArrowUpDown, Calendar, Settings } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { BeatSequence, formatBeatSequence } from '@/utils/beatsPerMinute';

interface BeatsPerMinuteProps {
  sequences: BeatSequence[];
  selectedSequence: BeatSequence | null;
  onSequenceSelect: (sequence: BeatSequence) => void;
  minConsecutiveIntervals: number;
  onMinConsecutiveIntervalsChange: (value: number) => void;
}

type FilterType = 'none' | 'intervals' | 'recent';

const BeatsPerMinute: React.FC<BeatsPerMinuteProps> = ({
  sequences,
  selectedSequence,
  onSequenceSelect,
  minConsecutiveIntervals,
  onMinConsecutiveIntervalsChange
}) => {
  const [currentFilter, setCurrentFilter] = useState<FilterType>('none');

  // Apply filtering and sorting
  // Calculate total profit from all sequences
  const totalProfit = useMemo(() => {
    return sequences.reduce((sum, sequence) => sum + sequence.dollarGain, 0);
  }, [sequences]);

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

  const handleFilterToggle = (filterType: FilterType) => {
    if (currentFilter === filterType) {
      setCurrentFilter('none'); // Toggle off if already active
    } else {
      setCurrentFilter(filterType);
    }
  };

  const renderSequenceItem = ({ item }: { item: BeatSequence }) => {
    const formatted = formatBeatSequence(item);
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

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Activity size={32} color={Colors.light.subtext} />
      <Text style={styles.emptyText}>No beat sequences found</Text>
      <Text style={styles.emptySubtext}>
        Beat sequences require {minConsecutiveIntervals}+ consecutive positive price intervals
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Activity size={20} color={Colors.light.primary} />
          <Text style={styles.title}>Beats per Minute</Text>
        </View>
        
        <View style={styles.countContainer}>
          <Text style={styles.countText}>{sequences.length} sequences</Text>
        </View>
      </View>
      
      {/* Total Profit Display */}
      {sequences.length > 0 && (
        <View style={styles.totalProfitContainer}>
          <View style={styles.totalProfitHeader}>
            <DollarSign size={18} color={totalProfit >= 0 ? Colors.light.chart.up : Colors.light.chart.down} />
            <Text style={styles.totalProfitLabel}>Total Profit</Text>
          </View>
          <Text style={[
            styles.totalProfitValue,
            { color: totalProfit >= 0 ? Colors.light.chart.up : Colors.light.chart.down }
          ]}>
            {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
          </Text>
        </View>
      )}
      
      <Text style={styles.description}>
        Sequences of {minConsecutiveIntervals}+ consecutive positive price intervals. Tap to highlight on chart.
      </Text>
      
      {/* Minimum Intervals Control */}
      <View style={styles.controlContainer}>
        <View style={styles.controlHeader}>
          <Settings size={16} color={Colors.light.primary} />
          <Text style={styles.controlLabel}>Min Consecutive Intervals</Text>
        </View>
        <View style={styles.intervalButtons}>
          {[2, 3, 4, 5, 6, 7].map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.intervalButton,
                minConsecutiveIntervals === value && styles.activeIntervalButton
              ]}
              onPress={() => onMinConsecutiveIntervalsChange(value)}
            >
              <Text style={[
                styles.intervalButtonText,
                minConsecutiveIntervals === value && styles.activeIntervalButtonText
              ]}>
                {value === 2 ? '2 Mini' : value.toString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Filter Buttons */}
      {sequences.length > 0 && (
        <View style={styles.filterContainer}>
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
      
      <FlatList
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
  description: {
    fontSize: 14,
    color: Colors.light.subtext,
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    maxHeight: 400, // Increased height for better scrolling
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
  controlContainer: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 6,
  },
  intervalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  intervalButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.card,
    alignItems: 'center',
  },
  activeIntervalButton: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  intervalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  activeIntervalButtonText: {
    color: '#FFFFFF',
  },
});

export default BeatsPerMinute;