# PetCare Hub - Backend API

A comprehensive REST API for pet care management built with Node.js, Express, and MongoDB.

## 📁 Folder Structure

```
PetVitals-BE/
├── config/              # Configuration files
│   ├── config.js        # App configuration
│   └── database.js      # MongoDB connection
├── controllers/         # Business logic
│   ├── authController.js
│   ├── petController.js
│   ├── healthController.js
│   └── reminderController.js
├── middleware/          # Custom middleware
│   ├── auth.js          # JWT authentication
│   ├── errorHandler.js  # Error handling
│   ├── upload.js        # File upload
│   └── validate.js      # Validation middleware
├── models/              # Database models
│   ├── User.js
│   ├── Pet.js
│   ├── HealthRecord.js
│   └── Reminder.js
├── routes/              # API routes
│   ├── auth.js
│   ├── pets.js
│   ├── health.js
│   └── reminders.js
├── validators/          # Input validation rules
│   ├── authValidator.js
│   ├── petValidator.js
│   ├── healthValidator.js
│   └── reminderValidator.js
├── uploads/             # Uploaded files
│   └── pets/            # Pet photos
├── .env                 # Environment variables
├── .gitignore
├── app.js               # Main application file
└── package.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v20 or higher)
- MongoDB (running locally or MongoDB Atlas)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/petcare
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
```

3. Start MongoDB (if running locally):
```bash
sudo systemctl start mongod
```

4. Run the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (Protected)
- `PUT /api/auth/profile` - Update user profile (Protected)

### Pets
- `GET /api/pets` - Get all pets (Protected)
- `POST /api/pets` - Create new pet (Protected)
- `GET /api/pets/:id` - Get pet by ID (Protected)
- `PUT /api/pets/:id` - Update pet (Protected)
- `DELETE /api/pets/:id` - Delete pet (Protected)
- `POST /api/pets/:id/photo` - Upload pet photo (Protected)

### Health Records
- `GET /api/health/:petId` - Get all health records for a pet (Protected)
- `POST /api/health/:petId` - Create health record (Protected)
- `GET /api/health/record/:id` - Get health record by ID (Protected)
- `PUT /api/health/record/:id` - Update health record (Protected)
- `DELETE /api/health/record/:id` - Delete health record (Protected)

### Reminders
- `GET /api/reminders` - Get all reminders (Protected)
- `POST /api/reminders` - Create reminder (Protected)
- `GET /api/reminders/:id` - Get reminder by ID (Protected)
- `PUT /api/reminders/:id` - Update reminder (Protected)
- `DELETE /api/reminders/:id` - Delete reminder (Protected)
- `PATCH /api/reminders/:id/complete` - Mark reminder as completed (Protected)

## 🔐 Authentication

Protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## 🏗️ Architecture

### Modular Design
- **Controllers**: Handle business logic and request/response
- **Models**: Define database schemas and methods
- **Routes**: Define API endpoints and apply middleware
- **Validators**: Validate incoming request data
- **Middleware**: Handle authentication, file uploads, errors
- **Config**: Centralized configuration management

### Benefits
- ✅ Easy to maintain and scale
- ✅ Clear separation of concerns
- ✅ Reusable components
- ✅ Easy to test
- ✅ Easy for new developers to understand

## 📝 License

ISC
# PetApp-BE
