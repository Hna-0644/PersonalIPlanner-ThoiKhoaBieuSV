const { asyncHandler } = require('../utils/async-handler');

function createClassController(classService) {
  const listClasses = asyncHandler(async (req, res) => {
    res.json({ data: await classService.list(req.user.id) });
  });

  const createClass = asyncHandler(async (req, res) => {
    res.status(201).json({ data: await classService.create(req.user.id, req.body) });
  });

  const updateClass = asyncHandler(async (req, res) => {
    res.json({ data: await classService.update(req.user.id, req.databaseId, req.body) });
  });

  const deleteClass = asyncHandler(async (req, res) => {
    res.json({ data: await classService.remove(req.user.id, req.databaseId) });
  });

  return {
    listClasses,
    createClass,
    updateClass,
    deleteClass
  };
}

function createWorkScheduleController(workScheduleService) {
  const listWorkSchedules = asyncHandler(async (req, res) => {
    res.json({ data: await workScheduleService.list(req.user.id) });
  });

  const createWorkSchedule = asyncHandler(async (req, res) => {
    res.status(201).json({ data: await workScheduleService.create(req.user.id, req.body) });
  });

  const updateWorkSchedule = asyncHandler(async (req, res) => {
    res.json({ data: await workScheduleService.update(req.user.id, req.params.id, req.body) });
  });

  const deleteWorkSchedule = asyncHandler(async (req, res) => {
    await workScheduleService.remove(req.user.id, req.params.id);
    res.json({ data: { success: true } });
  });

  return {
    listWorkSchedules,
    createWorkSchedule,
    updateWorkSchedule,
    deleteWorkSchedule
  };
}

function createScheduleController(scheduleService) {
  const listEvents = asyncHandler(async (req, res) => {
    res.json({ data: await scheduleService.listEvents(req.user.id) });
  });

  const autoGenerate = asyncHandler(async (req, res) => {
    const data = await scheduleService.generate(req.user.id, req.body);
    res.json({ data });
  });

  const applyPlan = asyncHandler(async (req, res) => {
    const data = await scheduleService.apply(
      req.user.id,
      req.body.plan,
      req.body.breakMinutes,
      req.body.timezone
    );
    res.json({ data });
  });

  return {
    listEvents,
    autoGenerate,
    applyPlan
  };
}

function createAiController(aiVisionService, profileService) {
  const scanSchedule = asyncHandler(async (req, res) => {
    const { image, periodFormat } = req.body;
    const profile = await profileService.getProfile(req.user.id);
    const result = await aiVisionService.scanScheduleImage({
      image,
      periodFormat,
      university: profile.university
    });
    res.json({ data: result });
  });

  return {
    scanSchedule
  };
}

module.exports = {
  createClassController,
  createWorkScheduleController,
  createScheduleController,
  createAiController
};
