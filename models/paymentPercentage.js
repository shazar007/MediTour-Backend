const mongoose = require('mongoose');

const paymentPercentageSchema = new mongoose.Schema({
    doctor: Number,
    hospital: Number,
    ambulance: Number,
    psychologist: Number,
    paramedic: Number,
    physiotherapist: Number,
    nutrition: Number,
    donation: Number,
    hotel: Number,
    rentCar: Number,
    travelAgency: Number,
    insurance: Number,
},
{
  timestamps: true,
});

module.exports = mongoose.model('Payment Percentage', paymentPercentageSchema, 'payment percentages');