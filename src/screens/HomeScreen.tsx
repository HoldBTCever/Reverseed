import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  AppState,
  DeviceEventEmitter,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import StatusBanner from '../components/StatusBanner';
import TransactionCard from '../components/TransactionCard';
import {parseNotification} from '../NotificationParser';
import {useTransactionStore} from '../store/useTransactionStore';
import {RawNotification, Transaction} from '../types';
import {NativeModules} from 'react-native';

const {NotificationListenerModule} = NativeModules;

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

function todayTotal(transactions: Transaction[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return transactions
    .filter(t => t.timestamp >= today.getTime())
    .reduce((sum, t) => sum + t.amount, 0);
}

function monthTotal(transactions: Transaction[]): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return transactions
    .filter(t => t.timestamp >= start)
    .reduce((sum, t) => sum + t.amount, 0);
}

export default function HomeScreen() {
  const {transactions, addTransaction, syncAllPending, syncStatus, settings} =
    useTransactionStore();
  const [hasPermission, setHasPermission] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const appState = useRef(AppState.currentState);

  const checkPermission = () => {
    if (Platform.OS !== 'android') {
      setHasPermission(true);
      return;
    }
    try {
      const granted =
        NotificationListenerModule?.isNotificationListenerEnabled?.() ?? false;
      setHasPermission(granted);
    } catch {
      setHasPermission(false);
    }
  };

  useEffect(() => {
    checkPermission();

    const sub = AppState.addEventListener('change', nextState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        checkPermission();
      }
      appState.current = nextState;
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'onNotificationReceived',
      (raw: RawNotification) => {
        const transaction = parseNotification(raw);
        if (transaction) {
          addTransaction(transaction);
        }
      },
    );
    return () => subscription.remove();
  }, [addTransaction]);

  const openPermissionSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    checkPermission();
    if (settings.mobills.autoSync) {
      await syncAllPending();
    }
    setRefreshing(false);
  };

  const recentTransactions = transactions.slice(0, 5);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={recentTransactions}
      keyExtractor={item => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C63FF"
        />
      }
      ListHeaderComponent={
        <>
          <StatusBanner
            hasPermission={hasPermission}
            onRequestPermission={openPermissionSettings}
          />

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Hoje</Text>
              <Text style={styles.statValue}>
                {formatCurrency(todayTotal(transactions))}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Mês</Text>
              <Text style={styles.statValue}>
                {formatCurrency(monthTotal(transactions))}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Capturadas</Text>
              <Text style={styles.statValue}>{transactions.length}</Text>
            </View>
          </View>

          {/* Sync button */}
          {settings.mobills.apiToken ? (
            <TouchableOpacity
              style={[
                styles.syncBtn,
                syncStatus === 'syncing' && styles.syncBtnDisabled,
              ]}
              onPress={syncAllPending}
              disabled={syncStatus === 'syncing'}>
              <Text style={styles.syncBtnText}>
                {syncStatus === 'syncing'
                  ? 'Sincronizando...'
                  : `Sincronizar com Mobills (${transactions.filter(t => !t.synced).length} pendentes)`}
              </Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.sectionTitle}>Recentes</Text>
        </>
      }
      renderItem={({item}) => (
        <TransactionCard
          transaction={item}
          onLongPress={() =>
            Alert.alert(
              item.description,
              `${item.cardName}\n${item.rawText}`,
              [{text: 'OK'}],
            )
          }
        />
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>
            Nenhuma transação capturada ainda.
          </Text>
          <Text style={styles.emptyHint}>
            As notificações de cartão aparecerão aqui automaticamente.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  content: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  syncBtn: {
    backgroundColor: '#6C63FF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  syncBtnDisabled: {
    opacity: 0.6,
  },
  syncBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: '#aaa',
    textAlign: 'center',
  },
});
