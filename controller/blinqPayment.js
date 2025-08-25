const express = require('express');
const crypto = require('crypto');
const Admin = require('../models/Admin/Admin');
const Doctor = require('../models/Doctor/doctors');
const Pharmacy = require('../models/Pharmacy/pharmacy');
const Laboratory = require('../models/Laboratory/laboratory');
const RentACar = require('../models/Rent A Car/rentCar');
const Hotel = require('../models/Hotel/hotel');
const Insurance = require('../models/Insurance/insurance');
const DonationCompany = require('../models/Donation/donationCompany');
const TravelAgency = require('../models/Travel Agency/travelAgency');
const AmbulanceCompany = require('../models/Ambulance/ambulanceCompany');
const Pharmaceutical = require('../models/Pharmaceutical/pharmaceutical');
const User = require('../models/User/user');
const Appointment = require('../models/All Doctors Models/appointment');
const AppointmentRequest = require('../models/All Doctors Models/request');
const Hospital = require('../models/Hospital/hospital');
const Order = require('../models/order');
const AmbulanceBooking = require('../models/Ambulance/booking');
const AmbulanceBid = require('../models/Ambulance/bid');
const DonationBooking = require('../models/Donation/donations');
const InsuranceBooking = require('../models/Insurance/insuranceBooking');
const AgencyBooking = require('../models/Travel Agency/booking');
const RentCarBooking = require('../models/Rent A Car/acceptedRequests');
const MedicineRequest = require('../models/Pharmacy/medicineRequest');
const HotelRequest = require('../models/Hotel/bookHotelRequest');
const HotelBooking = require('../models/Hotel/bookhotel');
const FlightBidRequest = require('../models/Travel Agency/bid');
const UserRequest = require('../models/Ambulance/ambRequest');
const Notification = require('../models/notification');
const bodyParser = require('body-parser');
const stripePaymentTransaction = require("../models/stripeTransactions");
const { sendchatNotification } = require("../firebase/service");
const dotenv = require("dotenv").config();
const app = express();

app.use(express.json());

const clientSecret = process.env.blinqClientSecret;
app.use(bodyParser.urlencoded({ extended: true }));
function verifyEncryptedFormData(data, clientSecret) {
    const encryptedFormData = data.encryptedFormData;
    delete data.encryptedFormData; // Remove encrypted form data from the data object

    // Create the string to be hashed
    const stringBeforeHash = [
        data.status,
        data.ordId,
        data.paymentCode,
        clientSecret
    ].join('');

    // Calculate the hash
    const hash = crypto.createHash('sha256').update(stringBeforeHash).digest('hex');
    const stringAfterHash = crypto.createHash('md5').update(hash).digest('hex');

    // Verify the hash
    return encryptedFormData === stringAfterHash;
}

function generateDataIntegrityHash(invoiceNumber, secret) {
    console.log("in generateDataIntegrityHash")
    // Step 1: Generate SHA256 hash
    const sha256Hash = crypto.createHash('sha256').update(invoiceNumber + secret).digest('hex');
    console.log("sha256Hash", sha256Hash)
    // Step 2: Generate MD5 hash of SHA256 hash
    const md5Hash = crypto.createHash('md5').update(sha256Hash).digest('hex');
    console.log("md5Hash", md5Hash)
    return md5Hash;
}

const blinqPaymentController = {
    async invoiceCallback(req, res, next) {
        try {
            const {
                data_integrity,
                paid_on,
                invoice_number,
                invoice_status,
                payment_code,
                payment_id,
                ref_number,
                paid_bank,
                amount,
                amount_paid,
                net_amount,
                txnFee,
                paid_via
            } = req.body;

            // Validate required fields
            // if (!data_integrity || !paid_on || !invoice_number || !invoice_status || !payment_code || !ref_number || !paid_bank || !amount || !amount_paid || !net_amount || !txnFee || !paid_via) {
            //     return res.status(400).json({
            //         code: '01',
            //         message: 'Invalid Data!',
            //         status: 'failure'
            //     });
            // }

            // // // Generate expected data integrity hash
            // const expectedDataIntegrity = generateDataIntegrityHash(invoice_number, clientSecret);

            // // // Validate the provided data_integrity
            // if (data_integrity !== expectedDataIntegrity) {
            //     return res.status(401).json({
            //         code: '01',
            //         message: 'Invalid data integrity',
            //         status: 'failure'
            //     });
            // }

            // Process the invoice

            console.log("invoice_number", invoice_number)
            // Update appointment status and payment details based on invoice status
            if (invoice_status === 'PAID') {
                console.log("in paid")
                const appointment = await Appointment.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" });
                const appointmentRequest = await AppointmentRequest.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" });
                const labOrder = await Order.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" }).populate("userId vendorId")
                const ambulanceBooking = await AmbulanceBooking.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" });
                const donationBooking = await DonationBooking.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" }).populate("userId companyId")
                const insuranceBooking = await InsuranceBooking.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" })
                const agencyBooking = await AgencyBooking.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" }).populate("userId agencyId tourId")
                const rentCarBooking = await RentCarBooking.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" })
                const medicineRequest = await MedicineRequest.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" }).populate("patientId doctorId")
                const hotelRequest = await HotelRequest.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" })
                const hotelBooking = await HotelBooking.findOne({ 'paymentId.id': invoice_number, 'paymentId.status': "pending" })
                // .populate("patientId doctorId")
                // .populate("userId agencyId tourId")
                // if (!appointment && !appointmentRequest) {
                //     return res.status(404).json({
                //         code: '02',
                //         message: 'Appointment/ Appointment Request not found',
                //         status: 'failure'
                //     });
                // }
                if (appointment !== null) {
                    await Appointment.updateOne(
                        {
                            _id: appointment._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    const amountPaid = parseFloat(amount_paid)
                    const transactionFee = parseFloat(txnFee)
                    appointment.isPaidFull = true;
                    appointment.paidByUserAmount += amountPaid;
                    appointment.processingFee += transactionFee;
                    await appointment.save();
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: appointment._id,
                        idModelType: 'Appointment',
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull: false
                    });
                    await stripePaymentToRegister.save();
                    const user = await User.findById(appointment.patientId);
                    const doctor = await Doctor.findById(appointment.doctorId);
                    const hospital = appointment.hospital ? await Hospital.findById(appointment.hospital) : null;

                    const admins = await Admin.find({});
                    const notificationMessage = appointment.appointmentType === 'hospital'
                        ? `Payment of ${amount_paid} was successfully completed for appointment at ${hospital ? hospital.name : 'Hospital'} with Dr. ${doctor.name} by ${user.name}.`
                        : `Payment of ${amount_paid} was successfully completed for Dr. ${doctor.name} (${appointment.appointmentType}) by ${user.name}.`;

                    const notifications = admins.map(admin => ({
                        senderId: user._id,
                        senderModelType: 'Users',
                        receiverId: admin._id,
                        receiverModelType: 'Admin',
                        title: 'Payment Received',
                        message: notificationMessage
                    }));

                    await Notification.insertMany(notifications);
                    admins.forEach(admin => {
                        sendchatNotification(
                            admin._id,
                            { title: 'Payment Received', message: notificationMessage },
                            'admin'
                        );
                    });
                } else if (appointmentRequest !== null) {
                    await AppointmentRequest.updateOne(
                        {
                            _id: appointmentRequest._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    appointmentRequest.paidByUserAmount = amount_paid;
                    appointmentRequest.processingFee = txnFee;
                    await appointmentRequest.save();
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: appointmentRequest._id,
                        idModelType: 'AppointmentRequest',
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull: false
                    });
                    await stripePaymentToRegister.save();
                    const user = await User.findById(appointmentRequest.patientId);
                    const doctor = await Doctor.findById(appointmentRequest.doctorId);
                    const hospital = appointmentRequest.hospital ? await Hospital.findById(appointmentRequest.hospital) : null;
                    const appointmentType = appointmentRequest.appointmentType

                    const admins = await Admin.find({});
                    const notificationMessage = (() => {
                        if (appointmentType === "hospital") {
                            console.log("safdghsgfdjhasfdhdjhfjhs");
                            return `New appointment request for ${hospital.name} with ${doctor.name} received from ${user.name} with the payment of ${amount_paid}.`;
                        } else {
                            return `New appointment request for ${doctor.name} (${appointmentType}) received from ${user.name} with the payment of ${amount_paid}.`;
                        }
                    })();

                    const notifications = admins.map(admin => ({
                        senderId: user._id,
                        senderModelType: 'Users',
                        receiverId: admin._id,
                        receiverModelType: 'Admin',
                        title: 'Payment Received',
                        message: notificationMessage
                    }));

                    await Notification.insertMany(notifications);
                    admins.forEach(admin => {
                        sendchatNotification(
                            admin._id,
                            { title: 'Payment Received', message: notificationMessage },
                            'admin'
                        );
                    });
                } else if (ambulanceBooking !== null) {
                    await AmbulanceBooking.updateOne(
                        {
                            _id: ambulanceBooking._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    const bid = await AmbulanceBid.findById(ambulanceBooking.bidRequestId)
                    const requestId = bid.requestId;
                    const userRequest = await UserRequest.findById(requestId).populate("userId");

                    userRequest.status = "accept";
                    ambulanceBooking.paidByUserAmount = amount_paid;
                    ambulanceBooking.processingFee = txnFee;
                    await ambulanceBooking.save()
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: ambulanceBooking._id,
                        idModelType: "Ambulance Booking",
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull: true
                    });
                    stripeController = await stripePaymentToRegister.save();
                    bid.status = "booked";
                    const ambulanceId = bid.ambulanceId;
                    const userId = userRequest.userId._id;
                    const name = userRequest.userId.name;
                    await bid.save();

                    sendchatNotification(
                        ambulanceId,
                        {
                            title: "MediTour Global",
                            message: `Your bid request has been accepted by ${name}!`,
                        },
                        "Ambulance Company"
                    );
                    const notification = new Notification({
                        senderId: userId,
                        senderModelType: "Users",
                        receiverId: ambulanceId,
                        receiverModelType: "Ambulance Company",
                        title: "MediTour Global",
                        message: `Your bid request has been accepted by ${name}!`,
                    });
                    await notification.save();
                    // Fetch all admins
                    const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

                    // Create notifications for each admin
                    const adminNotifications = admins.map((admin) => ({
                        senderId: userId,
                        senderModelType: "Users",
                        receiverId: admin._id,
                        receiverModelType: "Admin",
                        title: "MediTour Global",
                        message: `Payment of ${amount_paid} received from ${name} for ${bid.ambulanceName}.`,
                    }));

                    // Insert notifications into the database
                    await Notification.insertMany(adminNotifications);

                    // Send chat notifications to all admins asynchronously
                    admins.forEach((admin) => {
                        sendchatNotification(
                            admin._id,
                            {
                                title: "MediTour Global",
                                message: `Payment of ${amount_paid} received from ${name} for ${bid.ambulanceName}.`,
                            },
                            "admin"
                        );
                    });
                } else if (donationBooking !== null) {
                    await DonationBooking.updateOne(
                        {
                            _id: donationBooking._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    donationBooking.paidByUserAmount = amount_paid;
                    donationBooking.processingFee = txnFee;
                    await donationBooking.save();
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: donationBooking._id,
                        idModelType: "Donations",
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull: true,
                    });
                    stripeController = await stripePaymentToRegister.save();

                    if (donationBooking) {
                        // Determine vendorId based on your application logic
                        const vendorId = donationBooking.companyId; // Adjust this logic based on how vendorId is determined
                        const userId = donationBooking.userId._id; // Adjust this logic based on how vendorId is determined

                        // Send chat notification to vendor
                        const donorName = donationBooking.userId.name
                        const companyName = donationBooking.companyId.name
                        sendchatNotification(
                            vendorId,
                            {
                                title: "MediTour Global",
                                message: `You have a new donation from ${donorName} for ${companyName}.`,
                            },
                            "Donation"
                        );

                        // Create and save a notification
                        const notification = new Notification({
                            senderId: userId,
                            senderModelType: "Users",
                            receiverId: vendorId,
                            receiverModelType: "Donation Company",
                            title: "MediTour Global",
                            message: ` You have a new donation from ${donorName} for ${companyName}.`,
                        });
                        await notification.save();
                        // Fetch all admins
                        const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

                        // Create notifications for each admin
                        const adminNotifications = admins.map((admin) => ({
                            senderId: userId,
                            senderModelType: "Users",
                            receiverId: admin._id,
                            receiverModelType: "Admin",
                            title: "MediTour Global",
                            message: `Payment of ${paidByUserAmount} received from ${donorName} for ${companyName}.`,
                        }));

                        // Insert notifications into the database
                        await Notification.insertMany(adminNotifications);

                        // Send chat notifications to all admins asynchronously
                        admins.forEach((admin) => {
                            sendchatNotification(
                                admin._id,
                                {
                                    title: "MediTour Global",
                                    message: `Payment of ${paidByUserAmount} received from ${donorName} for ${companyName}.`,
                                },
                                "admin"
                            );
                        });
                    }

                }
                else if (insuranceBooking !== null) {
                    await InsuranceBooking.updateOne(
                        {
                            _id: insuranceBooking._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    insuranceBooking.paidByUserAmount = amount_paid;
                    insuranceBooking.processingFee = txnFee;
                    const userId = insuranceBooking.userId;
                    const receiverId = insuranceBooking.insuranceCompanyId;
                    const insuranceFor = insuranceBooking.insuranceFor;
                    await insuranceBooking.save();
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: newInsuranceRequest._id,
                        idModelType: "Insurance Request",
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull: true,
                    });
                    stripeController = await stripePaymentToRegister.save();
                    const user = await User.findById(userId);

                    sendchatNotification(
                        receiverId,
                        {
                            title: "MediTour Global",
                            message: `A new insurance request has been received.`,
                        },
                        "insurance"
                    );

                    // Create and save a notification
                    const notification = new Notification({
                        senderId: userId,
                        senderModelType: "Users",
                        receiverId: receiverId,
                        receiverModelType: "Insurance",

                        title: "MediTour Global",
                        message: "A new insurance request has been submitted",
                    });
                    await notification.save();
                    // Fetch all admins
                    const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

                    // Create notifications for each admin
                    const adminNotifications = admins.map((admin) => ({
                        senderId: userId,
                        senderModelType: "Users",
                        receiverId: admin._id,
                        receiverModelType: "Admin",
                        title: "MediTour Global",
                        message: `Payment of ${amount_paid} received from ${user.name} for insurance ${insuranceFor}.`,
                    }));

                    // Insert notifications into the database
                    await Notification.insertMany(adminNotifications);

                    // Send chat notifications to all admins asynchronously
                    admins.forEach((admin) => {
                        sendchatNotification(
                            admin._id,
                            {
                                title: "MediTour Global",
                                message: `Payment of ${amount_paid} received from ${user.name} for insurance ${insuranceFor}`,
                            },
                            "admin"
                        );
                    });
                } else if (agencyBooking !== null && agencyBooking.requestType == "flight") {
                    await AgencyBooking.updateOne(
                        {
                            _id: agencyBooking._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    agencyBooking.paidByUserAmount = amount_paid;
                    agencyBooking.processingFee = txnFee;
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: agencyBooking._id,
                        idModelType: "Agency Booking",
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull: true,
                    });
                    stripeController = await stripePaymentToRegister.save();
                    const bidId = agencyBooking.bidRequestId;
                    const agencyId = agencyBooking.agencyId._id;
                    const userId = agencyBooking.userId._id;
                    const bid = await FlightBidRequest.findById(bidId)

                    // Step 11: Update the bid request status to 'booked'
                    bid.status = "booked";
                    await bid.save();

                    // Step 12: Send a chat notification to the agency (ensure sendchatNotification is defined)
                    sendchatNotification(
                        agencyId, // Use the populated agency ID
                        {
                            title: "MediTour Global",
                            message: "Your bid request has been accepted!",
                        },
                        "agency"
                    );

                    // Step 13: Create a new notification record for the agency
                    const notification = new Notification({
                        senderId: userId, // The user who accepted the bid
                        senderModelType: "Users",
                        receiverId: agencyId, // The agency receiving the notification
                        receiverModelType: "Travel Agency",
                        title: "MediTour Global",
                        message: "Your bid request has been accepted!",
                        createdAt: new Date(), // Timestamp for when the notification is created
                    });
                    await notification.save();
                    // Notify admins
                    //   const admins = await Admin.find(); // Adjust this to match your admin retrieval logic
                    //   const name = agencyBooking.userId.name;

                    //   const adminNotifications = admins.map((admin) => ({
                    //     senderId: userId,
                    //     senderModelType: "Users",
                    //     receiverId: admin._id,
                    //     receiverModelType: "Admin",
                    //     title: "MediTour Global",
                    //     message: `${name} paid ${amount_paid} for ${flightRequest.flightClass} ${flightRequest.requestType} flight with ${agency.name} `,
                    //   }));

                    //   await Notification.insertMany(adminNotifications);

                    //   admins.forEach((admin) => {
                    //     sendchatNotification(
                    //       admin._id,
                    //       {
                    //         title: "MediTour Global",
                    //         message: `${name} paid ${amount_paid} for ${flightRequest.flightClass} ${flightRequest.requestType} flight ith ${agency.name} `,
                    //       },
                    //       "admin"
                    //     );
                    //   });
                } else if (agencyBooking !== null && agencyBooking.requestType == "tour") {
                    await AgencyBooking.updateOne(
                        {
                            _id: agencyBooking._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    // console.log("agencyBooking.paidByUserAmount", typeof agencyBooking.paidByUserAmount)
                    // console.log("agencyBooking.processingFee", typeof agencyBooking.processingFee)
                    // console.log("txnFee", txnFee)
                    const amountPaid = parseFloat(amount_paid)
                    const transactionFee = parseFloat(txnFee)
                    // function toNumber(value) {
                    //     const parsed = parseFloat(value);
                    //     return isNaN(parsed) ? 0 : parsed;
                    // }
                    try {
                        if (agencyBooking.paymentId.length < 2) {
                            console.log("anything")
                            agencyBooking.paidByUserAmount = amountPaid
                            agencyBooking.processingFee = transactionFee
                        } else {
                            console.log("anything2233")
                            agencyBooking.paidByUserAmount += amountPaid
                            agencyBooking.processingFee += transactionFee
                        }
                        // Process paidByUserAmount if it exists
                        // if (agencyBooking.paidByUserAmount) {
                        //     const paidUserAmount = toNumber(agencyBooking.paidByUserAmount);
                        //     agencyBooking.paidByUserAmount = paidUserAmount; // Update the field with a valid number
                        //     // Update processingFee based on the valid paidUserAmount
                        //     agencyBooking.processingFee = toNumber(agencyBooking.processingFee) + toNumber(txnFee);
                        // }

                        // // Process processingFee if it exists
                        // if (agencyBooking.processingFee) {
                        //     const bookingFee = toNumber(agencyBooking.processingFee);
                        //     agencyBooking.processingFee = bookingFee + toNumber(txnFee);
                        // }
                    } catch (error) {
                        console.error("Error updating agencyBooking:", error);
                    }

                    // Ensure processingFee is a number before addition
                    // agencyBooking.processingFee = (typeof agencyBooking.processingFee === 'number' && !isNaN(agencyBooking.processingFee))
                    //     ? (agencyBooking.processingFee + txnFee)
                    //     : txnFee;
                    const actualPrice = agencyBooking.actualPrice;
                    const paidPrice = agencyBooking.paidByUserAmount + amount_paid
                    await agencyBooking.save()
                    if (actualPrice == paidPrice) {
                        isPaidFull = true
                    } else {
                        isPaidFull = false
                    }
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: agencyBooking._id,
                        idModelType: "Agency Booking",
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull
                    });
                    stripeController = await stripePaymentToRegister.save();
                    // Increment the bookedSeats field for the corresponding tour

                    const receiverId = agencyBooking.agencyId._id; // The agency ID to receive the notification
                    const agencyName = agencyBooking.agencyId.name; // The agency ID to receive the notification
                    const userId = agencyBooking.userId._id; // The agency ID to receive the notification

                    // Send chat notification to the agency
                    sendchatNotification(
                        receiverId,
                        {
                            title: "MediTour Global",
                            message: `A new tour booking request has been submitted for package ${agencyBooking.tourId.packageName} with ${agencyName}.`,
                        },
                        "agency"
                    );

                    // Create and save a notification document in the database
                    const notification = new Notification({
                        senderId: userId,
                        senderModelType: "Users",
                        receiverId: receiverId,
                        receiverModelType: "Travel Agency",
                        title: "MediTour Global",
                        message: `${agencyBooking.userId.name} paid ${amount_paid} for ${agencyBooking.tourId.packageName} with ${agencyName}. `,
                    });
                    await notification.save();
                    // Notify admins
                    const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

                    const adminNotifications = admins.map((admin) => ({
                        senderId: userId,
                        senderModelType: "Users",
                        receiverId: admin._id,
                        receiverModelType: "Admin",
                        title: "MediTour Global",
                        message: `${agencyBooking.userId.name} paid ${amount_paid} for ${agencyBooking.tourId.packageName} with ${agencyName}. `,
                    }));

                    await Notification.insertMany(adminNotifications);

                    admins.forEach((admin) => {
                        sendchatNotification(
                            admin._id,
                            {
                                title: "MediTour Global",
                                message: `${agencyBooking.userId.name} paid ${amount_paid} for ${agencyBooking.tourId.packageName} with ${agencyName}. `,
                            },
                            "admin"
                        );
                    });
                } else if (rentCarBooking !== null) {
                    await RentCarBooking.updateOne(
                        {
                            _id: rentCarBooking._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    const amountPaid = parseFloat(amount_paid)
                    const transactionFee = parseFloat(txnFee)
                    if (rentCarBooking.paymentId.length < 2) {
                        console.log("anything")
                        rentCarBooking.paidByUserAmount = amountPaid
                        rentCarBooking.processingFee = transactionFee
                    } else {
                        console.log("anything2233")
                        rentCarBooking.paidByUserAmount += amountPaid
                        rentCarBooking.processingFee += transactionFee
                    }
                    const totalAmount = rentCarBooking.totalAmount;
                    const paidPrice = rentCarBooking.paidByUserAmount + amount_paid
                    await rentCarBooking.save()
                    if (totalAmount == paidPrice) {
                        isPaidFull = true
                    } else {
                        isPaidFull = false
                    }
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: rentCarBooking._id,
                        idModelType: "Accepted Vehicle Request",
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull
                    });
                    stripeController = await stripePaymentToRegister.save();
                    // Increment the bookedSeats field for the corresponding tour

                    //   const receiverId = agencyBooking.agencyId._id; // The agency ID to receive the notification
                    //   const agencyName = agencyBooking.agencyId.name; // The agency ID to receive the notification
                    //   const userId = agencyBooking.userId._id; // The agency ID to receive the notification

                    // Send chat notification to the agency
                    //   sendchatNotification(
                    //     receiverId,
                    //     {
                    //       title: "MediTour Global",
                    //       message: `A new tour booking request has been submitted for package ${agencyBooking.tourId.packageName} with ${agencyName}.`,
                    //     },
                    //     "agency"
                    //   );

                    // Create and save a notification document in the database
                    //   const notification = new Notification({
                    //     senderId: userId,
                    //     senderModelType: "Users",
                    //     receiverId: receiverId,
                    //     receiverModelType: "Travel Agency",
                    //     title: "MediTour Global",
                    //     message: `${agencyBooking.userId.name} paid ${amount_paid} for ${agencyBooking.tourId.packageName} with ${agencyName}. `,
                    //   });
                    //   await notification.save();
                    // Notify admins
                    //   const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

                    //   const adminNotifications = admins.map((admin) => ({
                    //     senderId: userId,
                    //     senderModelType: "Users",
                    //     receiverId: admin._id,
                    //     receiverModelType: "Admin",
                    //     title: "MediTour Global",
                    //     message: `${agencyBooking.userId.name} paid ${amount_paid} for ${agencyBooking.tourId.packageName} with ${agencyName}. `,
                    //   }));

                    //   await Notification.insertMany(adminNotifications);

                    //   admins.forEach((admin) => {
                    //     sendchatNotification(
                    //       admin._id,
                    //       {
                    //         title: "MediTour Global",
                    //         message: `${agencyBooking.userId.name} paid ${amount_paid} for ${agencyBooking.tourId.packageName} with ${agencyName}. `,
                    //       },
                    //       "admin"
                    //     );
                    //   });
                } else if (labOrder !== null) {
                    await Order.updateOne(
                        {
                            _id: labOrder._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    labOrder.paidByUserAmount = amount_paid;
                    labOrder.processingFee = txnFee;
                    const vendorId = labOrder.vendorId._id;
                    const userId = labOrder.userId._id;
                    labOrder.paymentConfirmation = true
                    await labOrder.save()
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: labOrder._id,
                        idModelType: "Order",
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull: true,
                    });
                    stripeController = await stripePaymentToRegister.save();

                    sendchatNotification(
                        vendorId,
                        {
                            title: "MediTour Global",
                            message: `You have a new order.`,
                        },
                        "lab"
                    );
                    const notification = new Notification({
                        senderId: userId,
                        senderModelType: "Users",
                        receiverId: vendorId,
                        receiverModelType: "Laboratory",
                        title: "MediTour Global",
                        message: "You have a new order",
                    });
                    await notification.save();
                    // Notify admins
                    const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

                    const adminNotifications = admins.map((admin) => ({
                        senderId: userId,
                        senderModelType: "Users",
                        receiverId: admin._id,
                        receiverModelType: "Admin",
                        title: "MediTour Global",
                        message: `${labOrder.userId.name} paid ${amount_paid} for ${labOrder.vendorId.name} `,
                    }));

                    await Notification.insertMany(adminNotifications);

                    admins.forEach((admin) => {
                        sendchatNotification(
                            admin._id,
                            {
                                title: "MediTour Global",
                                message: `${labOrder.userId.name} paid ${amount_paid} for ${labOrder.vendorId.name} `,
                            },
                            "admin"
                        );
                    });
                } else if (hotelRequest !== null) {
                    console.log("everything")
                    await HotelRequest.updateOne(
                        {
                            _id: hotelRequest._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    hotelRequest.paidByUserAmount = amount_paid;
                    hotelRequest.processingFee = txnFee;
                    console.log("anything")
                    await hotelRequest.save();
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: hotelRequest._id,
                        idModelType: 'Hotel Booking Requests',
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull: false
                    });
                    await stripePaymentToRegister.save();
                } else if (hotelBooking !== null) {
                    await HotelBooking.updateOne(
                        {
                            _id: hotelBooking._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    const amountPaid = parseFloat(amount_paid)
                    const transactionFee = parseFloat(txnFee)
                    console.log(typeof amount_paid)
                    hotelBooking.isPaidFull = true;
                    hotelBooking.paidByUserAmount += amountPaid;  // Ensure initial value is numeric
                    hotelBooking.processingFee += transactionFee;
                    await hotelBooking.save();
                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id: hotelBooking._id,
                        idModelType: 'Hotel Booking',
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull: false
                    });
                    await stripePaymentToRegister.save();
                }

                if (medicineRequest !== null || labOrder.combinedPayment) {
                    await MedicineRequest.updateOne(
                        {
                            _id: medicineRequest._id,
                            'paymentId.id': invoice_number,
                            'paymentId.status': "pending"
                        },
                        {
                            $set: {
                                'paymentId.$.status': "completed"
                            }
                        }
                    );
                    medicineRequest.paidByUserAmount = amount_paid;
                    medicineRequest.processingFee = txnFee;
                    medicineRequest.paymentConfirmation = true;
                    await medicineRequest.save();
                    const id = medicineRequest._id;
                    const idModelType = "MedicineRequest";

                    const stripePaymentToRegister = new stripePaymentTransaction({
                        id,
                        idModelType,
                        paymentId: invoice_number,
                        gatewayName: "blinq",
                        paidByUserAmount: amount_paid,
                        isPaidFull: true,
                    });
                    const stripeController = await stripePaymentToRegister.save();
                    const notificationMessage = `We have a new medicine request.`;
                    const admins = await Admin.find({});
                    const patientId = medicineRequest.patientId._id
                    const notifications = admins.map((admin) => ({
                        senderId: patientId,
                        senderModelType: "Users",
                        receiverId: admin._id,
                        receiverModelType: "Admin",
                        title: "MediTour Global",
                        message: notificationMessage,
                        createdAt: new Date(), // Set the creation date for notifications
                    }));

                    // Insert notifications into the database in bulk for efficiency
                    await Notification.insertMany(notifications);

                    // Send chat notifications to all admins asynchronously
                    admins.forEach((admin) => {
                        sendchatNotification(
                            admin._id,
                            {
                                title: "MediTour Global",
                                message: notificationMessage,
                            },
                            "admin"
                        );
                    });

                // Send success response
                res.json({
                    code: '00',
                    message: 'Invoice successfully marked as paid',
                    status: 'success',
                    invoice_number
                });
            }
        }
        } catch (error) {
            console.error('Error handling invoice callback:', error);
            next(error);
        }
    },

    async paymentResponse(req, res, next) {
        const data = req.body;

        // Verify the encrypted form data
        if (verifyEncryptedFormData(data, clientSecret)) {
            if (data.status === 'Success') {
                console.log("success case")
                // Handle successful payment
                // E.g., update order status, send confirmation email, etc.
                res.send(`Payment successful. Order ID: ${data.ordId}`);
            } else {
                // Handle failed payment
                // E.g., log error, notify user, etc.
                res.send(`Payment failed. Message: ${data.message}`);
            }
        } else {
            // Handle verification failure
            res.send('Invalid request data. Verification failed.');
        }
    }

}

module.exports = blinqPaymentController;
