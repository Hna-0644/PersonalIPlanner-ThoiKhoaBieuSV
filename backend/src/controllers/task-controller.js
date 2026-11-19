const { asyncHandler } = require('../utils/async-handler');

function createTaskController(taskServiceInput) {
  const taskService = taskServiceInput?.taskService || taskServiceInput;

  const listTasks = asyncHandler(async (req, res) => {
    const data = await taskService.list(req.user.id);
    res.json({ data });
  });

  const createTask = asyncHandler(async (req, res) => {
    const data = await taskService.create(req.user.id, req.body);
    res.status(201).json({ data });
  });

  const updateTask = asyncHandler(async (req, res) => {
    const data = await taskService.update(req.user.id, req.databaseId, req.body);
    res.json({ data });
  });

  const deleteTask = asyncHandler(async (req, res) => {
    const data = await taskService.remove(req.user.id, req.databaseId);
    res.json({ data });
  });

  return {
    listTasks,
    createTask,
    updateTask,
    deleteTask
  };
}

module.exports = { createTaskController };
