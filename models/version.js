const mongoose = require("mongoose");

const { Schema } = mongoose;

const versionSchema = new Schema({
  version: { type: Number, required: true },
},
{
  timestamps: true,
});

module.exports = mongoose.model("Version", versionSchema, "version");
