const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    //Both
    orderId: {
      type: String,
      required: true,
    },
    isPaidFull: {
      type: Boolean,
      default: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment", // Assuming you have an Appointment schema
    },
    paymentId: [
      {
        id: String,
        status: {
          type: String,
          enum: ["pending", "completed", "rejected"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment", // Reference to the Appointment schema
    },    
    paidByUserAmount: {
      type: Number,
    },
    processingFee: {
      type: Number,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Laboratory",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    items: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Tests",
        },
        quantity: {
          type: Number,
          default: 1, // Default quantity if not specified
        },
      },
    ],
    preference: {
      type: String,
      enum: ["visit", "homeSample"],
    },
    currentLocation: {
      lat: String,
      lng: String,
      address: String,
      city: String,
    },
    results: {
      type: String,
    },
    prescription: {
      type: String,
    },
    customerName: {
      type: String,
      required: true,
    },
    MR_NO: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "inProcess", "completed"],
      default: "pending",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    dollarAmount: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      required: true,
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    paidToVendor: {
      type: Boolean,
      required: true,
      default: false,
    },
    combinedPayment: {
      type: Boolean,
      required: true,
      default: false,
    },
    paymentConfirmation: {
      type: Boolean,
      required: true,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    gatewayName: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
  }
);

orderSchema.pre("save", function (next) {
  if (!this.paymentConfirmation) {
    this.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  } else {
    this.expiresAt = null;
  }
  next();
});

orderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Order", orderSchema, "orders");
