import axios from 'axios';
import { AppLanguage } from '../types';

const AI_BASE_URL = process.env.EXPO_PUBLIC_AI_ENGINE_URL || 'http://10.0.2.2:8000';

export const normalizeText = async (text: string, language: AppLanguage): Promise<string> => {
  if (!text.trim()) {
    return text;
  }

  try {
    const { data } = await axios.post(`${AI_BASE_URL}/nlp/normalize`, {
      text,
      language,
    });

    return data?.english_text || text;
  } catch {
    return text;
  }
};
