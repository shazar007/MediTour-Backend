const mongoose = require("mongoose");

const ePrescriptionSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    medicines: [
      {
        medicineId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Medicines",
          required: true,
        },
        medicineName: {
          type: String,
        },
        dosage: {
          type: String,
        },
        route: {
          type: String,
        },
        frequency: {
          type: String,
        },
        days: {
          type: Number,
        },
        instruction: {
          type: String,
        },
        quantity: {
          type: Number,
        },
        price: {
          type: Number,
        }
      },
    ],
    medicineOnDiscount: {
      type: String,
      enum: ["yes", "No"],
    },
    test: [
      {
        testId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TestName", // Reference to the Tests collection
          required: true,
        },
        testName: {
          type: String,
        }
      },
    ],
    results: {
      type: String,
    },
    testfromMeditour: {
      type: String,
      enum: ["yes", "No"],
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
  },
  {
    timestamps: true,
  }
);

const ePrescription = mongoose.model(
  "ePrescription",
  ePrescriptionSchema,
  "e-prescription"
);

module.exports = ePrescription;
