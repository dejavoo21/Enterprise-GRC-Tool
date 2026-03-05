export type TrainingStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

// Flexible framework code - allows any string for data-driven frameworks
export type ControlFrameworkCode = string;

// Legacy alias for backwards compatibility
export type ControlFramework = ControlFrameworkCode;

// Training delivery format
export type TrainingDeliveryFormat =
  | 'internal_video'
  | 'document'
  | 'external_lms'
  | 'classroom'
  | 'other';

export interface TrainingCourse {
  id: string;
  workspaceId: string | null;  // null = global/seeded course
  title: string;
  description?: string;
  durationMinutes?: number;
  mandatory: boolean;
  deliveryFormat: TrainingDeliveryFormat;
  contentUrl?: string;
  frameworkCodes: string[];
  category?: string;
  isCustom: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed fields from assignments
  totalAssignments?: number;
  completedAssignments?: number;
  overdueAssignments?: number;
  completionRate?: number;
}

export interface CreateTrainingCourseInput {
  title: string;
  description?: string;
  durationMinutes?: number;
  mandatory?: boolean;
  deliveryFormat?: TrainingDeliveryFormat;
  contentUrl?: string;
  frameworkCodes?: string[];
  category?: string;
}

export interface UpdateTrainingCourseInput extends Partial<CreateTrainingCourseInput> {
  isActive?: boolean;
}

export interface TrainingAssignment {
  id: string;
  workspaceId: string;
  courseId: string;
  userId: string;
  userName: string;
  status: TrainingStatus;
  assignedAt: string;
  dueAt?: string;
  completedAt?: string;
  courseTitle?: string;
  courseDuration?: number;
  mandatory?: boolean;
}

export type CampaignStatus = 'planned' | 'active' | 'completed';

export interface AwarenessCampaign {
  id: string;
  workspaceId: string;
  title: string;
  topic: string;
  channel: 'email' | 'poster' | 'event' | 'phishing_sim' | 'video';
  startDate: string;
  endDate?: string;
  status: CampaignStatus;
  participants: number;
  completionRate?: number;
  clickRate?: number;
}

export interface TrainingDashboard {
  overallCompletionRate: number;
  overdueAssignments: number;
  activeCampaigns: number;
  totalCourses: number;
  totalAssignments: number;
  lastCampaignSummary?: {
    title: string;
    topic: string;
    completionRate?: number;
    clickRate?: number;
  };
}

export interface ApiResponse<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
}

// Display helpers
export const DELIVERY_FORMAT_LABELS: Record<TrainingDeliveryFormat, string> = {
  internal_video: 'Video',
  document: 'Document',
  external_lms: 'External LMS',
  classroom: 'Classroom',
  other: 'Other',
};

export const DELIVERY_FORMAT_OPTIONS: { value: TrainingDeliveryFormat; label: string }[] = [
  { value: 'internal_video', label: 'Video' },
  { value: 'document', label: 'Document' },
  { value: 'external_lms', label: 'External LMS' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'other', label: 'Other' },
];
