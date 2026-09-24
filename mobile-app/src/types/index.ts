export type AppLanguage = 'english' | 'hindi' | 'marathi';

export type ComplaintType =
  | 'water'
  | 'sanitation'
  | 'roads'
  | 'utility'
  | 'maintenance'
  | 'safety'
  | 'traffic'
  | 'fire'
  | 'medical'
  | 'infrastructure';

export interface PublicIncident {
  _id: string;
  title: string;
  severity: string;
  status: string;
  trackingId?: string;
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkerAssignmentsResponse {
  personnel: {
    _id: string;
    name: string;
    type: string;
    status: string;
    unitId?: string;
  };
  activeIncident: PublicIncident | null;
  assignedIncidents: PublicIncident[];
}
