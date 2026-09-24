import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import NetInfo from '@react-native-community/netinfo';
import { StatusBar } from 'expo-status-bar';

import { tr } from './src/i18n';
import { api, withAuthHeader } from './src/services/api';
import { getAddressFromCoordinates, getCurrentLocation } from './src/services/location';
import { normalizeText } from './src/services/nlp';
import { ensureNotificationPermission, sendLocalNotification } from './src/services/notifications';
import {
  clearQueuedComplaints,
  getLastCitizenState,
  getLastWorkerAssignment,
  getQueuedComplaints,
  pushQueuedComplaint,
  setLastCitizenState,
  setLastWorkerAssignment,
} from './src/services/storage';
import type { AppLanguage, PublicIncident, WorkerAssignmentsResponse } from './src/types';

const complaintTypes = [
  'water',
  'sanitation',
  'roads',
  'utility',
  'maintenance',
  'safety',
  'traffic',
  'fire',
  'medical',
  'infrastructure',
] as const;

type AppRole = 'citizen' | 'worker';

export default function App() {
  const [role, setRole] = useState<AppRole>('citizen');
  const [language, setLanguage] = useState<AppLanguage>('english');
  const [isOnline, setIsOnline] = useState(true);

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<(typeof complaintTypes)[number]>('infrastructure');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 19.076,
    longitude: 72.8777,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [lastTrackingId, setLastTrackingId] = useState('');

  const [trackerPhone, setTrackerPhone] = useState('');
  const [trackerId, setTrackerId] = useState('');
  const [tracked, setTracked] = useState<PublicIncident[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [unitId, setUnitId] = useState('');
  const [workerToken, setWorkerToken] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerUnitId, setWorkerUnitId] = useState('');
  const [workerAssignments, setWorkerAssignments] = useState<PublicIncident[]>([]);
  const [workerActive, setWorkerActive] = useState<PublicIncident | null>(null);
  const [workerLoading, setWorkerLoading] = useState(false);

  const t = useMemo(() => (key: string) => tr(language, key), [language]);

  useEffect(() => {
    ensureNotificationPermission();
    getQueuedComplaints().then((items) => setQueueCount(items.length));

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const syncQueue = async () => {
      if (!isOnline) {
        return;
      }

      const queued = await getQueuedComplaints();
      if (queued.length === 0) {
        return;
      }

      for (const payload of queued) {
        await api.post('/public/incidents', payload);
      }

      await clearQueuedComplaints();
      setQueueCount(0);
      await sendLocalNotification('Complaint Sync', `${queued.length} queued complaint(s) submitted.`);
    };

    syncQueue().catch(() => {
      // Keep queue for next retry.
    });
  }, [isOnline]);

  const requestLocation = async () => {
    const current = await getCurrentLocation();
    if (!current) {
      Alert.alert('Location', 'Permission denied. You can enter address manually.');
      return;
    }
    setAddress(current.address);
    setLat(current.lat);
    setLng(current.lng);
    setMapRegion((prev) => ({
      ...prev,
      latitude: current.lat,
      longitude: current.lng,
    }));
  };

  const pickLocationFromMap = async (event: MapPressEvent) => {
    const pickedLat = event.nativeEvent.coordinate.latitude;
    const pickedLng = event.nativeEvent.coordinate.longitude;

    setLat(pickedLat);
    setLng(pickedLng);
    setMapRegion((prev) => ({
      ...prev,
      latitude: pickedLat,
      longitude: pickedLng,
    }));

    try {
      const resolvedAddress = await getAddressFromCoordinates(pickedLat, pickedLng);
      setAddress(resolvedAddress || `${pickedLat.toFixed(5)}, ${pickedLng.toFixed(5)}`);
    } catch {
      setAddress(`${pickedLat.toFixed(5)}, ${pickedLng.toFixed(5)}`);
    }
  };

  const submitComplaint = async () => {
    if (!title.trim() || !details.trim() || phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Validation', 'Please fill title, details and valid phone.');
      return;
    }

    setSubmitLoading(true);

    try {
      const normalizedTitle = await normalizeText(title, language);
      const normalizedDetails = await normalizeText(details, language);

      const payload = {
        title: normalizedTitle,
        details: normalizedDetails,
        type,
        sourceLanguage: language,
        reporterPhone: phone.replace(/\D/g, ''),
        isAnonymous: true,
        severity: 'medium',
        location: {
          address: address || 'Address not provided',
          lat,
          lng,
        },
      };

      if (!isOnline) {
        const nextCount = await pushQueuedComplaint(payload);
        setQueueCount(nextCount);
        Alert.alert('Queued', 'No internet. Complaint saved and will auto-submit when online.');
        return;
      }

      const { data } = await api.post('/public/incidents', payload);
      setLastTrackingId(data?.trackingId || 'Generated');
      await sendLocalNotification('Complaint Filed', `Tracking ID: ${data?.trackingId || 'Generated'}`);
    } catch {
      Alert.alert('Error', 'Unable to submit complaint.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const runTracker = async () => {
    if (!trackerPhone.trim() && !trackerId.trim()) {
      Alert.alert('Validation', 'Enter phone or tracking ID.');
      return;
    }

    setTrackLoading(true);
    try {
      const { data } = await api.get('/public/incidents/track', {
        params: {
          phone: trackerPhone.trim() || undefined,
          trackingId: trackerId.trim() || undefined,
        },
      });
      setTracked(data || []);
    } catch {
      Alert.alert('Error', 'Unable to fetch complaint status.');
    } finally {
      setTrackLoading(false);
    }
  };

  useEffect(() => {
    const pollCitizenUpdates = async () => {
      if (tracked.length === 0) {
        return;
      }

      const ids = tracked.map((i) => i.trackingId).filter(Boolean).join(',');
      if (!ids) {
        return;
      }

      const previous = await getLastCitizenState();
      const next: Record<string, string> = {};

      for (const incident of tracked) {
        if (!incident._id) {
          continue;
        }
        const { data } = await api.get(`/public/incidents/${incident._id}`);
        const tracking = data?.trackingId || incident.trackingId || incident._id;
        const status = data?.status || 'active';
        next[tracking] = status;

        if (previous[tracking] && previous[tracking] !== status) {
          await sendLocalNotification('Complaint Update', `${tracking}: ${status}`);
        }
      }

      await setLastCitizenState(next);
    };

    const id = setInterval(() => {
      pollCitizenUpdates().catch(() => {});
    }, 30000);

    return () => clearInterval(id);
  }, [tracked]);

  const workerLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation', 'Email and password are required.');
      return;
    }

    setWorkerLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      setWorkerToken(data.token);
      setWorkerName(data.name || 'Worker');
      setWorkerUnitId(data.unitId || '');
      if (data.unitId) {
        setUnitId(data.unitId);
      }
      Alert.alert('Login', 'Worker login successful.');
      await loadWorkerAssignments(data.token, data.unitId || unitId);
    } catch {
      Alert.alert('Login Failed', 'Invalid credentials.');
    } finally {
      setWorkerLoading(false);
    }
  };

  const workerLogout = () => {
    setWorkerToken('');
    setWorkerName('');
    setWorkerUnitId('');
    setUnitId('');
    setWorkerAssignments([]);
    setWorkerActive(null);
    Alert.alert('Logout', 'Worker session cleared.');
  };

  const reloadCurrentView = async () => {
    if (role === 'worker') {
      if (!workerToken) {
        Alert.alert('Reload', 'Login first.');
        return;
      }
      setWorkerLoading(true);
      try {
        await loadWorkerAssignments();
      } finally {
        setWorkerLoading(false);
      }
      return;
    }

    if (!trackerPhone.trim() && !trackerId.trim()) {
      const queued = await getQueuedComplaints();
      setQueueCount(queued.length);
      Alert.alert('Reload', 'Updated local complaint queue state.');
      return;
    }

    await runTracker();
  };

  const loadWorkerAssignments = async (tokenOverride?: string, unitIdOverride?: string) => {
    const authToken = tokenOverride || workerToken;
    const resolvedUnitId = (unitIdOverride || workerUnitId || unitId || '').trim().toUpperCase();

    if (!authToken) {
      Alert.alert('Validation', 'Login first.');
      return;
    }

    try {
      // Primary path: account-linked assignments (no Unit ID input needed)
      const { data } = await api.get<PublicIncident[]>('/dispatch/my-assignments', withAuthHeader(authToken));
      const items = data || [];

      setWorkerAssignments(items);

      const active =
        items.find((i) => i.status === 'investigating') ||
        items.find((i) => i.status !== 'resolved') ||
        items[0] ||
        null;
      setWorkerActive(active);

      const previousActive = await getLastWorkerAssignment();
      const nextActive = active?._id || null;
      if (nextActive && previousActive !== nextActive) {
        await sendLocalNotification('New Assignment', `${active?.title || 'Incident assigned'}`);
      }
      await setLastWorkerAssignment(nextActive);
      return;
    } catch {
      // Fallback path for older backend behavior where unit endpoint is used.
    }

    if (!resolvedUnitId) {
      Alert.alert('Error', 'Unable to load assignments for this account. Unit ID not linked.');
      return;
    }

    try {
      const { data } = await api.get<WorkerAssignmentsResponse>(
        `/dispatch/assignments/${resolvedUnitId}`,
        withAuthHeader(authToken)
      );

      setWorkerAssignments(data.assignedIncidents || []);
      setWorkerActive(data.activeIncident || null);

      const previousActive = await getLastWorkerAssignment();
      const nextActive = data.activeIncident?._id || null;
      if (nextActive && previousActive !== nextActive) {
        await sendLocalNotification('New Assignment', `${data.activeIncident?.title || 'Incident assigned'}`);
      }
      await setLastWorkerAssignment(nextActive);
    } catch {
      Alert.alert('Error', 'Unable to load worker assignments.');
    }
  };

  useEffect(() => {
    if (!workerToken) {
      return;
    }

    const id = setInterval(() => {
      loadWorkerAssignments().catch(() => {});
    }, 20000);

    return () => clearInterval(id);
  }, [workerToken, workerUnitId, unitId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('appTitle')}</Text>

        <View style={styles.actionRow}>
          <Pressable style={styles.refreshBtn} onPress={() => reloadCurrentView().catch(() => Alert.alert('Reload', 'Unable to refresh right now.'))}>
            <Text style={styles.refreshBtnText}>Reload</Text>
          </Pressable>
          <Pressable
            style={[styles.logoutBtn, !(role === 'worker' && workerToken) && styles.disabledBtn]}
            onPress={workerLogout}
            disabled={!(role === 'worker' && workerToken)}
          >
            <Text style={styles.logoutBtnText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.pill, role === 'citizen' && styles.pillActive]} onPress={() => setRole('citizen')}>
            <Text style={[styles.pillText, role === 'citizen' && styles.pillTextActive]}>{t('citizen')}</Text>
          </Pressable>
          <Pressable style={[styles.pill, role === 'worker' && styles.pillActive]} onPress={() => setRole('worker')}>
            <Text style={[styles.pillText, role === 'worker' && styles.pillTextActive]}>{t('worker')}</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          {(['english', 'hindi', 'marathi'] as AppLanguage[]).map((lang) => (
            <Pressable
              key={lang}
              style={[styles.langBtn, language === lang && styles.langBtnActive]}
              onPress={() => setLanguage(lang)}
            >
              <Text style={[styles.langText, language === lang && styles.langTextActive]}>{lang.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.network}>{isOnline ? t('online') : t('offline')} • {t('queued')}: {queueCount}</Text>

        {role === 'citizen' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('fileComplaint')}</Text>

            <TextInput style={styles.input} placeholder={t('complaintTitle')} value={title} onChangeText={setTitle} />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('complaintDetails')}
              value={details}
              multiline
              onChangeText={setDetails}
            />
            <TextInput style={styles.input} placeholder={t('phone')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <TextInput style={styles.input} placeholder={t('complaintType')} value={type} onChangeText={(v) => setType(v as (typeof complaintTypes)[number])} />
            <TextInput style={styles.input} placeholder="Address" value={address} onChangeText={setAddress} />

            <Pressable style={styles.secondaryBtn} onPress={requestLocation}>
              <Text style={styles.secondaryBtnText}>{t('useLocation')}</Text>
            </Pressable>

            <Pressable style={styles.secondaryOutlineBtn} onPress={() => setShowMapPicker((v) => !v)}>
              <Text style={styles.secondaryOutlineBtnText}>{showMapPicker ? 'Hide Map Picker' : 'Pick Location on Map'}</Text>
            </Pressable>

            {showMapPicker ? (
              <View style={styles.mapWrapper}>
                <MapView style={styles.map} initialRegion={mapRegion} region={mapRegion} onPress={pickLocationFromMap}>
                  {lat != null && lng != null ? <Marker coordinate={{ latitude: lat, longitude: lng }} /> : null}
                </MapView>
                <Text style={styles.mapHint}>Tap on map to pin complaint location.</Text>
              </View>
            ) : null}

            <Pressable style={styles.primaryBtn} onPress={submitComplaint} disabled={submitLoading}>
              {submitLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('submit')}</Text>}
            </Pressable>

            {lastTrackingId ? <Text style={styles.badge}>{t('trackingId')}: {lastTrackingId}</Text> : null}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{t('trackComplaint')}</Text>
            <TextInput style={styles.input} placeholder={t('phone')} value={trackerPhone} onChangeText={setTrackerPhone} />
            <TextInput style={styles.input} placeholder={t('trackingId')} value={trackerId} onChangeText={setTrackerId} />

            <Pressable style={styles.primaryBtn} onPress={runTracker} disabled={trackLoading}>
              {trackLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('trackComplaint')}</Text>}
            </Pressable>

            {tracked.length === 0 ? (
              <Text style={styles.muted}>{t('noRecords')}</Text>
            ) : (
              tracked.map((item) => (
                <View key={item._id} style={styles.incidentTile}>
                  <Text style={styles.incidentTitle}>{item.title}</Text>
                  <Text style={styles.muted}>{t('trackingId')}: {item.trackingId || '-'}</Text>
                  <Text style={styles.muted}>{t('status')}: {item.status}</Text>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('login')}</Text>

            {!workerToken ? (
              <>
                <TextInput style={styles.input} placeholder={t('email')} autoCapitalize="none" value={email} onChangeText={setEmail} />
                <TextInput style={styles.input} placeholder={t('password')} secureTextEntry value={password} onChangeText={setPassword} />
                <Pressable style={styles.primaryBtn} onPress={workerLogin} disabled={workerLoading}>
                  {workerLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('login')}</Text>}
                </Pressable>
              </>
            ) : (
              <Text style={styles.badge}>Logged in as {workerName}{workerUnitId ? ` (${workerUnitId})` : ''}</Text>
            )}

            <TextInput
              style={styles.input}
              placeholder={`${t('unitId')} (optional fallback)`}
              value={unitId}
              onChangeText={setUnitId}
              autoCapitalize="characters"
            />
            <Pressable style={styles.primaryBtn} onPress={() => loadWorkerAssignments().catch(() => {})}>
              <Text style={styles.primaryBtnText}>Load My Assignments</Text>
            </Pressable>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t('workerHud')}</Text>
            {workerActive ? (
              <View style={styles.hudBox}>
                <Text style={styles.incidentTitle}>{workerActive.title}</Text>
                <Text style={styles.muted}>Severity: {workerActive.severity}</Text>
                <Text style={styles.muted}>{t('status')}: {workerActive.status}</Text>
                <Text style={styles.muted}>Tracking: {workerActive.trackingId || '-'}</Text>
              </View>
            ) : (
              <Text style={styles.muted}>No active assignment.</Text>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t('notifications')}</Text>
            {workerAssignments.length === 0 ? (
              <Text style={styles.muted}>{t('noRecords')}</Text>
            ) : (
              workerAssignments.map((item) => (
                <View key={item._id} style={styles.incidentTile}>
                  <Text style={styles.incidentTitle}>{item.title}</Text>
                  <Text style={styles.muted}>{t('status')}: {item.status}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  logoutBtn: {
    flex: 1,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#b91c1c',
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.55,
  },
  pill: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: '#0f172a',
  },
  pillText: {
    color: '#334155',
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  langBtn: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  langBtnActive: {
    backgroundColor: '#f97316',
  },
  langText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  langTextActive: {
    color: '#fff',
  },
  network: {
    color: '#334155',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  input: {
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: '#f97316',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  secondaryOutlineBtn: {
    backgroundColor: '#fff7ed',
    borderColor: '#fb923c',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryOutlineBtnText: {
    color: '#c2410c',
    fontWeight: '800',
  },
  mapWrapper: {
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  map: {
    width: '100%',
    height: 240,
  },
  mapHint: {
    color: '#475569',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontWeight: '600',
  },
  badge: {
    fontWeight: '700',
    color: '#1e293b',
  },
  muted: {
    color: '#64748b',
    fontSize: 13,
  },
  incidentTile: {
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  incidentTitle: {
    fontWeight: '800',
    color: '#0f172a',
  },
  hudBox: {
    borderColor: '#0f172a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#f8fafc',
    gap: 3,
  },
});
