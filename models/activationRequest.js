const mongoose = require("mongoose");

const { Schema } = mongoose;

const notificationSchema = Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "modelType",
    },
    modelType: {
      type: String,
      required: true
    },
    gatewayName: {
      type: String,
      required: true
    },
    paymentId: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Activation Request",
  notificationSchema,
  "activation requests"
);
