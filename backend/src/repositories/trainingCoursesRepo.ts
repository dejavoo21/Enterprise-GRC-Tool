import { pool, generateId } from '../db.js';
import type { TrainingCourse, CreateTrainingCourseInput, TrainingDeliveryFormat } from '../types/models.js';

export interface TrainingCourseFilters {
  frameworkCode?: string;
  mandatory?: boolean;
  includeInactive?: boolean;
  customOnly?: boolean;
}

interface CourseRow {
  id: string;
  workspace_id: string | null;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  mandatory: boolean;
  delivery_format: string | null;
  content_url: string | null;
  category: string | null;
  is_custom: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function rowToCourse(row: CourseRow, frameworkCodes: string[] = []): TrainingCourse {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    mandatory: row.mandatory,
    deliveryFormat: (row.delivery_format as TrainingDeliveryFormat) || 'document',
    contentUrl: row.content_url ?? undefined,
    frameworkCodes,
    category: row.category ?? undefined,
    isCustom: row.is_custom,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Get framework codes for a course
 */
async function getCourseFrameworks(courseId: string): Promise<string[]> {
  const result = await pool.query(
    'SELECT framework_code FROM training_course_frameworks WHERE course_id = $1',
    [courseId]
  );
  return result.rows.map(r => r.framework_code);
}

/**
 * Set framework codes for a course (replaces existing)
 */
async function setCourseFrameworks(courseId: string, frameworkCodes: string[]): Promise<void> {
  // Delete existing
  await pool.query('DELETE FROM training_course_frameworks WHERE course_id = $1', [courseId]);

  // Insert new
  if (frameworkCodes.length > 0) {
    const values = frameworkCodes.map((_, i) => `($1, $${i + 2})`).join(', ');
    await pool.query(
      `INSERT INTO training_course_frameworks (course_id, framework_code) VALUES ${values}`,
      [courseId, ...frameworkCodes]
    );
  }
}

/**
 * Get all training courses visible to a workspace
 * Returns global courses (workspace_id IS NULL) + workspace-specific courses
 */
export async function getTrainingCourses(
  workspaceId: string,
  filters?: TrainingCourseFilters
): Promise<TrainingCourse[]> {
  let query = `
    SELECT c.*
    FROM training_courses c
    WHERE (c.workspace_id IS NULL OR c.workspace_id = $1)
  `;
  const params: (string | boolean)[] = [workspaceId];
  let paramIndex = 2;

  // Filter by active status
  if (!filters?.includeInactive) {
    query += ` AND c.is_active = true`;
  }

  // Filter by mandatory
  if (filters?.mandatory !== undefined) {
    query += ` AND c.mandatory = $${paramIndex}`;
    params.push(filters.mandatory);
    paramIndex++;
  }

  // Filter by custom only
  if (filters?.customOnly) {
    query += ` AND c.is_custom = true`;
  }

  // Filter by framework code - requires join
  if (filters?.frameworkCode) {
    query += ` AND EXISTS (
      SELECT 1 FROM training_course_frameworks cf
      WHERE cf.course_id = c.id AND cf.framework_code = $${paramIndex}
    )`;
    params.push(filters.frameworkCode);
    paramIndex++;
  }

  query += ` ORDER BY c.is_custom DESC, c.title ASC`;

  const result = await pool.query(query, params);

  // Get frameworks for each course
  const courses: TrainingCourse[] = [];
  for (const row of result.rows) {
    const frameworks = await getCourseFrameworks(row.id);
    courses.push(rowToCourse(row, frameworks));
  }

  return courses;
}

/**
 * Get a single training course by ID
 */
export async function getTrainingCourseById(
  workspaceId: string,
  id: string
): Promise<TrainingCourse | null> {
  const result = await pool.query(
    `SELECT * FROM training_courses
     WHERE id = $1 AND (workspace_id IS NULL OR workspace_id = $2)`,
    [id, workspaceId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const frameworks = await getCourseFrameworks(id);
  return rowToCourse(result.rows[0], frameworks);
}

/**
 * Create a custom training course for a workspace
 */
export async function createTrainingCourse(
  workspaceId: string,
  input: CreateTrainingCourseInput
): Promise<TrainingCourse> {
  const id = generateId('TC');
  const now = new Date();

  const result = await pool.query(
    `INSERT INTO training_courses
     (id, workspace_id, title, description, duration_minutes, mandatory,
      delivery_format, content_url, category, is_custom, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true, $10, $10)
     RETURNING *`,
    [
      id,
      workspaceId,
      input.title,
      input.description || null,
      input.durationMinutes || null,
      input.mandatory ?? false,
      input.deliveryFormat || 'document',
      input.contentUrl || null,
      input.category || null,
      now,
    ]
  );

  // Set framework codes
  if (input.frameworkCodes && input.frameworkCodes.length > 0) {
    await setCourseFrameworks(id, input.frameworkCodes);
  }

  const frameworks = input.frameworkCodes || [];
  return rowToCourse(result.rows[0], frameworks);
}

/**
 * Update a custom training course
 * Only allows updating courses that belong to the workspace and are custom
 */
export async function updateTrainingCourse(
  workspaceId: string,
  id: string,
  updates: Partial<CreateTrainingCourseInput & { isActive?: boolean }>
): Promise<TrainingCourse | null> {
  // First check if the course exists and is editable
  const existing = await pool.query(
    `SELECT * FROM training_courses
     WHERE id = $1 AND workspace_id = $2 AND is_custom = true`,
    [id, workspaceId]
  );

  if (existing.rows.length === 0) {
    return null;
  }

  // Build dynamic update query
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: (string | number | boolean | null)[] = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    setClauses.push(`title = $${paramIndex}`);
    params.push(updates.title);
    paramIndex++;
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex}`);
    params.push(updates.description || null);
    paramIndex++;
  }
  if (updates.durationMinutes !== undefined) {
    setClauses.push(`duration_minutes = $${paramIndex}`);
    params.push(updates.durationMinutes || null);
    paramIndex++;
  }
  if (updates.mandatory !== undefined) {
    setClauses.push(`mandatory = $${paramIndex}`);
    params.push(updates.mandatory);
    paramIndex++;
  }
  if (updates.deliveryFormat !== undefined) {
    setClauses.push(`delivery_format = $${paramIndex}`);
    params.push(updates.deliveryFormat);
    paramIndex++;
  }
  if (updates.contentUrl !== undefined) {
    setClauses.push(`content_url = $${paramIndex}`);
    params.push(updates.contentUrl || null);
    paramIndex++;
  }
  if (updates.category !== undefined) {
    setClauses.push(`category = $${paramIndex}`);
    params.push(updates.category || null);
    paramIndex++;
  }
  if (updates.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex}`);
    params.push(updates.isActive);
    paramIndex++;
  }

  params.push(id);
  const result = await pool.query(
    `UPDATE training_courses SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  // Update framework codes if provided
  if (updates.frameworkCodes !== undefined) {
    await setCourseFrameworks(id, updates.frameworkCodes);
  }

  const frameworks = updates.frameworkCodes ?? await getCourseFrameworks(id);
  return rowToCourse(result.rows[0], frameworks);
}

/**
 * Delete (archive) a custom training course
 * Sets is_active to false rather than actually deleting
 */
export async function archiveTrainingCourse(
  workspaceId: string,
  id: string
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE training_courses
     SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND is_custom = true
     RETURNING id`,
    [id, workspaceId]
  );

  return result.rows.length > 0;
}

// ============================================
// Training Assignments
// ============================================

interface AssignmentRow {
  id: string;
  workspace_id: string;
  course_id: string;
  user_id: string;
  user_name: string;
  status: string;
  assigned_at: Date;
  due_at: Date | null;
  completed_at: Date | null;
}

export interface TrainingAssignment {
  id: string;
  workspaceId: string;
  courseId: string;
  userId: string;
  userName: string;
  status: string;
  assignedAt: string;
  dueAt?: string;
  completedAt?: string;
}

function rowToAssignment(row: AssignmentRow): TrainingAssignment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    courseId: row.course_id,
    userId: row.user_id,
    userName: row.user_name,
    status: row.status,
    assignedAt: row.assigned_at.toISOString(),
    dueAt: row.due_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
  };
}

export async function getTrainingAssignments(
  workspaceId: string,
  filters?: { courseId?: string; status?: string; userId?: string }
): Promise<TrainingAssignment[]> {
  let query = 'SELECT * FROM training_assignments WHERE workspace_id = $1';
  const params: string[] = [workspaceId];
  let paramIndex = 2;

  if (filters?.courseId) {
    query += ` AND course_id = $${paramIndex}`;
    params.push(filters.courseId);
    paramIndex++;
  }
  if (filters?.status) {
    query += ` AND status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }
  if (filters?.userId) {
    query += ` AND user_id = $${paramIndex}`;
    params.push(filters.userId);
    paramIndex++;
  }

  query += ' ORDER BY assigned_at DESC';
  const result = await pool.query(query, params);
  return result.rows.map(rowToAssignment);
}

/**
 * Get assignment statistics for courses
 */
export async function getCourseAssignmentStats(
  workspaceId: string,
  courseIds: string[]
): Promise<Map<string, { total: number; completed: number; overdue: number }>> {
  if (courseIds.length === 0) {
    return new Map();
  }

  const placeholders = courseIds.map((_, i) => `$${i + 2}`).join(', ');
  const result = await pool.query(
    `SELECT
       course_id,
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'completed') as completed,
       COUNT(*) FILTER (WHERE status = 'overdue') as overdue
     FROM training_assignments
     WHERE workspace_id = $1 AND course_id IN (${placeholders})
     GROUP BY course_id`,
    [workspaceId, ...courseIds]
  );

  const stats = new Map<string, { total: number; completed: number; overdue: number }>();
  for (const row of result.rows) {
    stats.set(row.course_id, {
      total: parseInt(row.total, 10),
      completed: parseInt(row.completed, 10),
      overdue: parseInt(row.overdue, 10),
    });
  }

  return stats;
}

// ============================================
// Awareness Campaigns
// ============================================

interface CampaignRow {
  id: string;
  workspace_id: string;
  title: string;
  topic: string;
  channel: string;
  start_date: Date;
  end_date: Date | null;
  status: string;
  participants: number;
  completion_rate: string | null;
  click_rate: string | null;
}

export interface AwarenessCampaign {
  id: string;
  workspaceId: string;
  title: string;
  topic: string;
  channel: string;
  startDate: string;
  endDate?: string;
  status: string;
  participants: number;
  completionRate?: number;
  clickRate?: number;
}

function rowToCampaign(row: CampaignRow): AwarenessCampaign {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    topic: row.topic,
    channel: row.channel,
    startDate: row.start_date.toISOString().split('T')[0],
    endDate: row.end_date?.toISOString().split('T')[0],
    status: row.status,
    participants: row.participants,
    completionRate: row.completion_rate ? parseFloat(row.completion_rate) : undefined,
    clickRate: row.click_rate ? parseFloat(row.click_rate) : undefined,
  };
}

export async function getAwarenessCampaigns(
  workspaceId: string,
  filters?: { status?: string }
): Promise<AwarenessCampaign[]> {
  let query = 'SELECT * FROM awareness_campaigns WHERE workspace_id = $1';
  const params: string[] = [workspaceId];

  if (filters?.status) {
    query += ' AND status = $2';
    params.push(filters.status);
  }

  query += ' ORDER BY start_date DESC';
  const result = await pool.query(query, params);
  return result.rows.map(rowToCampaign);
}
