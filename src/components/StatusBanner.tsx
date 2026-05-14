import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

interface Props {
  hasPermission: boolean;
  onRequestPermission: () => void;
}

export default function StatusBanner({hasPermission, onRequestPermission}: Props) {
  if (hasPermission) {
    return (
      <View style={[styles.banner, styles.ok]}>
        <Text style={styles.dot}>●</Text>
        <Text style={styles.text}>Monitorando notificações</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.banner, styles.warn]}
      onPress={onRequestPermission}
      activeOpacity={0.8}>
      <Text style={styles.dot}>⚠</Text>
      <Text style={styles.text}>
        Permissão de notificações necessária — toque para configurar
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  ok: {
    backgroundColor: '#E8F5E9',
  },
  warn: {
    backgroundColor: '#FFF3E0',
  },
  dot: {
    fontSize: 14,
    color: '#555',
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
  },
});
