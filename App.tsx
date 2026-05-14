import React, {useEffect} from 'react';
import {Platform, StatusBar, StyleSheet, Text, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import TransactionListScreen from './src/screens/TransactionListScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import {useTransactionStore} from './src/store/useTransactionStore';

const Tab = createBottomTabNavigator();

function TabIcon({icon, focused}: {icon: string; focused: boolean}) {
  return (
    <Text style={{fontSize: 20, opacity: focused ? 1 : 0.5}}>{icon}</Text>
  );
}

export default function App() {
  const loadFromStorage = useTransactionStore(s => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'dark-content'}
        backgroundColor="#F5F6FA"
      />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerStyle: styles.header,
            headerTitleStyle: styles.headerTitle,
            tabBarStyle: styles.tabBar,
            tabBarActiveTintColor: '#6C63FF',
            tabBarInactiveTintColor: '#aaa',
            tabBarLabelStyle: styles.tabLabel,
          }}>
          <Tab.Screen
            name="Início"
            component={HomeScreen}
            options={{
              tabBarIcon: ({focused}) => (
                <TabIcon icon="🏠" focused={focused} />
              ),
              headerTitle: 'Card Notifier',
            }}
          />
          <Tab.Screen
            name="Transações"
            component={TransactionListScreen}
            options={{
              tabBarIcon: ({focused}) => (
                <TabIcon icon="💳" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="Configurações"
            component={SettingsScreen}
            options={{
              tabBarIcon: ({focused}) => (
                <TabIcon icon="⚙️" focused={focused} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#F5F6FA',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1a1a2e',
  },
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8F0',
    paddingBottom: 4,
    height: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
