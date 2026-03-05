import { Router } from 'express';
import type { ApiResponse, TrainingDashboard, CreateTrainingCourseInput } from '../types/models.js';
import { getWorkspaceId } from '../workspace.js';
import * as trainingCoursesRepo from '../repositories/trainingCoursesRepo.js';

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
    const completedAssignments = assignments.filter(a => a.status === 'completed').length;
    const overdueAssignments = assignments.filter(a => a.status === 'overdue').length;
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

    const overallCompletionRate = totalAssignments > 0
      ? Math.round((completedAssignments / totalAssignments) * 100)
      : 0;

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
        : 0;

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

export default router;
