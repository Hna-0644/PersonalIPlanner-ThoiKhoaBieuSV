const express = require('express');
const { classSchema, classUpdateSchema } = require('../schemas');
const { validate, validateId } = require('../middleware/validate');
const { createClassController } = require('../controllers/timetable-controller');

function createClassRouter(classService, authenticate) {
  const router = express.Router();
  const controller = createClassController(classService);

  router.use(authenticate);
  router.get('/', controller.listClasses);
  router.post('/', validate(classSchema), controller.createClass);
  router.patch('/:id', validateId('class'), validate(classUpdateSchema), controller.updateClass);
  router.put('/:id', validateId('class'), validate(classUpdateSchema), controller.updateClass);
  router.delete('/:id', validateId('class'), controller.deleteClass);

  return router;
}

module.exports = { createClassRouter };
