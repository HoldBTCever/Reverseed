import React, {useState} from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import TransactionCard from '../components/TransactionCard';
import {useTransactionStore} from '../store/useTransactionStore';
import {Transaction, TransactionType} from '../types';

type Filter = 'all' | TransactionType;

const FILTERS: {label: string; value: Filter}[] = [
  {label: 'Todas', value: 'all'},
  {label: 'Crédito', value: 'credit'},
  {label: 'Débito', value: 'debit'},
  {label: 'Pix', value: 'pix'},
];

function applySearch(transactions: Transaction[], query: string): Transaction[] {
  if (!query.trim()) {
    return transactions;
  }
  const q = query.toLowerCase();
  return transactions.filter(
    t =>
      t.description.toLowerCase().includes(q) ||
      t.cardName.toLowerCase().includes(q) ||
      t.amount.toFixed(2).includes(q),
  );
}

function applyFilter(
  transactions: Transaction[],
  filter: Filter,
): Transaction[] {
  if (filter === 'all') {
    return transactions;
  }
  return transactions.filter(t => t.type === filter);
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

export default function TransactionListScreen() {
  const {transactions, removeTransaction, syncTransaction, syncAllPending} =
    useTransactionStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = applySearch(applyFilter(transactions, filter), search);
  const total = filtered.reduce((s, t) => s + t.amount, 0);

  const handleLongPress = (item: Transaction) => {
    Alert.alert(item.description, item.rawText, [
      {
        text: 'Sincronizar com Mobills',
        onPress: () => syncTransaction(item.id),
      },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Excluir?', 'Esta transação será removida.', [
            {text: 'Cancelar', style: 'cancel'},
            {
              text: 'Excluir',
              style: 'destructive',
              onPress: () => removeTransaction(item.id),
            },
          ]),
      },
      {text: 'Cancelar', style: 'cancel'},
    ]);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Buscar por descrição, cartão ou valor..."
        placeholderTextColor="#aaa"
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[
              styles.filterBtn,
              filter === f.value && styles.filterBtnActive,
            ]}
            onPress={() => setFilter(f.value)}>
            <Text
              style={[
                styles.filterBtnText,
                filter === f.value && styles.filterBtnTextActive,
              ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {filtered.length} transaç{filtered.length === 1 ? 'ão' : 'ões'}
        </Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <TransactionCard
            transaction={item}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma transação encontrada</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />

      {transactions.filter(t => !t.synced).length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={syncAllPending}>
          <Text style={styles.fabText}>Sincronizar tudo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  search: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a2e',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  filterRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#E8E8F0',
  },
  filterBtnActive: {
    backgroundColor: '#6C63FF',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 13,
    color: '#888',
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  list: {
    paddingBottom: 100,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#aaa',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    left: 24,
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
