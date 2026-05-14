import React, {useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {getMobillsService} from '../services/MobillsService';
import {useTransactionStore} from '../store/useTransactionStore';

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const {settings, updateMobillsConfig, updateSettings, clearAll} =
    useTransactionStore();
  const {mobills} = settings;

  const [apiToken, setApiToken] = useState(mobills.apiToken);
  const [apiUrl, setApiUrl] = useState(mobills.apiUrl);
  const [accountId, setAccountId] = useState(mobills.defaultAccountId);
  const [categoryId, setCategoryId] = useState(mobills.defaultCategoryId);
  const [testing, setTesting] = useState(false);

  const saveConfig = async () => {
    await updateMobillsConfig({
      apiToken,
      apiUrl,
      defaultAccountId: accountId,
      defaultCategoryId: categoryId,
    });
    Alert.alert('Salvo', 'Configurações do Mobills salvas com sucesso.');
  };

  const testConnection = async () => {
    if (!apiToken) {
      Alert.alert('Erro', 'Informe o token da API primeiro.');
      return;
    }
    setTesting(true);
    try {
      const service = getMobillsService({
        ...mobills,
        apiToken,
        apiUrl,
      });
      const ok = await service.testConnection();
      Alert.alert(
        ok ? 'Conexão bem-sucedida' : 'Falha na conexão',
        ok ? 'Token e URL válidos.' : 'Verifique o token e a URL da API.',
      );
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const confirmClear = () => {
    Alert.alert(
      'Limpar histórico',
      'Todas as transações capturadas serão removidas. Isso não pode ser desfeito.',
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: clearAll,
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Mobills API">
        <Row label="Token da API">
          <TextInput
            style={styles.input}
            value={apiToken}
            onChangeText={setApiToken}
            placeholder="Bearer token do Mobills"
            placeholderTextColor="#bbb"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Row>

        <Row label="URL da API">
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="https://api.mobills.com.br/v1"
            placeholderTextColor="#bbb"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </Row>

        <Row label="ID da conta padrão">
          <TextInput
            style={styles.input}
            value={accountId}
            onChangeText={setAccountId}
            placeholder="Ex: 123456"
            placeholderTextColor="#bbb"
            keyboardType="numeric"
          />
        </Row>

        <Row label="ID da categoria padrão">
          <TextInput
            style={styles.input}
            value={categoryId}
            onChangeText={setCategoryId}
            placeholder="Ex: 78"
            placeholderTextColor="#bbb"
            keyboardType="numeric"
          />
        </Row>

        <Row label="Sincronizar automaticamente">
          <Switch
            value={mobills.autoSync}
            onValueChange={v => updateMobillsConfig({autoSync: v})}
            trackColor={{false: '#ddd', true: '#6C63FF'}}
            thumbColor="#fff"
          />
        </Row>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline]}
            onPress={testConnection}
            disabled={testing}>
            <Text style={styles.btnOutlineText}>
              {testing ? 'Testando...' : 'Testar conexão'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={saveConfig}>
            <Text style={styles.btnText}>Salvar</Text>
          </TouchableOpacity>
        </View>
      </Section>

      <Section title="Filtros">
        <Row label="Valor mínimo (R$)">
          <TextInput
            style={[styles.input, styles.inputSmall]}
            value={String(settings.minimumAmount)}
            onChangeText={v =>
              updateSettings({minimumAmount: parseFloat(v) || 0})
            }
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#bbb"
          />
        </Row>
      </Section>

      <Section title="Dados">
        <TouchableOpacity
          style={[styles.btn, styles.btnDanger]}
          onPress={confirmClear}>
          <Text style={styles.btnText}>Limpar histórico de transações</Text>
        </TouchableOpacity>
      </Section>

      <View style={styles.hint}>
        <Text style={styles.hintTitle}>Como obter o token do Mobills</Text>
        <Text style={styles.hintText}>
          1. Acesse app.mobills.com.br no navegador{'\n'}
          2. Vá em Configurações → Integrações → API{'\n'}
          3. Gere um novo token e cole acima{'\n'}
          4. Copie o ID da conta e da categoria desejadas
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C63FF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  rowValue: {
    flex: 1.2,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#1a1a2e',
    textAlign: 'right',
    padding: 0,
  },
  inputSmall: {
    width: 80,
    flex: undefined,
  },
  btnRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
  },
  btn: {
    flex: 1,
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#6C63FF',
  },
  btnDanger: {
    backgroundColor: '#E53935',
    margin: 14,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  btnOutlineText: {
    color: '#6C63FF',
    fontWeight: '700',
    fontSize: 14,
  },
  hint: {
    backgroundColor: '#EDE9FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  hintTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B54D6',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#5B54D6',
    lineHeight: 20,
  },
});
