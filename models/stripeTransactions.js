const mongoose = require('mongoose');

const stripeTransactionSchema = new mongoose.Schema({
    id: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "idModelType",
    },
    idModelType: {
        type: String,
        enum: [
            "Order",
            "Appointment",
            "AppointmentRequest",
            "Donations",
            "Agency Booking",
            "Insurance Request",
            "Ambulance Booking",
            "Accepted Vehicle Request",
            "Hotel Booking Requests",
            "Hotel Booking",
            "MedicineRequest",
        ],
        required: true
    },
    paymentId: {
        type: String,
        required: true
    },
    gatewayName: {
        type: String,
        enum: [
            "stripe",
            "alfalah",
            "blinq"
        ],
        required: true
    },
    paidByUserAmount: {
        type: Number,
        required: true
    },
    isPaidFull: {
        type: Boolean,
        required: true
    }
},
    {
        timestamps: true,
    });

module.exports = mongoose.model('Stripe Transactions', stripeTransactionSchema, 'stripe transactions');