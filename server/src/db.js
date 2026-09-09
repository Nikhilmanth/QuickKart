// Uses the SQLite engine BUILT INTO Node.js (no native compilation needed).
import { DatabaseSync as Database } from 'node:sqlite';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'quickkart.db');
const oldDbPath = path.join(__dirname, '..', 'blinkit.db');

if (!fs.existsSync(dbPath) && fs.existsSync(oldDbPath)) {
  try {
    fs.copyFileSync(oldDbPath, dbPath);
  } catch (err) {
    console.warn('[db] Note: could not clone old database, starting fresh quickkart.db:', err.message);
  }
}

export const db = new Database(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  role TEXT DEFAULT 'CUSTOMER',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  label TEXT DEFAULT 'Home',
  line1 TEXT NOT NULL,
  city TEXT DEFAULT '',
  lat REAL,
  lng REAL,
  is_default INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '🛒'
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  brand TEXT DEFAULT '',
  category_id INTEGER REFERENCES categories(id),
  unit TEXT DEFAULT '',
  icon TEXT DEFAULT '📦',
  image_url TEXT DEFAULT '',
  rating REAL DEFAULT 4.7,
  reviews_count INTEGER DEFAULT 120,
  mrp REAL NOT NULL,
  price REAL NOT NULL,
  stock INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL DEFAULT 1,
  UNIQUE(cart_id, product_id)
);
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  vehicle TEXT DEFAULT 'Bike',
  status TEXT DEFAULT 'OFFLINE',
  lat REAL, lng REAL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  partner_id INTEGER REFERENCES partners(id),
  status TEXT DEFAULT 'PLACED',
  items_total REAL NOT NULL,
  delivery_fee REAL DEFAULT 25,
  discount REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT DEFAULT 'COD',
  payment_status TEXT DEFAULT 'PENDING',
  address_json TEXT NOT NULL,
  delivery_otp TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  delivered_at TEXT
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  image_url TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  price REAL NOT NULL,
  qty INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  provider TEXT DEFAULT 'razorpay',
  amount REAL NOT NULL,
  status TEXT DEFAULT 'CREATED',
  rp_order_id TEXT, rp_payment_id TEXT, rp_signature TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Safe migrations
try { db.exec('ALTER TABLE partners ADD COLUMN email TEXT DEFAULT "";'); } catch {}
try { db.exec('ALTER TABLE products ADD COLUMN image_url TEXT DEFAULT "";'); } catch {}
try { db.exec('ALTER TABLE products ADD COLUMN rating REAL DEFAULT 4.7;'); } catch {}
try { db.exec('ALTER TABLE products ADD COLUMN reviews_count INTEGER DEFAULT 120;'); } catch {}
try { db.exec('ALTER TABLE order_items ADD COLUMN image_url TEXT DEFAULT "";'); } catch {}

// ---------- SEED DATA HELPER ----------
export function seedAuthenticBlinkitCatalog(force = false) {
  const currentCount = db.prepare("SELECT COUNT(*) c FROM products").get().c;
  if (!force && currentCount >= 80) {
    return;
  }

  console.log('[db] Seeding complete authentic grocery catalog into QuickKart...');

  // Clean old product references
  db.exec('DELETE FROM cart_items;');
  db.exec('DELETE FROM products;');
  db.exec('DELETE FROM categories;');

  const cats = [
    ['Vegetables & Fruits', '🥬'],
    ['Dairy, Bread & Eggs', '🥛'],
    ['Snacks & Munchies', '🍿'],
    ['Cold Drinks & Juices', '🥤'],
    ['Instant & Frozen Food', '🍜'],
    ['Tea, Coffee & Health Drinks', '☕'],
    ['Atta, Rice, Oil & Dals', '🌾'],
    ['Chocolates & Ice Cream', '🍫'],
    ['Cleaning & Household', '🧹'],
    ['Personal Care & Bath', '🧴'],
    ['Baby & Pet Care', '🍼'],
  ];

  const insCat = db.prepare('INSERT INTO categories (name, icon) VALUES (?, ?)');
  const catIds = {};
  for (const [name, icon] of cats) {
    catIds[name] = insCat.run(name, icon).lastInsertRowid;
  }

  const pStmt = db.prepare(`
    INSERT INTO products (name, brand, category_id, unit, icon, image_url, rating, reviews_count, mrp, price, stock, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const p = (name, brand, cat, unit, icon, img, rating, reviews, mrp, price, stock, desc = '') => {
    pStmt.run(name, brand, catIds[cat], unit, icon, img, rating, reviews, mrp, price, stock, desc);
  };

  // 1. VEGETABLES & FRUITS
  const vf = 'Vegetables & Fruits';
  p('Fresh Red Onions (Nashik Pyaz)', 'Farm Fresh', vf, '1 kg', '🧅', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=400&q=80', 4.7, 1840, 48, 35, 140, 'Crisp, pungent red onions sourced directly from Nashik farms');
  p('Fresh Hybrid Potatoes (Aloo)', 'Farm Fresh', vf, '1 kg', '🥔', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&q=80', 4.6, 1920, 38, 28, 160, 'Grade-A fresh cooking potatoes, dirt-cleaned and firm');
  p('Fresh Hybrid Tomatoes (Tamatar)', 'Farm Fresh', vf, '500 g', '🍅', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=400&q=80', 4.5, 1420, 32, 22, 120, 'Glossy, firm red tomatoes ideal for curries, salads and gravies');
  p('Fresh Green Coriander (Dhaniya)', 'Farm Fresh', vf, '100 g', '🌿', 'https://images.unsplash.com/photo-1592417817098-8f3d6910985b?auto=format&fit=crop&w=400&q=80', 4.8, 980, 18, 12, 90, 'Aromatic, handpicked crisp green coriander bunch');
  p('Fresh Green Chillies (Hari Mirch)', 'Farm Fresh', vf, '100 g', '🌶️', 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=400&q=80', 4.7, 850, 20, 14, 100, 'Zesty and spicy fresh chillies for daily Indian seasoning');
  p('Fresh Ginger (Adrak)', 'Farm Fresh', vf, '100 g', '🫚', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80', 4.6, 730, 35, 26, 85, 'Aromatic, washed ginger roots packed with rich earthy flavor');
  p('Fresh Garlic (Lehsun)', 'Farm Fresh', vf, '200 g', '🧄', 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&w=400&q=80', 4.8, 890, 80, 62, 95, 'High-grade pungent garlic with firm, easy-to-peel cloves');
  p('Fresh Green Lemons (Nimbu)', 'Farm Fresh', vf, '4 pcs', '🍋', 'https://images.unsplash.com/photo-1587496679742-bad502958fbf?auto=format&fit=crop&w=400&q=80', 4.7, 1120, 28, 20, 110, 'Juicy, thin-skinned fresh lemons rich in natural Vitamin C');
  p('Fresh Kashmiri Apples', 'Orchard Fresh', vf, '4 pcs (500 g)', '🍎', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=400&q=80', 4.8, 1450, 150, 119, 90, 'Crisp, sweet & juicy hand-picked Kashmiri apples');
  p('Fresh Robusta Bananas', 'Farm Fresh', vf, '6 pcs (750 g)', '🍌', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80', 4.7, 1890, 48, 38, 140, 'Naturally ripened sweet bananas packed with energy and potassium');
  p('Alphonso Mangoes', 'Ratnagiri Gold', vf, '2 pcs (500 g)', '🥭', 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=400&q=80', 4.9, 920, 240, 189, 60, 'Premium sweet and aromatic King of Mangoes from Ratnagiri');
  p('Fresh Green Salad Cucumber (Kheera)', 'Farm Fresh', vf, '500 g', '🥒', 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?auto=format&fit=crop&w=400&q=80', 4.6, 680, 30, 22, 90, 'Crisp, cool hydrating salad cucumbers');

  // 2. DAIRY, BREAD & EGGS
  const dairy = 'Dairy, Bread & Eggs';
  p('Amul Taaza Homogenised Toned Milk', 'Amul', dairy, '500 ml', '🥛', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=400&q=80', 4.9, 3200, 28, 27, 250, 'Fresh pasteurized homogenised toned milk pouch');
  p('Amul Gold Full Cream Fresh Milk', 'Amul', dairy, '500 ml', '🥛', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80', 4.9, 2850, 34, 33, 200, 'Rich and creamy full cream fresh milk for tea, coffee & desserts');
  p('Mother Dairy Classic Toned Milk', 'Mother Dairy', dairy, '500 ml', '🥛', 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?auto=format&fit=crop&w=400&q=80', 4.8, 1940, 28, 27, 180, 'Fresh, wholesome pasteurized toned milk');
  p('Amul Pasteurized Salted Butter', 'Amul', dairy, '100 g', '🧈', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=400&q=80', 4.9, 2950, 58, 56, 160, 'Utterly butterly delicious creamy salted butter');
  p('Amul Pasteurized Salted Butter', 'Amul', dairy, '500 g', '🧈', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=400&q=80', 4.9, 2100, 285, 275, 110, 'Rich golden table butter for whole family breakfasts');
  p('Mother Dairy Fresh Paneer', 'Mother Dairy', dairy, '200 g', '🧀', 'https://images.unsplash.com/photo-1631379578550-7038263db699?auto=format&fit=crop&w=400&q=80', 4.8, 1650, 98, 89, 90, 'Soft, juicy malai cottage cheese for curries and snacks');
  p('Amul Masti Dahi Pouch', 'Amul', dairy, '400 g', '🥣', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=400&q=80', 4.8, 1890, 42, 35, 120, 'Thick, creamy probiotic-rich traditional curd');
  p('Britannia 100% Whole Wheat Bread', 'Britannia', dairy, '400 g', '🍞', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80', 4.8, 2200, 50, 45, 110, 'High-fiber, soft wholesome brown wheat bread');
  p('Harvest Gold White Bread', 'Harvest Gold', dairy, '400 g', '🍞', 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=400&q=80', 4.7, 1420, 45, 38, 95, 'Soft, fluffy sandwich bread baked to perfection');
  p('Farm Fresh White Eggs (Pack of 6)', 'Eggoz', dairy, '6 pcs', '🥚', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=400&q=80', 4.8, 1850, 75, 62, 170, 'Nutrient-rich, UV sanitized farm-fresh eggs');
  p('Farm Fresh White Eggs (Pack of 10)', 'Eggoz', dairy, '10 pcs', '🥚', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=400&q=80', 4.8, 1680, 105, 89, 130, 'Protein-packed farm fresh white eggs in protective carton');
  p('Britannia Processed Cheese Slices', 'Britannia', dairy, '200 g (10 slices)', '🧀', 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?auto=format&fit=crop&w=400&q=80', 4.8, 1280, 155, 135, 85, 'Melt-in-mouth creamy cheddar cheese slices for sandwiches');
  p('Amul Processed Cheese Cubes', 'Amul', dairy, '200 g', '🧀', 'https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=400&q=80', 4.8, 1350, 140, 130, 90, 'Classic delicious cheese cubes beloved by kids and families');

  // 3. SNACKS & MUNCHIES
  const snacks = 'Snacks & Munchies';
  p("Lay's India's Magic Masala Chips", "Lay's", snacks, '50 g', '🥔', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80', 4.9, 4100, 20, 20, 300, "Spicy, savory crinkle-cut potato chips with India's iconic masala");
  p("Lay's Classic Salted Potato Chips", "Lay's", snacks, '50 g', '🥔', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80', 4.8, 3200, 20, 20, 250, 'Crispy golden sliced potatoes seasoned with salt');
  p('Kurkure Masala Munch', 'Kurkure', snacks, '82 g', '🌶️', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80', 4.8, 2890, 20, 20, 260, 'Crunchy, spicy corn puffs infused with authentic Indian spices');
  p("Haldiram's Nagpur Aloo Bhujia", 'Haldiram', snacks, '200 g', '🌶️', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80', 4.9, 2980, 62, 55, 180, 'Crisp seasoned potato and gram noodles with hint of mint');
  p("Haldiram's Bhujia Sev", 'Haldiram', snacks, '200 g', '🌶️', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80', 4.8, 1750, 62, 55, 140, 'Crispy deep-fried gram flour sev with authentic Bikaneri taste');
  p('Doritos Cheese Supreme Nachos', 'Doritos', snacks, '60 g', '🧀', 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=400&q=80', 4.7, 1420, 30, 30, 160, 'Crunchy corn tortilla chips burst with intense cheese flavor');
  p('Act II Golden Sizzle Butter Popcorn', 'Act II', snacks, '70 g', '🍿', 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=400&q=80', 4.8, 1850, 40, 35, 150, 'Hot, buttered movie-theater style instant crunchy popcorn');
  p('Britannia Good Day Cashew Cookies', 'Britannia', snacks, '200 g', '🍪', 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=400&q=80', 4.8, 2300, 50, 45, 180, 'Rich butter cookies loaded with crunchy real cashews');
  p('Parle-G Gold Glucose Biscuits', 'Parle', snacks, '250 g', '🍪', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=400&q=80', 4.9, 4500, 30, 25, 350, "India's favorite chai companion made with wheat & milk power");
  p('Oreo Original Vanilla Creme Biscuits', 'Cadbury Oreo', snacks, '120 g', '🍪', 'https://images.unsplash.com/photo-1568051243851-f9b136146e97?auto=format&fit=crop&w=400&q=80', 4.9, 3100, 30, 28, 220, 'Rich cocoa sandwich cookies filled with smooth vanilla cream');
  p('Happilo Roasted California Almonds', 'Happilo', snacks, '200 g', '🌰', 'https://images.unsplash.com/photo-1508061252227-091ac0ab358c?auto=format&fit=crop&w=400&q=80', 4.8, 890, 320, 249, 90, 'Lightly salted oven-roasted California almonds');

  // 4. COLD DRINKS & JUICES
  const drinks = 'Cold Drinks & Juices';
  p('Coca-Cola Soft Drink Bottle', 'Coca-Cola', drinks, '750 ml', '🥤', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80', 4.8, 2600, 40, 40, 250, 'The original refreshing cola taste to spark everyday moments');
  p('Coca-Cola Zero Sugar Can', 'Coca-Cola', drinks, '330 ml', '🥤', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80', 4.7, 1420, 40, 38, 170, 'Zero sugar, maximum Coca-Cola refreshment');
  p('Thums Up Charged Soft Drink', 'Thums Up', drinks, '750 ml', '⚡', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=400&q=80', 4.9, 3400, 40, 40, 280, 'Strong, spicy fizz and unmistakable thunder taste');
  p('Sprite Lemon-Lime Soft Drink', 'Sprite', drinks, '750 ml', '🍋', 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=400&q=80', 4.8, 2100, 40, 40, 220, 'Crisp, clean lemon-lime flavor that quenches thirst fast');
  p("Frooti Fresh 'N' Juicy Mango Drink", 'Frooti', drinks, '1.2 L', '🥭', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=400&q=80', 4.8, 1950, 75, 70, 160, 'Delicious real mango pulp drink loved across generations');
  p('Real 100% Mixed Fruit Juice', 'Real', drinks, '1 L', '🧃', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=400&q=80', 4.8, 1540, 125, 105, 120, 'Wholesome blend of luscious tropical fruits packed with nutrients');
  p('Red Bull Energy Drink Can', 'Red Bull', drinks, '250 ml', '⚡', 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=400&q=80', 4.8, 1680, 125, 115, 130, 'Vitalizes body and mind with premium taurine and B-vitamins');
  p('Bisleri Packaged Mineral Water', 'Bisleri', drinks, '1 L', '💧', 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=400&q=80', 4.9, 3800, 20, 20, 450, 'Purified mineral drinking water tested across 114 quality checks');

  // 5. INSTANT & FROZEN FOOD
  const instant = 'Instant & Frozen Food';
  p('Maggi 2-Minute Masala Noodles (4-Pack)', 'Maggi', instant, '280 g', '🍜', 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=400&q=80', 4.9, 4900, 58, 54, 300, "India's favorite instant masala noodles with authentic signature taste-maker");
  p('Maggi Masala Noodles (Family Saver 12-Pack)', 'Maggi', instant, '840 g', '🍜', 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=400&q=80', 4.9, 3400, 168, 155, 160, 'Value pack of 12 delicious Maggi noodle cakes for home pantry');
  p('Sunfeast YiPPee! Magic Masala Noodles', 'Sunfeast', instant, '4 x 65 g', '🍜', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80', 4.6, 1200, 55, 48, 180, 'Long, non-sticky round noodles infused with real veggie goodness');
  p('Barilla Penne Rigate Durum Wheat Pasta', 'Barilla', instant, '500 g', '🍝', 'https://images.unsplash.com/photo-1621996346565-e3d5d628108a?auto=format&fit=crop&w=400&q=80', 4.8, 820, 195, 165, 95, 'Authentic Italian 100% durum wheat semolina penne pasta');
  p('Knorr Classic Thick Tomato Soup', 'Knorr', instant, '53 g', '🍲', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=400&q=80', 4.6, 680, 48, 42, 110, 'Rich and creamy restaurant-style instant tomato soup');
  p('McCain French Fries', 'McCain', instant, '420 g', '🍟', 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=400&q=80', 4.7, 950, 145, 125, 80, 'Crispy on the outside, tender on the inside ready-to-fry potato fries');
  p('MTR Ready-to-Eat Paneer Butter Masala', 'MTR', instant, '300 g', '🍛', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80', 4.6, 540, 145, 125, 75, 'Tender cottage cheese in silky spiced makhani tomato butter gravy');

  // 6. TEA, COFFEE & HEALTH DRINKS
  const hotDrinks = 'Tea, Coffee & Health Drinks';
  p('Tata Tea Gold Royal Assam Leaf Tea', 'Tata Tea', hotDrinks, '500 g', '☕', 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=400&q=80', 4.9, 1850, 290, 245, 120, 'Rich Assam CTC tea leaves blended with 15% gently rolled long aroma leaves');
  p('Brooke Bond Red Label Tea', 'Red Label', hotDrinks, '500 g', '☕', 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=400&q=80', 4.8, 1620, 310, 275, 100, 'Fine quality tea leaves processed with care for rich color and warmth');
  p('Nescafe Classic Instant Coffee Jar', 'Nescafe', hotDrinks, '100 g', '☕', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80', 4.9, 2100, 220, 195, 140, '100% pure roasted coffee beans delivering that unmistakable wake-up aroma');
  p('Bru Instant Coffee Jar', 'Bru', hotDrinks, '100 g', '☕', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80', 4.7, 1340, 195, 175, 110, 'Fine blend of 70% coffee and 30% chicory for strong South Indian flavor');
  p('Bournvita Chocolate Health Nutrition Drink', 'Cadbury', hotDrinks, '500 g jar', '🥛', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=400&q=80', 4.8, 1480, 260, 235, 95, 'Immunity-boosting chocolate malt drink enriched with Vitamin D & Iron');

  // 7. ATTA, RICE, OIL & DALS
  const staples = 'Atta, Rice, Oil & Dals';
  p('Aashirvaad Superior MP Sharbati Atta', 'Aashirvaad', staples, '5 kg', '🌾', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80', 4.9, 3900, 285, 245, 130, '100% Sharbati whole wheat flour ground from grain for softer, fluffier rotis');
  p('India Gate Classic Basmati Rice', 'India Gate', staples, '1 kg', '🍚', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80', 4.9, 2450, 165, 142, 115, 'Aged extra long slender basmati grains with royal feast aroma');
  p('Fortune Sunlite Refined Sunflower Oil', 'Fortune', staples, '1 L', '🛢️', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80', 4.8, 2200, 155, 138, 125, 'Light, heart-friendly cooking oil enriched with Vitamins A & D');
  p('Fortune Premium Kachi Ghani Mustard Oil', 'Fortune', staples, '1 L', '🛢️', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80', 4.8, 1850, 170, 152, 110, 'Cold-pressed traditional mustard oil with rich pungent flavor');
  p('Tata Sampann Unpolished Toor Dal', 'Tata Sampann', staples, '1 kg', '🫘', 'https://images.unsplash.com/photo-1585996746973-22879555c4ca?auto=format&fit=crop&w=400&q=80', 4.8, 1420, 190, 168, 120, 'Pure unpolished arhar dal naturally rich in plant-based proteins');
  p('Tata Salt Vacuum Evaporated Iodized Salt', 'Tata', staples, '1 kg', '🧂', 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80', 4.9, 4800, 30, 28, 300, 'Vacuum evaporated pure iodized salt for mental and physical development');
  p('Madhur Pure Refined Crystal Sugar', 'Madhur', staples, '1 kg', '🍬', 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80', 4.8, 1750, 55, 49, 180, 'Sulfur-free sparkling white refined sugar processed touch-free');

  // 8. CHOCOLATES & ICE CREAM
  const sweets = 'Chocolates & Ice Cream';
  p('Cadbury Dairy Milk Silk Chocolate Bar', 'Cadbury', sweets, '150 g', '🍫', 'https://images.unsplash.com/photo-1548907040-4baa42d10919?auto=format&fit=crop&w=400&q=80', 4.9, 3950, 185, 165, 150, 'Silky, melt-in-mouth smooth milk chocolate for pure indulgence');
  p('Nestle KitKat 4 Finger Chocolate Bar', 'Nestle', sweets, '38.5 g', '🍫', 'https://images.unsplash.com/photo-1548907040-4baa42d10919?auto=format&fit=crop&w=400&q=80', 4.8, 2200, 30, 28, 240, 'Crispy wafer fingers covered in creamy milk chocolate');
  p('Amul Dark Chocolate 55% Cocoa', 'Amul', sweets, '150 g', '🍫', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80', 4.7, 1380, 110, 99, 100, 'Rich antioxidant dark chocolate bar made from fine cocoa beans');
  p('Amul Real Alphonso Mango Ice Cream Tub', 'Amul', sweets, '1 L', '🍨', 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=400&q=80', 4.9, 1450, 210, 175, 70, 'Pure milk ice cream loaded with sweet, real Alphonso mango chunks');
  p("Kwality Wall's Cornetto Double Chocolate", "Kwality Wall's", sweets, '110 ml', '🍦', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=80', 4.8, 1920, 50, 45, 110, 'Crispy wafer cone layered with creamy double chocolate disc and chocolate tip');

  // 9. CLEANING & HOUSEHOLD
  const home = 'Cleaning & Household';
  p('Surf Excel Quick Wash Detergent Powder', 'Surf Excel', home, '1 kg', '🧺', 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=400&q=80', 4.9, 3600, 145, 135, 160, 'Stain-removing formula that brightens clothes in a single wash cycle');
  p('Vim Lemon Concentrated Dishwash Gel', 'Vim', home, '750 ml', '🧽', 'https://images.unsplash.com/photo-1585830812416-a6c86bb14576?auto=format&fit=crop&w=400&q=80', 4.8, 2800, 132, 118, 140, 'Degreasing gel power with lemon zest that removes stubborn oily stains');
  p('Lizol Disinfectant Citrus Floor Cleaner', 'Lizol', home, '975 ml', '🪣', 'https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?auto=format&fit=crop&w=400&q=80', 4.8, 2300, 215, 189, 100, 'Kills 99.9% germs and provides sparkling clean surfaces with citrus scent');
  p('Harpic Power Plus 10x Toilet Cleaner', 'Harpic', home, '1 L', '🚽', 'https://images.unsplash.com/photo-1585830812416-a6c86bb14576?auto=format&fit=crop&w=400&q=80', 4.9, 2900, 220, 195, 120, 'Original thick formula that removes yellow stains and disinfects');
  p('Origami Biodegradable Garbage Bags', 'Origami', home, '30 pcs (Medium)', '🗑️', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80', 4.7, 850, 149, 99, 110, 'Heavy-duty leak-proof biodegradable trash bags with tie tape');

  // 10. PERSONAL CARE & BATH
  const pc = 'Personal Care & Bath';
  p('Dettol Original Bathing Soap (Pack of 4)', 'Dettol', pc, '4 x 75 g', '🧼', 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=400&q=80', 4.9, 3100, 150, 138, 150, 'Trusted germ protection with moisturizing pine fragrance');
  p('Dove Cream Beauty Bathing Bar', 'Dove', pc, '100 g', '🧼', 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=400&q=80', 4.8, 2400, 70, 62, 130, 'Contains 1/4 moisturizing cream for noticeably softer, smoother skin');
  p('Head & Shoulders Cool Menthol Shampoo', 'Head & Shoulders', pc, '340 ml', '🧴', 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=400&q=80', 4.8, 1850, 375, 315, 95, 'Cooling anti-dandruff formula that leaves scalp invigorated and clean');
  p('Mamaearth Charcoal Face Wash', 'Mamaearth', pc, '100 ml', '🧼', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80', 4.7, 1150, 249, 199, 80, 'Activated charcoal & tea tree face wash for deep pollution clearing');
  p('Colgate Total Advanced Health Toothpaste', 'Colgate', pc, '150 g', '🪥', 'https://images.unsplash.com/photo-1559591937-e1032b4b4555?auto=format&fit=crop&w=400&q=80', 4.8, 2200, 110, 95, 170, '12-hour antibacterial whole-mouth cavity protection');
  p('Dettol Liquid Handwash Soap Refill', 'Dettol', pc, '750 ml', '🧴', 'https://images.unsplash.com/photo-1607006314695-1f90b9b32c69?auto=format&fit=crop&w=400&q=80', 4.9, 2900, 119, 99, 160, '100% better germ defense with pine freshness and skin softeners');
  p('Nivea Deep Moisture Body Lotion', 'Nivea', pc, '200 ml', '🧴', 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=400&q=80', 4.8, 1300, 260, 215, 90, '48-hour intense deep moisture care enriched with almond oil');

  // 11. BABY & PET CARE
  const baby = 'Baby & Pet Care';
  p('Pampers All-round Protection Diapers (M)', 'Pampers', baby, '44 pcs', '🍼', 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=400&q=80', 4.8, 980, 999, 849, 60, 'Ultra-absorbent pants with anti-rash aloe lotion protection');
  p("Johnson's Baby Bathing Soap", "Johnson's", baby, '100 g', '🧼', 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=400&q=80', 4.8, 850, 75, 65, 80, 'Clinically proven mild formula enriched with baby lotion');
  p('Pedigree Adult Dry Dog Food (Meat & Rice)', 'Pedigree', baby, '1.2 kg', '🐕', 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=400&q=80', 4.8, 720, 420, 379, 50, 'Complete balanced pet nutrition for healthy shiny coat and muscles');
  p('Whiskas Dry Adult Cat Food (Ocean Fish)', 'Whiskas', baby, '1.2 kg', '🐈', 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=400&q=80', 4.8, 620, 440, 389, 45, 'Crunchy pockets with real fish flavor for adult feline health');

  // Demo delivery partner account if not present
  const partnerCount = db.prepare('SELECT COUNT(*) c FROM partners').get().c;
  if (partnerCount === 0) {
    db.prepare('INSERT INTO partners (phone, name, vehicle) VALUES (?, ?, ?)')
      .run('8888888888', 'Ravi Kumar', 'Bike');
  }

  console.log('[db] Catalog seeded successfully! Total products:', db.prepare('SELECT COUNT(*) c FROM products').get().c);
}

// Auto-seed if empty or catalog needs update
const productCount = db.prepare("SELECT COUNT(*) c FROM products").get().c;
if (productCount < 50) {
  seedAuthenticBlinkitCatalog(true);
}

console.log('[db] QuickKart SQLite ready');
