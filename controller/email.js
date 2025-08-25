const transporter = require("../utils/gmail"); // Import Gmail transporter
const moment = require("moment");

/**
 * Sends an email to a vendor upon activation.
 * @param {Object} vendor - The vendor object containing details like name and email.
 * @param {String} receiverModelType - The type of vendor (e.g., "pharmacy", "hotel").
 */
async function sendVendorActivationEmail(vendor, receiverModelType) {
  const activationDate = moment().format("DD-MM-YYYY");

  const emailContent = `
  <div style="
      font-family: Arial, sans-serif;
      text-align: left;
      background-color: #f3f4f6;
      color: #555;
      padding: 20px;
      border-radius: 8px;
      max-width: 600px;
      margin: auto;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
  <h1 style="color: black;">Welcome, ${vendor.name}!</h1>
  <p style="color: black;">Thank you for completing your payment. We’re excited to let you know that your account has been successfully activated!</p>
  <p style="color: black;"><strong>Account Name:</strong> ${vendor.name}</p>
  <p style="color: black;"><strong>Activation Date:</strong> ${activationDate}</p>
  <p style="color: black;"><strong>Service:</strong> ${receiverModelType}</p>
  <p style="color: black;">You can now access your account and enjoy all the features we offer. To get started, simply click the button below:</p>
   <a href="https://meditour.global/joinVender" style="
        display: inline-block;
        background-color: #ff6600; 
        color: white;
        padding: 12px 30px;
        font-size: 16px;
        border-radius: 5px;
        text-decoration: none;
        margin-bottom: 20px;
      ">Open MediTour</a>
  <p style="color: black;">If you have any questions or encounter any issues, feel free to reach out to our support team at:</p>
  <p style="color: black;"><a href="mailto:info@meditour.global" style="color: blue; text-decoration: underline;">info@meditour.global</a></p>
  
  <p style="color: black;"><strong>Contact Numbers:</strong></p>
  <p style="color: black;">🇨🇦 Canada: +1(437) 259-5662</p>
  <p style="color: black;">🇬🇧 United Kingdom: +44-7710083013</p>
  <p style="color: black;">🇺🇸 United States: +1(813) 550-4999</p>
  <p style="color: black;">🇵🇰 Pakistan: +92-42-37885101-4 / +92-42-35191168</p>
  
  <p style="color: black;">Thank you for choosing MediTour.Global. We’re thrilled to have you with us!</p>
  <p style="color: black;">Warm regards,<br/>MediTour.Global<br/></div>
  `;

  const mailOptions = {
    from: '"MediTour.Global" <info@meditour.global>',
    to: vendor.email,
    subject: `Welcome! Your ${receiverModelType} Account is Now Active`,
    html: emailContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { status: true, message: `Activation email has been sent to ${vendor.email}` };
  } catch (error) {
    return { status: "failure", message: "Failed to send email." };
  }
}

async function sendAccountCreationEmail(
  doc,
  receiverModelType,
  hospitalName,
  docEmail,
  password
) {
  const activationDate = moment().format("DD-MM-YYYY");

  const emailContent = `
  <div style="
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      text-align: center;
      background-color: #f9f9fb;
      color: #444;
      padding: 40px;
      border-radius: 10px;
      max-width: 650px;
      margin: auto;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">
    <h1 style="color: #333; font-size: 32px; font-weight: bold;">Welcome, ${doc.name}!</h1>
    <p style="font-size: 18px; color: #333; margin-bottom: 20px;">We're excited to let you know that your account has been successfully created and activated! You have been added to a hospital named <strong>${hospitalName.name}</strong>. Get ready to explore all the amazing features we have in store for you.</p>
    
    <p style="font-size: 16px; color: #555; margin: 10px 0;">
      <strong style="font-weight: bold; color: #333;">Account Name:</strong> ${doc.name}
    </p>
    <p style="font-size: 16px; color: #555; margin: 10px 0;">
      <strong style="font-weight: bold; color: #333;">Creation Date:</strong> ${activationDate}
    </p>
    <p style="font-size: 16px; color: #555; margin: 10px 0;">
      <strong style="font-weight: bold; color: #333;">Service:</strong> ${receiverModelType}
    </p>
    
    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
      To log in to your account, use the following credentials:
    </p>

    <p style="font-size: 16px; color: #333; margin: 5px 0;">
      <strong style="font-weight: bold; color: #333;">Email:</strong> ${docEmail}
    </p>
    <p style="font-size: 16px; color: #333; margin: 5px 0;">
      <strong style="font-weight: bold; color: #333;">Password:</strong> ${password}
    </p>

    <p style="font-size: 16px; color: #333; margin-bottom: 30px;">
      You can now access your account and take full advantage of our services. To get started, just click the button below to log in:
    </p>
   
    <a href="https://meditour.global/login" style="
        display: inline-block;
        background-color: #ff6600;
        color: white;
        padding: 15px 30px;
        font-size: 18px;
        border-radius: 50px;
        text-decoration: none;
        transition: background-color 0.3s ease, transform 0.3s ease;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      ">Log in to MediTour</a>

    <p style="font-size: 16px; color: #333; margin-top: 30px;">
      If you have any questions or need assistance, don't hesitate to reach out to us at:
    </p>
    
    <p style="font-size: 16px; color: #333;">
      <a href="mailto:info@meditour.global" style="color: #ff6600; text-decoration: underline;">info@meditour.global</a> or call us at:
    </p>
    <p style="font-size: 16px; color: #333;">PAK: 0092-42-37885101-4, 0092-42-35191168</p>

    <p style="font-size: 16px; color: #333; margin-top: 30px;">
      We're so happy to have you as part of our community. Thank you for choosing MediTour.Global!
    </p>

    <p style="font-size: 16px; color: #333; margin-top: 20px;">
      Warm regards,<br/>
      <span style="font-weight: bold;">MediTour.Global Team</span>
    </p>
  </div>
  `;

  const mailOptions = {
    from: '"MediTour.Global" <info@meditour.global>', // Your verified email
    to: docEmail, // Recipient's email
    subject: `Welcome! Your ${receiverModelType} Account is Now Active`,
    html: emailContent, // HTML body
  };

  try {
    await transporter.sendMail(mailOptions, function (err) {
      if (err) {
        return next(err);
      }

      return res.status(200).json({
        status: true,
        message: `Activation email has been sent to ${docEmail}`,
      });
    });
  } catch (error) {
    return res
      .status(500)
      .json({ status: "failure", message: "Failed to send email." });
  }
}

module.exports = { sendVendorActivationEmail, sendAccountCreationEmail };
