# 🛒 QuickKart — Groceries. Delivered Quickly.

A modern, high-speed quick-commerce grocery delivery platform: customer storefront, delivery partner app, and admin dashboard — with OTP login, realistic product catalog, Razorpay payments, live rider tracking, and real-time order updates.

## Project Structure

```
QuickKart project/
├── server/          Node.js + Express API (SQLite via node:sqlite, Socket.io)
├── customer-app/    Customer storefront (React + Vite) → http://localhost:3000
└── ops-app/         Admin panel + Delivery Partner app (React + Vite) → http://localhost:3001
```

## 🚀 Quick Start

Double-click **`start-all.bat`** (or run the three commands below in separate terminals):

```bash
cd server        && npm install && npm run dev   # API on :4000
cd customer-app  && npm install && npm run dev   # Storefront on :3000
cd ops-app       && npm install && npm run dev   # Admin/Partner on :3001
```

Then open:
- **Customer App:** http://localhost:3000 — browse products, add to cart, checkout, pay, track delivery live
- **Ops Portal:** http://localhost:3001 — admin dashboard or delivery partner mode

## 🔑 Demo Logins (OTP shows on screen & in server console)

| Role | Phone | Where |
|---|---|---|
| Customer | any 10-digit number | customer-app |
| Admin | `9999999999` | ops-app → Admin tab |
| Delivery partner | `8888888888` | ops-app → Partner tab |

## 💳 Payments — LIVE ✅

Razorpay **test-mode keys are configured** in `server/.env`. Checkout opens the real Razorpay UI (UPI / Card / NetBanking) and verifies signatures server-side. Test payment on Razorpay checkout with card `4111 1111 1111 1111`, any future expiry, any CVV. To accept real money later, switch to live keys in the same file.

## 📱 Installable Phone Apps (PWA)

Both apps are installable like native apps:
1. Find your PC's IP: `ipconfig` → e.g. `192.168.1.5`
2. On your phone (same Wi-Fi) open `http://192.168.1.5:3000` (customer) or `:3001` (ops)
3. Chrome/Android: menu → **Add to Home screen**. iPhone Safari: Share → **Add to Home Screen**.
4. They launch full-screen with their own icon 🛒 / 🛵

## 📱 Full Delivery Lifecycle Flow

1. Open **customer-app**, login with your email or phone number, add items, checkout (mock payment or COD)
2. You land on the **live tracking page** with a Leaflet map
3. On your phone/laptop open **ops-app** → Partner tab → login `8888888888` → **Go ONLINE**
4. Accept the order → Picked up → enter the **Delivery OTP** (shown on customer's tracking page)
5. Watch status update live on the customer's screen 🎉

## What's Implemented in QuickKart

- ✅ **Original QuickKart Brand & Logo:** Clean, modern, grocery-related visual identity with speed motifs
- ✅ **Realistic Product Catalog & Photography:** High-resolution product images for Fruits & Veggies, Dairy & Breakfast, Snacks, Beverages, Instant Food, Personal Care, Household, Staples, and Ice Creams
- ✅ **Rich Product Cards:** Product image, brand badge, MRP, price, discounts, ratings, low stock warnings, and quantity stepper
- ✅ **Cart with Live Totals & Milestone Meter:** Free delivery threshold (₹199), MRP savings meter, delivery fee calculations
- ✅ **Checkout & Address Book:** Multi-address management, geolocation auto-detect, Razorpay and COD payment methods
- ✅ **Live GPS Tracking:** Rider broadcasts coordinates over Socket.io, customer views marker moving live on OpenStreetMap Leaflet map
- ✅ **Admin Dashboard & Ops Portal:** Revenue analytics, active order dispatcher, product CRUD management with image URLs
- ✅ **Email & SMS OTP Auth:** Secure JWT sessions with Nodemailer SMTP delivery and Firebase phone auth
