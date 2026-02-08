// Validation Middleware Helpers

/**
 * Validate that an ID parameter is a valid positive integer
 */
exports.validateIdParam = (paramName) => (req, res, next) => {
  const id = req.params[paramName];
  if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
    return res.status(400).json({ error: `Invalid ${paramName}` });
  }
  req.params[paramName] = parseInt(id);
  next();
};

/**
 * Validate required fields in request body
 */
exports.validateRequired = (fields) => (req, res, next) => {
  const missing = fields.filter(field => {
    const value = req.body[field];
    return value === undefined || value === null || value === '';
  });
  
  if (missing.length > 0) {
    return res.status(400).json({ 
      error: `Missing required fields: ${missing.join(', ')}` 
    });
  }
  next();
};

/**
 * Validate enum values
 */
exports.validateEnum = (field, allowedValues, required = true) => (req, res, next) => {
  const value = req.body[field];
  
  if (!value) {
    if (required) {
      return res.status(400).json({ error: `${field} is required` });
    }
    return next();
  }
  
  if (!allowedValues.includes(value)) {
    return res.status(400).json({ 
      error: `Invalid ${field}. Allowed values: ${allowedValues.join(', ')}` 
    });
  }
  next();
};

/**
 * Validate numeric value
 */
exports.validateNumeric = (field, options = {}) => (req, res, next) => {
  const value = req.body[field];
  const { required = false, min, max, allowZero = true } = options;
  
  if (value === undefined || value === null || value === '') {
    if (required) {
      return res.status(400).json({ error: `${field} is required` });
    }
    return next();
  }
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return res.status(400).json({ error: `${field} must be a number` });
  }
  
  if (!allowZero && numValue === 0) {
    return res.status(400).json({ error: `${field} cannot be zero` });
  }
  
  if (min !== undefined && numValue < min) {
    return res.status(400).json({ error: `${field} must be at least ${min}` });
  }
  
  if (max !== undefined && numValue > max) {
    return res.status(400).json({ error: `${field} cannot exceed ${max}` });
  }
  
  req.body[field] = numValue;
  next();
};

/**
 * Validate date format
 */
exports.validateDate = (field, required = false) => (req, res, next) => {
  const value = req.body[field];
  
  if (!value) {
    if (required) {
      return res.status(400).json({ error: `${field} is required` });
    }
    return next();
  }
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: `${field} must be a valid date` });
  }
  next();
};

/**
 * Validate array field
 */
exports.validateArray = (field, options = {}) => (req, res, next) => {
  const value = req.body[field];
  const { required = false, minLength = 0 } = options;
  
  if (!value) {
    if (required) {
      return res.status(400).json({ error: `${field} is required` });
    }
    return next();
  }
  
  if (!Array.isArray(value)) {
    return res.status(400).json({ error: `${field} must be an array` });
  }
  
  if (value.length < minLength) {
    return res.status(400).json({ error: `${field} must have at least ${minLength} item(s)` });
  }
  
  next();
};

/**
 * Sanitize string fields (trim whitespace)
 */
exports.sanitizeStrings = (fields) => (req, res, next) => {
  fields.forEach(field => {
    if (typeof req.body[field] === 'string') {
      req.body[field] = req.body[field].trim();
    }
  });
  next();
};
