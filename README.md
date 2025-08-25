# **Meditour Global - Backend API**

**Meditour Global** backend is a secure, scalable, and RESTful API built using **Node.js**, **Express.js**, and **MongoDB**. It powers the mobile app by managing user data, authentication, appointments, healthcare provider information, and more. The backend follows a modular structure with clear separation of concerns for maintainability and performance.

---

## **Table of Contents**

- [Description](#description)
- [Technologies Used](#technologies-used)
- [Features](#features)
- [Installation](#installation)
- [Folder Structure](#folder-structure)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [License](#license)

---

## **Description**

The backend of Meditour Global is responsible for handling all server-side operations, including:

- User authentication and authorization (JWT-based)
- CRUD operations for users, providers, and appointments
- Secure storage and access of sensitive data
- Integration with third-party services like **Firebase**, **Twilio**, etc.
- Error handling, request validation, and logging

---

## **Technologies Used**

![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose-880000?logo=mongoose&logoColor=white)

- **Node.js** – JavaScript runtime environment.
- **Express.js** – Web framework for routing and middleware.
- **MongoDB** – NoSQL database for storing user and provider data.
- **Mongoose** – ODM for MongoDB.
- **dotenv** – For managing environment variables.
- **JWT** – Authentication and session management.
- **Firebase Admin SDK** – (Optional) For messaging or storage.
- **Twilio** – For SMS and communication integration.

---

## **Features**

- 🔐 **JWT Authentication**: Secure registration and login using JSON Web Tokens.
- 🏥 **Provider Management**: Add, update, and query healthcare provider data.
- 📅 **Appointment System**: Book, update, and cancel appointments.
- 🧑‍🤝‍🧑 **User Profiles**: Manage user information and history.
- 🧾 **RESTful API**: Clean and consistent API structure.
- ⚙️ **Modular Structure**: Organized and scalable file architecture.
- 🧪 **Validation & Error Handling**: Centralized error responses and input validation.

---

## **Installation**

Follow these steps to run the backend server locally:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-username/Meditour-Global-Backend.git
   cd Meditour-Global-Backend
   npm install
   ```

## Installation

1. Clone the repository:

```powershell
git clone <repository-url>
```

2. Navigate to the project directory:

```powershell
cd <project-directory>
```

3. Install the dependencies:

```powershell
npm install

```

## Running the Project

### Developement Mode

To run the project in development mode (with automatic restarts when files change), use the following command:

```powershell
npm start
```

This will start the server using Nodemon and listen for file changes to automatically restart the server.

## Project Structure

- `Meditour-Global-Backend/`
  - `controllers/` # Route handlers for various resources
  - `models/` # Mongoose schemas and models
  - `routes/` # Express route definitions
  - `middlewares/` # Authentication, error handling, and other middleware
  - `utils/` # Helper functions and utilities
  - `config/` # Database connection and third-party service configs
  - `firebase/` # Firebase Admin SDK configuration
  - `server.js` # Main entry point of the backend server
  - `package.json` # Project dependencies and npm scripts

## **License**

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

---

### **MIT License Summary**:

The MIT License is a permissive open-source license that allows for the following:

- **Usage**: You can use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.
- **Attribution**: You must include the original copyright notice and license text in all copies or substantial portions of the Software.
- **Warranty Disclaimer**: The software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement.

For more details, see the full license text in the [LICENSE](./LICENSE) file.

---
