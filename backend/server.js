/**
 * server.js — MediSync API entry point.
 *
 * Responsibilities:
 *  1. Load environment variables (.env)
 *  2. Create the Express app + HTTP server + Socket.IO (live queue updates)
 *  3. Register global middleware (security, CORS, JSON parsing, logging)
 *  4. Mount every /api/* route group
 *  5. Connect to MongoDB, seed default users, start scheduled jobs, listen
 */
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const seedDefaultUsers = require('./config/seed');
const socketHandler = require('./socket/socketHandler');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const scheduleAppointmentReminders = require('./jobs/appointmentReminder');
const { scheduleOpdSessions } = require('./jobs/opdScheduler');

const authRoutes = require('./routes/authRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const queueRoutes = require('./routes/queueRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const clinicRoutes = require('./routes/clinicRoutes');
const clinicSessionRoutes = require('./routes/clinicSessionRoutes');
const medicalReportRoutes = require('./routes/medicalReportRoutes');

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

// Socket.IO shares the same HTTP server — used for live queue displays.
const io = new Server(server, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Controllers fetch the io instance with req.app.get('io') to emit events.
app.set('io', io);
socketHandler(io);

// ── Global middleware ─────────────────────────────────────────────
app.use(helmet()); // secure HTTP headers
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Simple liveness check (no auth) — used to confirm the API is up.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'MediSync API' });
});

// ── API route groups ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes.router);
app.use('/api/records', doctorRoutes.recordRouter);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/clinic-sessions', clinicSessionRoutes);
app.use('/api/medical-reports', medicalReportRoutes);

// 404 + centralized error handler must be registered LAST.
app.use(notFound);
app.use(errorHandler);

mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));

// Connect to the database first, then start listening — the app is
// useless without MongoDB, so a failed connection stops startup.
const startServer = async () => {
  await connectDB();
  await seedDefaultUsers(); // creates the default admin/demo accounts once

  scheduleAppointmentReminders(); // daily 8AM email reminders
  scheduleOpdSessions();          // auto-creates daily OPD clinic sessions

  const port = process.env.PORT || 5000;
  server.listen(port, () => {
    console.log(`MediSync API running on port ${port}`);
  });
};

startServer();
