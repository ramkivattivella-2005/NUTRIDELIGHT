import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.VITE_FIREBASE_APP_ID || ""
};

const hasConfig = !!firebaseConfig.apiKey;

let db: any = null;
if (hasConfig) {
  try {
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    console.log('[Firebase] Server-side Firebase SDK initialized successfully.');
  } catch (err) {
    console.error('[Firebase] Server-side Firebase SDK failed to initialize:', err);
  }
} else {
  console.log('[Firebase] Server-side Firebase is not configured (Demo local storage active).');
}

const app = express();
const PORT = 3000;
const ORDERS_FILE_PATH = path.join(process.cwd(), 'orders.json');

// Ensure orders file exists with initial mock orders
function initializeOrdersFile() {
  if (!fs.existsSync(ORDERS_FILE_PATH)) {
    const initialOrders = [
      {
        id: 'ND-105234',
        customerName: 'Ravi Kumar',
        customerEmail: 'ravi@srkr.edu.in',
        customerPhone: '9010972333',
        deliveryMethod: 'deliver',
        deliveryAddress: 'Room 204, Block-3 Boys Hostel, SRKR Campus, Bhimavaram',
        paymentMethod: 'upi',
        items: [
          {
            id: 'dosa-carrot',
            name: 'Carrot Dosa',
            price: 25,
            quantity: 2,
            selectedPreference: 'Extra Protein',
            customNotes: 'Please make it extra crispy.'
          },
          {
            id: 'tea-bellam',
            name: 'Bellam Tea',
            price: 20,
            quantity: 2,
            selectedPreference: 'Standard',
            customNotes: ''
          }
        ],
        subtotal: 90,
        deliveryFee: 30,
        total: 120,
        status: 'completed',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        estimatedTime: '15-25 mins'
      },
      {
        id: 'ND-308412',
        customerName: 'Ananya Sen',
        customerEmail: 'ananya.sen@gmail.com',
        customerPhone: '9988776655',
        deliveryMethod: 'pickup',
        deliveryAddress: '',
        paymentMethod: 'card',
        items: [
          {
            id: 'roll-paneer',
            name: 'Paneer Roll',
            price: 50,
            quantity: 1,
            selectedPreference: 'Gluten-Free',
            customNotes: 'No onions please.'
          },
          {
            id: 'juice-battayi',
            name: 'Mosambi/Battayi Juice',
            price: 60,
            quantity: 1,
            selectedPreference: 'Standard',
            customNotes: ''
          }
        ],
        subtotal: 110,
        deliveryFee: 0,
        total: 110,
        status: 'ready',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
        estimatedTime: '10-15 mins'
      },
      {
        id: 'ND-409123',
        customerName: 'Srinivas Rao',
        customerEmail: 'srinivas.r@yahoo.com',
        customerPhone: '9876543210',
        deliveryMethod: 'deliver',
        deliveryAddress: 'Staff Quarters, Flat 4B, SRKR Campus',
        paymentMethod: 'cod',
        items: [
          {
            id: 'dosa-spinach',
            name: 'Spinach Dosa',
            price: 25,
            quantity: 1,
            selectedPreference: 'Vegan',
            customNotes: ''
          }
        ],
        subtotal: 25,
        deliveryFee: 30,
        total: 55,
        status: 'preparing',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins ago
        estimatedTime: '15-25 mins'
      }
    ];
    fs.writeFileSync(ORDERS_FILE_PATH, JSON.stringify(initialOrders, null, 2), 'utf-8');
  }
}

// Read orders from file
function getOrders(): any[] {
  try {
    initializeOrdersFile();
    const data = fs.readFileSync(ORDERS_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading orders file:', error);
    return [];
  }
}

// Write orders to file
function saveOrders(orders: any[]) {
  try {
    fs.writeFileSync(ORDERS_FILE_PATH, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing orders file:', error);
  }
}

async function startServer() {
  initializeOrdersFile();

  // Parse JSON bodies
  app.use(express.json());

  // API - Get all orders (or by phone)
  app.get('/api/orders', async (req, res) => {
    const { phone } = req.query;
    
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'orders'));
        const orders: any[] = [];
        querySnapshot.forEach((docSnap) => {
          orders.push(docSnap.data());
        });
        if (phone) {
          const filtered = orders.filter(
            (o) => o.customerPhone === phone || o.customerPhone.replace(/\D/g, '') === String(phone).replace(/\D/g, '')
          );
          return res.json(filtered);
        }
        return res.json(orders);
      } catch (err: any) {
        console.error("Firestore error in GET /api/orders:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    const orders = getOrders();
    if (phone) {
      const filtered = orders.filter(
        (o) => o.customerPhone === phone || o.customerPhone.replace(/\D/g, '') === String(phone).replace(/\D/g, '')
      );
      return res.json(filtered);
    }
    res.json(orders);
  });

  // API - Get a single order by ID
  app.get('/api/orders/:id', async (req, res) => {
    const { id } = req.params;

    if (db) {
      try {
        const docSnap = await getDoc(doc(db, 'orders', id.toUpperCase()));
        if (docSnap.exists()) {
          return res.json(docSnap.data());
        }
        
        const querySnapshot = await getDocs(collection(db, 'orders'));
        let foundOrder: any = null;
        querySnapshot.forEach((docSnap) => {
          const order = docSnap.data();
          if (order.id.toLowerCase() === id.toLowerCase()) {
            foundOrder = order;
          }
        });
        if (foundOrder) {
          return res.json(foundOrder);
        }

        return res.status(404).json({ error: 'Order not found' });
      } catch (err: any) {
        console.error("Firestore error in GET /api/orders/:id:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    const orders = getOrders();
    const order = orders.find((o) => o.id.toLowerCase() === id.toLowerCase());
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  });

  // API - Create an order
  app.post('/api/orders', async (req, res) => {
    const {
      customerName,
      customerEmail,
      customerPhone,
      deliveryMethod,
      deliveryAddress,
      paymentMethod,
      items,
      subtotal,
      deliveryFee,
      total
    } = req.body;

    if (!customerName || !customerEmail || !customerPhone || !items || !items.length) {
      return res.status(400).json({ error: 'Missing required order details' });
    }

    let orders: any[] = [];
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'orders'));
        querySnapshot.forEach((docSnap) => {
          orders.push(docSnap.data());
        });
      } catch (err) {
        console.error("Firestore error pre-fetching orders:", err);
      }
    } else {
      orders = getOrders();
    }
    
    let orderId = '';
    let isUnique = false;
    while (!isUnique) {
      orderId = `ND-${Math.floor(100000 + Math.random() * 900000)}`;
      isUnique = !orders.some((o) => o.id === orderId);
    }

    const newOrder = {
      id: orderId,
      orderId, // Requirement 1
      customerName,
      customerEmail,
      customerPhone,
      deliveryMethod,
      deliveryAddress: deliveryAddress || '',
      paymentMethod,
      items,
      subtotal,
      deliveryFee,
      total,
      totalAmount: total, // Requirement 1
      status: 'Order Placed', // Requirement 2: Default status 'Order Placed'
      orderStatus: 'Order Placed', // Requirement 1
      createdAt: new Date().toISOString(),
      estimatedTime: deliveryMethod === 'deliver' ? '15-25 mins' : '10-15 mins'
    };

    if (db) {
      try {
        await setDoc(doc(db, 'orders', orderId), newOrder);
        return res.status(201).json(newOrder);
      } catch (err: any) {
        console.error("Firestore error in POST /api/orders:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    orders.push(newOrder);
    saveOrders(orders);

    res.status(201).json(newOrder);
  });

  // API - Update order status (Admin)
  app.post('/api/admin/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      'confirmed', 'preparing', 'ready', 'completed',
      'Order Placed', 'Order Accepted', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    if (db) {
      try {
        const orderRef = doc(db, 'orders', id.toUpperCase());
        const docSnap = await getDoc(orderRef);
        if (docSnap.exists()) {
          await updateDoc(orderRef, { status, orderStatus: status });
          const updatedDoc = await getDoc(orderRef);
          return res.json(updatedDoc.data());
        }

        const querySnapshot = await getDocs(collection(db, 'orders'));
        let foundId: string | null = null;
        querySnapshot.forEach((docSnap) => {
          const order = docSnap.data();
          if (order.id.toLowerCase() === id.toLowerCase()) {
            foundId = docSnap.id;
          }
        });

        if (foundId) {
          const matchedOrderRef = doc(db, 'orders', foundId);
          await updateDoc(matchedOrderRef, { status, orderStatus: status });
          const updatedDoc = await getDoc(matchedOrderRef);
          return res.json(updatedDoc.data());
        }

        return res.status(404).json({ error: 'Order not found' });
      } catch (err: any) {
        console.error("Firestore error in POST /api/admin/orders/:id/status:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    const orders = getOrders();
    const index = orders.findIndex((o) => o.id.toLowerCase() === id.toLowerCase());
    if (index === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }

    orders[index].status = status;
    orders[index].orderStatus = status;
    saveOrders(orders);

    res.json(orders[index]);
  });

  // API - Get all orders (Admin Dashboard)
  app.get('/api/admin/orders', async (req, res) => {
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'orders'));
        const orders: any[] = [];
        querySnapshot.forEach((docSnap) => {
          orders.push(docSnap.data());
        });
        const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return res.json(sorted);
      } catch (err: any) {
        console.error("Firestore error in GET /api/admin/orders:", err);
        return res.status(500).json({ error: err.message });
      }
    }

    const orders = getOrders();
    const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(sorted);
  });

  // Vite development vs production asset serving middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
