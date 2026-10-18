import 'dotenv/config';
import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import './db.js';
import authRoutes from './routes/auth.js';
import emailOtpRoutes from './routes/emailOtp.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes, { razorpayMode } from './routes/payments.js';
import partnerRoutes from './routes/partner.js';
import adminRoutes from './routes/admin.js';
import { setIo, orderRoom } from './events.js';
import { isEmailConfigured } from './mailer.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
setIo(io);

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  payments: razorpayMode(),
  time: new Date().toISOString(),
  email: {
    configured: isEmailConfigured(),
    method: process.env.GOOGLE_SCRIPT_URL ? 'GOOGLE_APPS_SCRIPT_HTTPS' : (process.env.RESEND_API_KEY ? 'RESEND_HTTPS' : (process.env.BREVO_API_KEY ? 'BREVO_HTTPS' : 'GMAIL_SMTP')),
  },
  firebase: !!process.env.FIREBASE_API_KEY,
  firebaseConfig: process.env.FIREBASE_API_KEY ? {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || undefined,
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
    appId: process.env.FIREBASE_APP_ID || undefined,
  } : null,
}));

app.use('/api/auth', authRoutes);
app.use('/api/auth/email', emailOtpRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/admin', adminRoutes);

// ---- Real-time (Socket.io) ----
io.on('connection', (socket) => {
  console.log('[ws] connected', socket.id);

  // Customers & partners join a room per tracked order: room = order_<id>
  socket.on('join_order', ({ orderId }) => {
    if (!orderId) return;
    socket.join(orderRoom(orderId));
    console.log(`[ws] ${socket.id} joined ${orderRoom(orderId)}`);
  });

  // Partner pushes live GPS; everyone tracking that order receives it
  socket.on('partner_location', ({ orderId, lat, lng }) => {
    if (!orderId || lat == null || lng == null) return;
    io.to(orderRoom(orderId)).emit('partner:location', { lat, lng });
  });

  socket.on('disconnect', () => console.log('[ws] disconnected', socket.id));
});

server.listen(PORT, () => {
  console.log(`\n🛒 QuickKart API running -> http://localhost:${PORT}`);
  console.log(`   Payments mode : ${razorpayMode()}`);
  console.log(`   Admin login   : phone ${process.env.ADMIN_PHONE || '9999999999'}`);
  console.log(`   Partner demo  : phone 8888888888\n`);
});
