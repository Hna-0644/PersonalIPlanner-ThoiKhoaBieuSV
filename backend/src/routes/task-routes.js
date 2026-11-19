const express = require('express');
const { taskSchema, taskUpdateSchema } = require('../schemas');
const { validate, validateId } = require('../middleware/validate');
const { createTaskController } = require('../controllers/task-controller');

function createTaskRouter(taskService, authenticate, taskController) {
  const router = express.Router();
  const controller = taskController || createTaskController(taskService);

  router.use(authenticate);
  router.get('/', controller.listTasks);
  router.post('/', validate(taskSchema), controller.createTask);
  router.patch('/:id', validateId('task'), validate(taskUpdateSchema), controller.updateTask);
  router.put('/:id', validateId('task'), validate(taskUpdateSchema), controller.updateTask);
  router.delete('/:id', validateId('task'), controller.deleteTask);

  return router;
}

module.exports = { createTaskRouter };
