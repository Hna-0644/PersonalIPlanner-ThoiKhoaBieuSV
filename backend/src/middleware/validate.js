const { toDatabaseId } = require('../utils/public-id');

function validate(schema, property = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      return next(result.error);
    }
    req[property] = result.data;
    return next();
  };
}

function validateId(type) {
  return (req, res, next) => {
    try {
      req.databaseId = toDatabaseId(req.params.id, type);
      return next();
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = { validate, validateId };
