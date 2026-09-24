import AsyncStorage from '@react-native-async-storage/async-storage';

const COMPLAINT_QUEUE_KEY = 'civicresource_mobile_queue';
const LAST_CITIZEN_STATE_KEY = 'civicresource_mobile_last_citizen_status';
const LAST_WORKER_ASSIGNMENT_KEY = 'civicresource_mobile_last_worker_assignment';

export interface QueuedComplaint {
  title: string;
  details: string;
  reporterPhone: string;
  type: string;
  sourceLanguage: string;
  isAnonymous: boolean;
  severity: string;
  location: {
    address: string;
    lat?: number;
    lng?: number;
  };
}

export const getQueuedComplaints = async (): Promise<QueuedComplaint[]> => {
  const value = await AsyncStorage.getItem(COMPLAINT_QUEUE_KEY);
  return value ? JSON.parse(value) : [];
};

export const pushQueuedComplaint = async (payload: QueuedComplaint): Promise<number> => {
  const existing = await getQueuedComplaints();
  const next = [...existing, payload];
  await AsyncStorage.setItem(COMPLAINT_QUEUE_KEY, JSON.stringify(next));
  return next.length;
};

export const clearQueuedComplaints = async () => {
  await AsyncStorage.removeItem(COMPLAINT_QUEUE_KEY);
};

export const setLastCitizenState = async (state: Record<string, string>) => {
  await AsyncStorage.setItem(LAST_CITIZEN_STATE_KEY, JSON.stringify(state));
};

export const getLastCitizenState = async (): Promise<Record<string, string>> => {
  const value = await AsyncStorage.getItem(LAST_CITIZEN_STATE_KEY);
  return value ? JSON.parse(value) : {};
};

export const setLastWorkerAssignment = async (incidentId: string | null) => {
  if (!incidentId) {
    await AsyncStorage.removeItem(LAST_WORKER_ASSIGNMENT_KEY);
    return;
  }
  await AsyncStorage.setItem(LAST_WORKER_ASSIGNMENT_KEY, incidentId);
};

export const getLastWorkerAssignment = async (): Promise<string | null> => {
  return AsyncStorage.getItem(LAST_WORKER_ASSIGNMENT_KEY);
};
