/**
 * socketHandler.js — Socket.IO setup for live queue updates.
 *
 * Every socket must present a valid JWT (same secret as the REST API).
 * After connecting, each client joins:
 *   - `user:<id>`     room → personal notifications (queue token, near turn)
 *   - `clinic:<id>`   room → live queue display for that clinic
 * Controllers emit into these rooms via req.app.get('io').
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Wire up authentication + room joins for every socket connection.
const socketHandler = (io) => {
  // Authentication middleware — runs once per connecting socket.
  io.use(async (socket, next) => {
    try {
      // Step 1: read the JWT sent by the frontend (SocketContext passes
      // it in `auth`, older clients may send it in the query string).
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      // No token → connection rejected before it even opens.
      if (!token) {
        return next(new Error('Socket authentication token is required'));
      }

      // Step 2: verify the token and load the matching user from the DB.
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      // Deleted or deactivated accounts cannot keep a live connection.
      if (!user || !user.isActive) {
        return next(new Error('Socket user is inactive or missing'));
      }

      // Step 3: remember who this socket belongs to, then allow it in.
      socket.user = user;
      return next();
    } catch (error) {
      // Bad/expired token — reject the connection.
      return next(new Error('Invalid socket authentication token'));
    }
  });

  // Runs once for every client that passed authentication above.
  io.on('connection', (socket) => {
    // Personal room — notifications addressed to just this user
    // (queue token issued, "your turn is near", etc.).
    socket.join(`user:${socket.user._id}`);

    // Pages that show a live queue ask to join that clinic's room…
    socket.on('join-clinic', (clinicId) => {
      if (clinicId) {
        socket.join(`clinic:${clinicId}`);
      }
    });

    // …and leave it again when the user switches clinic / leaves the page.
    socket.on('leave-clinic', (clinicId) => {
      if (clinicId) {
        socket.leave(`clinic:${clinicId}`);
      }
    });

    // Nothing to clean up — Socket.IO removes the socket from its rooms.
    socket.on('disconnect', () => {});
  });
};

module.exports = socketHandler;
