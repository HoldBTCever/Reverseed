import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Transaction, TransactionType} from '../types';

interface Props {
  transaction: Transaction;
  onPress?: () => void;
  onLongPress?: () => void;
}

function typeLabel(type: TransactionType): string {
  switch (type) {
    case 'credit':
      return 'Crédito';
    case 'debit':
      return 'Débito';
    case 'pix':
      return 'Pix';
    default:
      return 'Transação';
  }
}

function typeColor(type: TransactionType): string {
  switch (type) {
    case 'credit':
      return '#E53935';
    case 'debit':
      return '#FB8C00';
    case 'pix':
      return '#43A047';
    default:
      return '#607D8B';
  }
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hour}:${min}`;
}

export default function TransactionCard({
  transaction,
  onPress,
  onLongPress,
}: Props) {
  const color = typeColor(transaction.type);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}>
      <View
        style={[styles.cardBadge, {backgroundColor: transaction.cardColor}]}>
        <Text style={styles.cardBadgeText}>
          {transaction.cardName.substring(0, 2).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.description} numberOfLines={1}>
          {transaction.description}
        </Text>
        <Text style={styles.card}>{transaction.cardName}</Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.amount}>{formatAmount(transaction.amount)}</Text>
        <View style={styles.meta}>
          <View style={[styles.typeBadge, {backgroundColor: color + '22'}]}>
            <Text style={[styles.typeText, {color}]}>
              {typeLabel(transaction.type)}
            </Text>
          </View>
          {transaction.synced ? (
            <Text style={styles.syncedIcon}>✓</Text>
          ) : null}
        </View>
        <Text style={styles.time}>{formatTime(transaction.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  description: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 3,
  },
  card: {
    fontSize: 12,
    color: '#888',
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  syncedIcon: {
    fontSize: 12,
    color: '#43A047',
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
    color: '#aaa',
  },
});
