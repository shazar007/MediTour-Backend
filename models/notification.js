const mongoose = require("mongoose");

const { Schema } = mongoose;

const notificationSchema = Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "senderModelType",
    },
    senderModelType: {
      type: String,
      enum: [
        "Users",
        "Laboratory",
        "Pharmacy",
        "Doctor",
        "Hospital",
        "Ambulance Company",
        "Donation Company",
        "Hotel",
        "Rent A Car",
        "Travel Agency",
        "Insurance",
        "Admin",
        "Pharmaceutical",
        "Doctor Company",
        "Travel Company"
      ],
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "receiverModelType",
    },
    receiverModelType: {
      type: String,
      enum: [
        "Users",
        "Laboratory",
        "Pharmacy",
        "Doctor",
        "Hospital",
        "Ambulance Company",
        "Donation Company",
        "Hotel",
        "Rent A Car",
        "Travel Agency",
        "Insurance",
        "Admin",
        "vendorModelType",
        "Pharmaceutical",
        "Doctor Company",
        "Travel Company"
      ],
    },
    title: {
      type: String,
    },
    message: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 7 * 24 * 60 * 60,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Notification",
  notificationSchema,
  "notifications"
);
