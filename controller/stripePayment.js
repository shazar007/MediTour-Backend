const {
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_SECRET_KEY,
} = require("../config/index");
const stripe = require("stripe")(STRIPE_SECRET_KEY);

const stripePaymentController = {
  async createCheckoutSession(req, res, next) {
    try {
      let customerId;

      // Check if the customer already exists based on their email
      const customerList = await stripe.customers.list({
        email: req.body.email,
        limit: 1,
      });

      if (customerList.data.length !== 0) {
        customerId = customerList.data[0].id;
      } else {
        // Create a new customer
        const customer = await stripe.customers.create({
          email: req.body.email,
        });

        customerId = customer.id; // Accessing the correct property
      }

      // Create an ephemeral key for the customer
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: "2020-08-27" }
      );

      // Create a payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: parseInt(req.body.amount),
        currency: "usd",
        customer: customerId,
        receipt_email: req.body.email,
      });

      // Success
      res.status(200).send({
        success: true,
        customer: customerId,
        ephemeralKey: ephemeralKey.secret,
        paymentIntent: paymentIntent.client_secret,
      });
    } catch (error) {
      console.error(error); // Log the error for debugging purposes
      // Error
      res.status(500).send({
        success: false,
        error: error.message,
      });
    }
  },

  // async handleWebhookEvent(req, res, next) {
  //   const { type, data: { object } } = event;
  //   switch (type) {
  //     case 'checkout.session.completed':
  //       const checkoutSessionCompleted = object;
  //       console.log('Handling checkout.session.completed event');
  //       break;
  //     case 'checkout.session.async_payment_failed':
  //       const checkoutSessionAsyncPaymentFailed = object
  //       console.log('Handling checkout.session.async_payment_failed event');
  //       break;
  //     case 'checkout.session.async_payment_succeeded':
  //       const checkoutSessionAsyncPaymentSucceeded = object;
  //       console.log('Handling checkout.session.async_payment_succeeded event');
  //       break;
  //     case 'checkout.session.expired':
  //       const checkoutSessionExpired = object;
  //       console.log('Handling checkout.session.expired event');
  //       break;
  //     case 'payment_intent.created':
  //       console.log('payment_intent.created');
  //       break;
  //     case 'payment_intent.amount_capturable_updated':
  //       const paymentIntentAmountCapturableUpdated = event.data.object;
  //       console.log('payment_intent.amount_capturable_updated');
  //       break;
  //     case 'payment_intent.canceled':
  //       const paymentIntentCanceled = event.data.object;
  //       console.log('payment_intent.canceled');
  //       break;
  //     case 'payment_intent.partially_funded':
  //       const paymentIntentPartiallyFunded = event.data.object;
  //       console.log('payment_intent.partially_funded');
  //       break;
  //     case 'payment_intent.payment_failed':
  //       const paymentIntentPaymentFailed = event.data.object;
  //       console.log('payment_intent.payment_failed');
  //       break;
  //     case 'payment_intent.processing':
  //       const paymentIntentProcessing = event.data.object;
  //       console.log('payment_intent.processing');
  //       break;
  //     case 'payment_intent.requires_action':
  //       const paymentIntentRequiresAction = event.data.object;
  //       console.log('payment_intent.requires_action');
  //       break;
  //     case 'payment_intent.succeeded':
  //       const paymentIntentSucceeded = event.data.object;
  //       const paymentIntentId = paymentIntentSucceeded.id;
  //       console.log(paymentIntentSucceeded);

  //       stripe.charges
  //         .retrieve(paymentIntentSucceeded.latest_charge)
  //         .then((charge) => {
  //           const receiptUrl = charge.receipt_url;
  //           const receiptEmail = paymentIntentSucceeded.receipt_email;
  //           const data = {
  //             from: 'Excited User <mailgun@sandboxa62be9b929c541d4b76dc747dbe77602.mailgun.org>',
  //             to: receiptEmail,
  //             subject: 'Payment',
  //             text: 'Payment received!',
  //             html: `<h1>Payment receipt</h1><p>Receipt URL: ${receiptUrl}</p>`
  //           };

  //           mg.messages().send(data, (error, body) => {
  //             if (error) {
  //               console.log(error);
  //             } else {
  //               console.log(body);
  //             }
  //           });
  //         })
  //         .catch((error) => {
  //           console.log(error);
  //         });

  //       console.log('payment_intent.succeeded');
  //       break;
  //     default:
  //       console.log(`Unhandled event type ${type}`);
  //   }
  // },

  // app.post('/webhook', express.json({type: 'application/json'}), (request, response) => {
  //   const event = request.body;

  //   // Handle the event
  //   switch (event.type) {
  //     case 'payment_intent.succeeded':
  //       const paymentIntent = event.data.object;
  //       // Then define and call a method to handle the successful payment intent.
  //       // handlePaymentIntentSucceeded(paymentIntent);
  //       break;
  //     case 'payment_method.attached':
  //       const paymentMethod = event.data.object;
  //       // Then define and call a method to handle the successful attachment of a PaymentMethod.
  //       // handlePaymentMethodAttached(paymentMethod);
  //       break;
  //     // ... handle other event types
  //     default:
  //       console.log(`Unhandled event type ${event.type}`);
  //   }

  //   // Return a response to acknowledge receipt of the event
  //   response.json({received: true});
  // });

  // async createCheckoutSession1(req, res, next) {
  //   try {
  //     let price = req.body.price;
  //     price = Math.round(price)
  //     const session = await stripe.checkout.sessions.create({
  //       line_items: [
  //         {
  //           price: price,
  //           quantity: 1,
  //         },
  //       ],
  //       mode: 'payment',
  //       success_url: `https://www.google.com/`,
  //       cancel_url: `https://www.website.com/`,
  //     });
  //     res.redirect(303, session.url);
  //   } catch (error) {
  //     next(error)
  //   }
  // }
};

module.exports = stripePaymentController;
