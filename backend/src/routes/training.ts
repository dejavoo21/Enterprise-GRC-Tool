import { Router } from 'express';
import type { ApiResponse, TrainingDashboard, CreateTrainingCourseInput } from '../types/models.js';
import { getWorkspaceId } from '../workspace.js';
import * as trainingCoursesRepo from '../repositories/trainingCoursesRepo.js';
import * as authRepo from '../repositories/authRepo.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';
import { isTrainingAssignmentStatus, type AwarenessCampaignStatus } from '../lib/trainingAssignmentLifecycle.js';
import {
  isActiveCampaignStatus,
  isCompletedTrainingStatus,
  isDerivedTrainingOverdue,
} from '../lib/trainingStatus.js';

const router = Router();

// GET /api/v1/training/dashboard
// Returns high-level training metrics
router.get('/dashboard', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);

    // Get courses and assignments from database
    const courses = await trainingCoursesRepo.getTrainingCourses(workspaceId);
    const assignments = await trainingCoursesRepo.getTrainingAssignments(workspaceId);
    const campaigns = await trainingCoursesRepo.getAwarenessCampaigns(workspaceId);

    const totalAssignments = assignments.length;
    const completedAssignments = assignments.filter((assignment) => isCompletedTrainingStatus(assignment.status)).length;
    const overdueAssignments = assignments.filter((assignment) =>
      isDerivedTrainingOverdue(assignment.dueAt, assignment.status, assignment.completedAt)
    ).length;
    const activeCampaigns = campaigns.filter((campaign) => isActiveCampaignStatus(campaign.status)).length;

    const overallCompletionRate = totalAssignments > 0
      ? Math.round((completedAssignments / totalAssignments) * 100)
      : null;

    // Get last completed campaign
    const completedCampaigns = campaigns
      .filter(c => c.status === 'completed')
      .sort((a, b) => new Date(b.endDate || b.startDate).getTime() - new Date(a.endDate || a.startDate).getTime());

    const lastCampaign = completedCampaigns[0];

    const dashboard: TrainingDashboard = {
      overallCompletionRate,
      overdueAssignments,
      activeCampaigns,
      totalCourses: courses.length,
      totalAssignments,
      lastCampaignSummary: lastCampaign ? {
        title: lastCampaign.title,
        topic: lastCampaign.topic,
        completionRate: lastCampaign.completionRate,
        clickRate: lastCampaign.clickRate,
      } : undefined,
    };

    const response: ApiResponse<TrainingDashboard> = {
      data: dashboard,
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching training dashboard:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch training dashboard',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/training/courses
// Returns all courses with aggregated completion info
router.get('/courses', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { frameworkCode, mandatory } = req.query;

    const filters: trainingCoursesRepo.TrainingCourseFilters = {};
    if (frameworkCode && typeof frameworkCode === 'string') {
      filters.frameworkCode = frameworkCode;
    }
    if (mandatory !== undefined) {
      filters.mandatory = mandatory === 'true';
    }

    const courses = await trainingCoursesRepo.getTrainingCourses(workspaceId, filters);

    // Get assignment stats for all courses
    const courseIds = courses.map(c => c.id);
    const stats = await trainingCoursesRepo.getCourseAssignmentStats(workspaceId, courseIds);

    // Enrich courses with stats
    const coursesWithStats = courses.map(course => {
      const courseStats = stats.get(course.id) || { total: 0, completed: 0, overdue: 0 };
      const completionRate = courseStats.total > 0
        ? Math.round((courseStats.completed / courseStats.total) * 100)
        : null;

      return {
        ...course,
        totalAssignments: courseStats.total,
        completedAssignments: courseStats.completed,
        overdueAssignments: courseStats.overdue,
        completionRate,
      };
    });

    const response: ApiResponse<typeof coursesWithStats> = {
      data: coursesWithStats,
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching courses:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch courses',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/training/courses
// Create a new custom training course
router.post('/courses', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input: CreateTrainingCourseInput = req.body;

    if (!input.title || !input.title.trim()) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title is required',
        },
      };
      return res.status(400).json(response);
    }

    const course = await trainingCoursesRepo.createTrainingCourse(workspaceId, input);

    const response: ApiResponse<typeof course> = {
      data: course,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating course:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create course',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/training/courses/:id
// Get a single course by ID
router.get('/courses/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;

    const course = await trainingCoursesRepo.getTrainingCourseById(workspaceId, id);

    if (!course) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Course not found',
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof course> = {
      data: course,
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching course:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch course',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /api/v1/training/courses/:id
// Update a custom training course
router.patch('/courses/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const updates = req.body;

    const course = await trainingCoursesRepo.updateTrainingCourse(workspaceId, id, updates);

    if (!course) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Course not found or not editable (only custom courses can be edited)',
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof course> = {
      data: course,
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating course:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update course',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/training/courses/:id
// Archive a custom training course
router.delete('/courses/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;

    const archived = await trainingCoursesRepo.archiveTrainingCourse(workspaceId, id);

    if (!archived) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Course not found or not archivable (only custom courses can be archived)',
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ archived: boolean }> = {
      data: { archived: true },
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error archiving course:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to archive course',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/training/assignments
// Returns all assignments, optionally filtered
router.get('/assignments', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { courseId, status, userId } = req.query;

    const filters: { courseId?: string; status?: string; userId?: string } = {};
    if (courseId && typeof courseId === 'string') filters.courseId = courseId;
    if (status && typeof status === 'string') filters.status = status;
    if (userId && typeof userId === 'string') filters.userId = userId;

    const assignments = await trainingCoursesRepo.getTrainingAssignments(workspaceId, filters);

    // Get course info for enrichment
    const courses = await trainingCoursesRepo.getTrainingCourses(workspaceId);
    const courseMap = new Map(courses.map(c => [c.id, c]));

    // Enrich with course info
    const enrichedAssignments = assignments.map(assignment => {
      const course = courseMap.get(assignment.courseId);
      return {
        ...assignment,
        courseTitle: course?.title,
        courseDuration: course?.durationMinutes,
        mandatory: course?.mandatory,
      };
    });

    const response: ApiResponse<typeof enrichedAssignments> = {
      data: enrichedAssignments,
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch assignments',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/training/assignments
// Assign an existing workspace learner to an available course after review.
router.post('/assignments', requirePermission('Training', 'create'), async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const courseId = typeof req.body?.courseId === 'string' ? req.body.courseId.trim() : '';
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    const dueAt = typeof req.body?.dueAt === 'string' && req.body.dueAt.trim() ? req.body.dueAt : null;
    if (!courseId || !userId) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Course and learner are required.' } });
    }
    if (dueAt && Number.isNaN(Date.parse(dueAt))) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Due date must be a valid date.' } });
    }

    const member = await authRepo.getWorkspaceMembership(userId, workspaceId);
    if (!member) {
      return res.status(400).json({ data: null, error: { code: 'INVALID_LEARNER', message: 'Learner is not a member of this workspace.' } });
    }
    const members = await authRepo.getWorkspaceMembers(workspaceId);
    const learner = members.find((item) => item.id === userId);
    if (!learner) {
      return res.status(400).json({ data: null, error: { code: 'INVALID_LEARNER', message: 'Learner record is unavailable in this workspace.' } });
    }

    const assignment = await trainingCoursesRepo.createTrainingAssignment(workspaceId, {
      courseId,
      userId,
      userName: learner.fullName,
      dueAt,
    });
    await recordActivity(buildActivityFromRequest(req, {
      action: 'training_assignment_created',
      category: 'training',
      targetType: 'training_assignment',
      targetId: assignment.id,
      targetName: learner.fullName,
      newValue: assignment,
      outcome: 'success',
      severity: 'medium',
      source: 'backend',
      notes: `Assigned course ${courseId} to workspace learner ${userId}.`,
    }));
    return res.status(201).json({ data: assignment, error: null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'ASSIGNMENT_CREATE_FAILED';
    const conflict = code === 'DUPLICATE_ASSIGNMENT';
    const invalid = code === 'INVALID_COURSE';
    return res.status(conflict ? 409 : invalid ? 400 : 500).json({
      data: null,
      error: { code, message: error instanceof Error ? error.message : 'Failed to create training assignment.' },
    });
  }
});

// PATCH /api/v1/training/assignments/:id/status
// Apply an allowlisted lifecycle transition to an assignment.
router.patch('/assignments/:id/status', requirePermission('Training', 'edit'), async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const nextStatus = req.body?.status;
    if (!isTrainingAssignmentStatus(nextStatus)) {
      return res.status(400).json({ data: null, error: { code: 'INVALID_STATUS', message: 'A supported assignment status is required.' } });
    }
    const result = await trainingCoursesRepo.transitionTrainingAssignment(workspaceId, req.params.id, nextStatus);
    if (!result) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Training assignment not found.' } });
    await recordActivity(buildActivityFromRequest(req, {
      action: 'training_assignment_status_changed',
      category: 'training',
      targetType: 'training_assignment',
      targetId: result.after.id,
      targetName: result.after.userName,
      previousValue: result.before,
      newValue: result.after,
      outcome: 'success',
      severity: nextStatus === 'failed' || nextStatus === 'cancelled' ? 'high' : 'medium',
      source: 'backend',
    }));
    return res.json({ data: result.after, error: null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'ASSIGNMENT_UPDATE_FAILED';
    return res.status(code === 'INVALID_TRANSITION' || code === 'INVALID_STATUS' ? 409 : 500).json({
      data: null,
      error: { code, message: error instanceof Error ? error.message : 'Failed to update training assignment.' },
    });
  }
});

// GET /api/v1/training/campaigns
// Returns all awareness campaigns
router.get('/campaigns', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status } = req.query;

    const filters: { status?: string } = {};
    if (status && typeof status === 'string') filters.status = status;

    const campaigns = await trainingCoursesRepo.getAwarenessCampaigns(workspaceId, filters);

    const response: ApiResponse<typeof campaigns> = {
      data: campaigns,
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch campaigns',
      },
    };
    res.status(500).json(response);
  }
});

router.post('/campaigns', requirePermission('Training', 'create'), async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { title, topic, channel, startDate, endDate } = req.body || {};
    const allowedChannels = ['email', 'poster', 'event', 'phishing_sim', 'video', 'portal'];
    if (![title, topic, channel, startDate].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Title, topic, channel and start date are required.' } });
    }
    if (!allowedChannels.includes(channel) || Number.isNaN(Date.parse(startDate)) || (endDate && Number.isNaN(Date.parse(endDate)))) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Campaign channel or dates are invalid.' } });
    }
    if (endDate && endDate < startDate) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Campaign end date cannot precede the start date.' } });
    }
    const campaign = await trainingCoursesRepo.createAwarenessCampaign(workspaceId, {
      title: title.trim(), topic: topic.trim(), channel, startDate, endDate: endDate || null,
    });
    await recordActivity(buildActivityFromRequest(req, {
      action: 'awareness_campaign_created', category: 'training', targetType: 'awareness_campaign',
      targetId: campaign.id, targetName: campaign.title, newValue: campaign,
      outcome: 'success', severity: 'medium', source: 'backend',
      notes: 'Campaign record created in planned state; no external messages were sent.',
    }));
    return res.status(201).json({ data: campaign, error: null });
  } catch (error) {
    return res.status(500).json({ data: null, error: { code: 'CAMPAIGN_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create campaign.' } });
  }
});

router.patch('/campaigns/:id/status', requirePermission('Training', 'edit'), async (req, res) => {
  try {
    const status = req.body?.status;
    if (!['active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ data: null, error: { code: 'INVALID_STATUS', message: 'A supported campaign status is required.' } });
    }
    const result = await trainingCoursesRepo.transitionAwarenessCampaign(getWorkspaceId(req), req.params.id, status as AwarenessCampaignStatus);
    if (!result) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Awareness campaign not found.' } });
    await recordActivity(buildActivityFromRequest(req, {
      action: 'awareness_campaign_status_changed', category: 'training', targetType: 'awareness_campaign',
      targetId: result.after.id, targetName: result.after.title, previousValue: result.before, newValue: result.after,
      outcome: 'success', severity: status === 'cancelled' ? 'high' : 'medium', source: 'backend',
    }));
    return res.json({ data: result.after, error: null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'CAMPAIGN_UPDATE_FAILED';
    return res.status(code === 'INVALID_TRANSITION' ? 409 : 500).json({ data: null, error: { code, message: error instanceof Error ? error.message : 'Failed to update campaign.' } });
  }
});

export default router;
