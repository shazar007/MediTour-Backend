// const mongoose = require("mongoose");

// const treatmentsSchema = new mongoose.Schema(
//   {
//     doctorId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Doctor",
//       required: true,
//     },
//     treatmentId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Treatment",
//       required: true,
//     },
//     treatment: {
//       appointmentCharges: Boolean,
//       medicines: Boolean,
//       labService: Boolean,
//       hospitalization: {
//         type: mongoose.Schema.Types.Mixed, // Mixed type to allow flexible data
//         validate: {
//           validator: function (value) {
//             // Validate that the value is either "ward" or an object with "ac" or "nonAc"
//             if (value === "ward") return true;
//             if (typeof value === "object" && value !== null) {
//               return Object.keys(value).every((key) =>
//                 ["ac", "nonAc"].includes(key)
//               );
//             }
//             return false;
//           },
//           message:
//             'Hospitalization must be either "ward" or an object with "ac" or "nonAc" fields.',
//         },
//       },
//       other: String,
//     },
//     totalAmount: Number,
//     hospitalId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Hospital",
//     },
//     isPersonal: {
//       type: Boolean,
//       required: true,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );
// const BookTreatment = mongoose.model(
//   "BookTreatment",
//   treatmentsSchema,
//   "book treatments"
// );

// module.exports = BookTreatment;
const mongoose = require("mongoose");

const treatmentsSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: false, // Optional if the hospital is adding the treatment
    },
    treatmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Treatment",
      required: true,
    },
    treatment: {
      appointmentCharges: Boolean,
      medicines: Boolean,
      labService: Boolean,
      hospitalization: {
        type: mongoose.Schema.Types.Mixed, // Mixed type to allow flexible data
        validate: {
          validator: function (value) {
            // Validate that the value is either "ward" or an object with "ac" or "nonAc"
            if (value === "ward") return true;
            if (typeof value === "object" && value !== null) {
              return Object.keys(value).every((key) =>
                ["ac", "nonAc"].includes(key)
              );
            }
            return false;
          },
          message:
            'Hospitalization must be either "ward" or an object with "ac" or "nonAc" fields.',
        },
      },
      other: String,
    },
    totalAmount: {
      type: Number,
      required: true, // Total amount is required
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: false, // Optional when doctor is adding the treatment
    },
    isPersonal: {
      type: Boolean,
      required: true,
    },
    addedBy: {
      type: String,
      enum: ["doctor", "hospital"], // Validates that only doctor or hospital can add the treatment
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const BookTreatment = mongoose.model(
  "BookTreatment",
  treatmentsSchema,
  "book treatments"
);

module.exports = BookTreatment;
