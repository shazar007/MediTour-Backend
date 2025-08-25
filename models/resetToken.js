const mongoose = require('mongoose');

const resetTokenSchema = new mongoose.Schema({
    token: String,
    email: String,
    userType: String
},
{
  timestamps: true,
});

// Create a model for the reset tokens collection
module.exports = mongoose.model('ResetToken', resetTokenSchema, 'reset tokens');