const { ValidationError } = require("joi");

const errorHandler = (error, req, res, next) => {
  // default error
  let status = 500;
  let data = {
    message: "Internal Server Error",
  };

  // Handle Joi validation errors
  if (error instanceof ValidationError) {
    status = 400; // Validation errors should return a 400 status code
    data.message = error.message;
    return res.status(status).json(data);
  }

  // Handle custom errors with status property
  if (error.status) {
    status = error.status;
  }

  // Handle errors with a message property
  if (error.message) {
    data.message = error.message;
  }

  // Send the response
  return res.status(status).json(data);
};

module.exports = errorHandler;
