/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import MenuSection from './components/MenuSection';
import ReviewsSection from './components/ReviewsSection';
import Footer from './components/Footer';
import CartSidebar from './components/CartSidebar';
import ItemDetailModal from './components/ItemDetailModal';
import CheckoutModal from './components/CheckoutModal';
import TrackOrder from './components/TrackOrder';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import CustomerLoginModal from './components/CustomerLoginModal';
import { MenuItem, CartItem, Review, Notification, NotificationSettings, NotificationType } from './types';
import { INITIAL_REVIEWS, MENU_ITEMS } from './data';
import { AlertCircle } from 'lucide-react';
import { 
  db, 
  auth,
  signOut,
  hasConfig, 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  onSnapshot 
} from './lib/firebase';

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-seed-1',
    type: 'new_menu_item',
    title: 'New Menu Alert: Mango Smoothie 🥭',
    message: 'Taste our new seasonal Mango protein smoothie made with organic coconut milk and chia seeds.',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    isRead: false
  },
  {
    id: 'notif-seed-2',
    type: 'promotional_offer',
    title: 'Flat 20% Off Wellness Sale! ☔',
    message: 'Stay active and energized! Use code HEALTHY20 for 20% off all healthy bowls and juices.',
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
    isRead: false
  },
  {
    id: 'notif-seed-3',
    type: 'rewards',
    title: '150 NutriPoints Earned! 🏆',
    message: 'Amazing progress! You earned 150 wellness points for your consistent healthy eating streak.',
    timestamp: new Date(Date.now() - 25 * 3600 * 1000).toISOString(), // Yesterday
    isRead: true
  },
  {
    id: 'notif-seed-4',
    type: 'account',
    title: 'Profile Linked Securely 🔒',
    message: 'Your phone login has been fully authenticated. Track active kitchen queues from any screen.',
    timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(), // 5 days ago
    isRead: true
  }
];

const DEFAULT_SETTINGS: NotificationSettings = {
  order_update: true,
  payment_alert: true,
  promotional_offer: true,
  new_menu_item: true,
  rewards: true,
  account: true
};

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [view, setView] = useState<'home' | 'track' | 'admin' | 'admin-login'>(() => {
    const path = window.location.pathname;
    if (path === '/admin-login') {
      return 'admin-login';
    }
    if (path === '/admin' || path === '/admin/dashboard') {
      const isAuth = localStorage.getItem('nutridelight_admin_auth') === 'true' || 
                     sessionStorage.getItem('nutridelight_admin_auth') === 'true';
      return isAuth ? 'admin' : 'admin-login';
    }
    if (path === '/track') {
      return 'track';
    }
    return 'home';
  });
  const [wasAccessDenied, setWasAccessDenied] = useState(() => {
    const path = window.location.pathname;
    if (path === '/admin' || path === '/admin/dashboard') {
      const isAuth = localStorage.getItem('nutridelight_admin_auth') === 'true' || 
                     sessionStorage.getItem('nutridelight_admin_auth') === 'true';
      return !isAuth;
    }
    return false;
  });
  const [trackingOrderId, setTrackingOrderId] = useState('');
  
  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');

  // Customer Authentication state
  const [loggedInCustomer, setLoggedInCustomer] = useState<{ name: string; email: string; phone: string; } | null>(() => {
    try {
      const stored = localStorage.getItem('nutridelight_customer_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isCustomerLoginOpen, setIsCustomerLoginOpen] = useState(false);

  // Administrative Authentication state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return localStorage.getItem('nutridelight_admin_auth') === 'true' || 
           sessionStorage.getItem('nutridelight_admin_auth') === 'true';
  });

  // Dynamic Master Menu Items state
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    try {
      const stored = localStorage.getItem('nutridelight_menu_items');
      return stored ? JSON.parse(stored) : MENU_ITEMS;
    } catch {
      return MENU_ITEMS;
    }
  });

  // Dynamic Stock Status list
  const [soldOutItems, setSoldOutItems] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('nutridelight_sold_out');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Customer Favorites list
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('nutridelight_favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Global Kitchen Parameter state
  const [kitchenOpen, setKitchenOpen] = useState(() => {
    return localStorage.getItem('nutridelight_kitchen_open') !== 'false';
  });

  // Global Free Delivery threshold state
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(() => {
    const stored = localStorage.getItem('nutridelight_free_delivery_threshold');
    return stored ? parseInt(stored) : 200;
  });

  // Global Hub Settings
  const [restaurantName, setRestaurantName] = useState(() => {
    return localStorage.getItem('nutridelight_restaurant_name') || 'NutriDelight';
  });
  const [restaurantPhone, setRestaurantPhone] = useState(() => {
    return localStorage.getItem('nutridelight_restaurant_phone') || '+91 9010972333';
  });
  const [openingHours, setOpeningHours] = useState(() => {
    return localStorage.getItem('nutridelight_opening_hours') || '7:00 AM - 10:00 PM';
  });
  const [deliveryFeeAmount, setDeliveryFeeAmount] = useState(() => {
    const stored = localStorage.getItem('nutridelight_delivery_fee');
    return stored ? parseInt(stored) : 30;
  });
  const [gstPercentage, setGstPercentage] = useState(() => {
    const stored = localStorage.getItem('nutridelight_gst_percentage');
    return stored ? parseInt(stored) : 5;
  });

  // Load notifications from localStorage
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const stored = localStorage.getItem('nutridelight_notifications');
      return stored ? JSON.parse(stored) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });

  // Load notification settings from localStorage
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    try {
      const stored = localStorage.getItem('nutridelight_settings');
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Save to localStorage whenever notifications change
  useEffect(() => {
    localStorage.setItem('nutridelight_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Save to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem('nutridelight_settings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  // Sync parameters to local storage as fallback
  useEffect(() => {
    localStorage.setItem('nutridelight_menu_items', JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem('nutridelight_sold_out', JSON.stringify(soldOutItems));
  }, [soldOutItems]);

  useEffect(() => {
    localStorage.setItem('nutridelight_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('nutridelight_kitchen_open', String(kitchenOpen));
  }, [kitchenOpen]);

  useEffect(() => {
    localStorage.setItem('nutridelight_free_delivery_threshold', String(freeDeliveryThreshold));
  }, [freeDeliveryThreshold]);

  // Load menu items from Firestore
  useEffect(() => {
    if (!hasConfig) return;

    const fetchMenuItems = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'menu_items'));
        if (!querySnapshot.empty) {
          const list: MenuItem[] = [];
          querySnapshot.forEach((docSnap) => {
            list.push(docSnap.data() as MenuItem);
          });
          setMenuItems(list);
        } else {
          // Seed menu items in Firestore
          for (const item of MENU_ITEMS) {
            await setDoc(doc(db, 'menu_items', item.id), item);
          }
        }
      } catch (err) {
        console.error("Error fetching menu items from Firestore:", err);
      }
    };

    fetchMenuItems();
  }, []);

  // Load reviews from Firestore
  useEffect(() => {
    if (!hasConfig) return;

    const fetchReviews = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'reviews'));
        if (!querySnapshot.empty) {
          const list: Review[] = [];
          querySnapshot.forEach((docSnap) => {
            list.push(docSnap.data() as Review);
          });
          list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setReviews(list);
        } else {
          // Seed reviews in Firestore
          for (const review of INITIAL_REVIEWS) {
            await setDoc(doc(db, 'reviews', review.id), review);
          }
        }
      } catch (err) {
        console.error("Error fetching reviews from Firestore:", err);
      }
    };

    fetchReviews();
  }, []);

  // Listen for real-time global settings from Firestore
  useEffect(() => {
    if (!hasConfig) return;

    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.soldOutItems !== undefined) setSoldOutItems(data.soldOutItems);
        if (data.kitchenOpen !== undefined) setKitchenOpen(data.kitchenOpen);
        if (data.freeDeliveryThreshold !== undefined) setFreeDeliveryThreshold(data.freeDeliveryThreshold);
        if (data.restaurantName !== undefined) setRestaurantName(data.restaurantName);
        if (data.restaurantPhone !== undefined) setRestaurantPhone(data.restaurantPhone);
        if (data.openingHours !== undefined) setOpeningHours(data.openingHours);
        if (data.deliveryFeeAmount !== undefined) setDeliveryFeeAmount(data.deliveryFeeAmount);
        if (data.gstPercentage !== undefined) setGstPercentage(data.gstPercentage);
      } else {
        setDoc(doc(db, 'settings', 'global'), {
          soldOutItems: [],
          kitchenOpen: true,
          freeDeliveryThreshold: 200,
          restaurantName: 'NutriDelight',
          restaurantPhone: '+91 9010972333',
          openingHours: '7:00 AM - 10:00 PM',
          deliveryFeeAmount: 30,
          gstPercentage: 5
        }).catch(err => console.error("Error initializing global settings:", err));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateMenuItems = async (newItems: MenuItem[]) => {
    setMenuItems(newItems);
    if (hasConfig) {
      try {
        for (const item of newItems) {
          await setDoc(doc(db, 'menu_items', item.id), item);
        }
      } catch (err) {
        console.error("Failed to sync menu items to Firestore:", err);
      }
    }
  };

  const handleToggleSoldOut = async (itemId: string) => {
    const nextSoldOut = soldOutItems.includes(itemId) 
      ? soldOutItems.filter(id => id !== itemId) 
      : [...soldOutItems, itemId];
    
    setSoldOutItems(nextSoldOut);
    
    if (hasConfig) {
      try {
        await setDoc(doc(db, 'settings', 'global'), { soldOutItems: nextSoldOut }, { merge: true });
      } catch (err) {
        console.error("Error updating soldOutItems in Firestore:", err);
      }
    }
  };

  const handleUpdateKitchenOpen = async (open: boolean) => {
    setKitchenOpen(open);
    if (hasConfig) {
      try {
        await setDoc(doc(db, 'settings', 'global'), { kitchenOpen: open }, { merge: true });
      } catch (err) {
        console.error("Error updating kitchenOpen in Firestore:", err);
      }
    }
  };

  const handleUpdateFreeDeliveryThreshold = async (threshold: number) => {
    setFreeDeliveryThreshold(threshold);
    if (hasConfig) {
      try {
        await setDoc(doc(db, 'settings', 'global'), { freeDeliveryThreshold: threshold }, { merge: true });
      } catch (err) {
        console.error("Error updating freeDeliveryThreshold in Firestore:", err);
      }
    }
  };

  const handleUpdateRestaurantName = async (name: string) => {
    setRestaurantName(name);
    localStorage.setItem('nutridelight_restaurant_name', name);
    if (hasConfig) {
      try {
        await setDoc(doc(db, 'settings', 'global'), { restaurantName: name }, { merge: true });
      } catch (err) {
        console.error("Error updating restaurantName in Firestore:", err);
      }
    }
  };

  const handleUpdateRestaurantPhone = async (phone: string) => {
    setRestaurantPhone(phone);
    localStorage.setItem('nutridelight_restaurant_phone', phone);
    if (hasConfig) {
      try {
        await setDoc(doc(db, 'settings', 'global'), { restaurantPhone: phone }, { merge: true });
      } catch (err) {
        console.error("Error updating restaurantPhone in Firestore:", err);
      }
    }
  };

  const handleUpdateOpeningHours = async (hours: string) => {
    setOpeningHours(hours);
    localStorage.setItem('nutridelight_opening_hours', hours);
    if (hasConfig) {
      try {
        await setDoc(doc(db, 'settings', 'global'), { openingHours: hours }, { merge: true });
      } catch (err) {
        console.error("Error updating openingHours in Firestore:", err);
      }
    }
  };

  const handleUpdateDeliveryFeeAmount = async (fee: number) => {
    setDeliveryFeeAmount(fee);
    localStorage.setItem('nutridelight_delivery_fee', String(fee));
    if (hasConfig) {
      try {
        await setDoc(doc(db, 'settings', 'global'), { deliveryFeeAmount: fee }, { merge: true });
      } catch (err) {
        console.error("Error updating deliveryFeeAmount in Firestore:", err);
      }
    }
  };

  const handleUpdateGstPercentage = async (pct: number) => {
    setGstPercentage(pct);
    localStorage.setItem('nutridelight_gst_percentage', String(pct));
    if (hasConfig) {
      try {
        await setDoc(doc(db, 'settings', 'global'), { gstPercentage: pct }, { merge: true });
      } catch (err) {
        console.error("Error updating gstPercentage in Firestore:", err);
      }
    }
  };

  // Synchronize browser URL pathname with current React view state
  useEffect(() => {
    const path = window.location.pathname;
    let targetPath = '/';
    
    if (view === 'admin-login') {
      targetPath = '/admin-login';
    } else if (view === 'admin') {
      targetPath = '/admin/dashboard';
    } else if (view === 'track') {
      targetPath = '/track';
    }
    
    if (path !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, [view]);

  // Listen to browser Back and Forward navigation buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/admin-login') {
        setView('admin-login');
      } else if (path === '/admin' || path === '/admin/dashboard') {
        const isAuth = localStorage.getItem('nutridelight_admin_auth') === 'true' || 
                       sessionStorage.getItem('nutridelight_admin_auth') === 'true';
        if (isAuth) {
          setView('admin');
        } else {
          setWasAccessDenied(true);
          setView('admin-login');
        }
      } else if (path === '/track') {
        setView('track');
      } else {
        setView('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Redirect unauthenticated users trying to access "/admin" to "/admin-login"
  useEffect(() => {
    if (view === 'admin' && !isAdminLoggedIn) {
      setWasAccessDenied(true);
      setView('admin-login');
    }
  }, [view, isAdminLoggedIn]);

  const handleToggleFavorite = (itemId: string) => {
    setFavorites(prev => {
      const next = prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId];
      return next;
    });
  };

  const handleLoginCustomer = (customer: { name: string; email: string; phone: string; }) => {
    setLoggedInCustomer(customer);
  };

  const handleLogoutCustomer = () => {
    localStorage.removeItem('nutridelight_customer_session');
    setLoggedInCustomer(null);
  };

  const handleLogoutAdmin = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out from Firebase:", err);
    }
    localStorage.removeItem('nutridelight_admin_auth');
    sessionStorage.removeItem('nutridelight_admin_auth');
    setIsAdminLoggedIn(false);
    setView('home');
  };

  const addNotification = (type: NotificationType, title: string, message: string, orderId?: string) => {
    // Only append if the category is enabled in settings
    if (notificationSettings[type] === false) return;

    const newNotif: Notification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      isRead: false,
      orderId
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleUpdateNotificationSettings = (newSettings: NotificationSettings) => {
    setNotificationSettings(newSettings);
  };

  // Smooth scroll handler
  const handleScrollTo = (elementId: string) => {
    setView('home');
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Standard item addition with full customization
  const handleAddToCartWithCustomization = (
    item: MenuItem,
    quantity: number,
    preference: string = 'Standard',
    customNotes: string = ''
  ) => {
    const uniqueCartId = `${item.id}-${preference.replace(/\s+/g, '').toLowerCase()}`;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((c) => c.id === uniqueCartId);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
          customNotes: customNotes || updated[existingIndex].customNotes,
        };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            id: uniqueCartId,
            menuItem: item,
            quantity,
            selectedPreference: preference,
            customNotes,
          },
        ];
      }
    });

    setIsCartOpen(true);
  };

  // Instant add from grid (quantity 1, standard settings)
  const handleQuickAdd = (item: MenuItem, quantity: number = 1) => {
    handleAddToCartWithCustomization(item, quantity, 'Standard', '');
  };

  const handleUpdateQuantity = (cartItemId: string, change: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === cartItemId) {
            return { ...item, quantity: item.quantity + change };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== cartItemId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleAddReview = async (newReview: Review) => {
    setReviews((prev) => [newReview, ...prev]);
    if (hasConfig) {
      try {
        await setDoc(doc(db, 'reviews', newReview.id), newReview);
      } catch (err) {
        console.error("Error saving review to Firestore:", err);
      }
    }
  };

  // Calculate pricing numbers
  const subtotal = cart.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const deliveryFee = subtotal >= freeDeliveryThreshold || subtotal === 0 ? 0 : deliveryFeeAmount;
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased text-gray-800 bg-[#fafdfb] selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Closed warning ribbon for custom closed kitchens */}
      {!kitchenOpen && view !== 'admin' && (
        <div className="bg-amber-50 border-b border-amber-200 py-3 px-4 text-center">
          <p className="text-xs font-bold text-amber-800 flex items-center justify-center gap-1.5 flex-wrap">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            <span>We are currently at peak clinical capacity. You can still browse our healthy dishes, but new checkouts are temporarily paused.</span>
          </p>
        </div>
      )}

      {/* Navigation */}
      {view !== 'admin' && view !== 'admin-login' && (
        <Navbar
          cartCount={cartCount}
          onOpenCart={() => setIsCartOpen(true)}
          onScrollTo={handleScrollTo}
          activeView={view}
          onViewChange={(newView) => {
            setView(newView);
            setTrackingOrderId('');
          }}
          notifications={notifications}
          settings={notificationSettings}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onDelete={handleDeleteNotification}
          onClearAll={handleClearAllNotifications}
          onUpdateSettings={handleUpdateNotificationSettings}
          onTrackOrder={(orderId) => {
            setTrackingOrderId(orderId);
            setView('track');
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          loggedInCustomer={loggedInCustomer}
          onLogoutCustomer={handleLogoutCustomer}
          onOpenLoginModal={() => setIsCustomerLoginOpen(true)}
        />
      )}

      {/* Main Core View Modules */}
      <main className="flex-grow">
        {view === 'home' && (
          <>
            {/* Hero Section */}
            <Hero onScrollTo={handleScrollTo} />

            {/* Categories Health Menu */}
            <MenuSection
              menuItems={menuItems}
              onSelectItem={(item) => setSelectedItem(item)}
              onQuickAdd={handleQuickAdd}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              soldOutItems={soldOutItems}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />

            {/* Customer Testimonials & Reviews */}
            <ReviewsSection reviews={reviews} onAddReview={handleAddReview} />
          </>
        )}

        {view === 'track' && (
          <TrackOrder
            onBackToHome={() => setView('home')}
            initialOrderId={trackingOrderId}
            addNotification={addNotification}
          />
        )}

        {view === 'admin-login' && (
          <AdminLogin
            onLoginSuccess={() => {
              setIsAdminLoggedIn(true);
              setWasAccessDenied(false);
              setView('admin');
            }}
            onBackToHome={() => {
              setWasAccessDenied(false);
              setView('home');
            }}
            showAccessDenied={wasAccessDenied}
          />
        )}

        {view === 'admin' && (
          isAdminLoggedIn ? (
            <AdminDashboard
              onBackToHome={() => setView('home')}
              addNotification={addNotification}
              onLogoutAdmin={() => {
                setWasAccessDenied(false);
                handleLogoutAdmin();
              }}
              menuItems={menuItems}
              onUpdateMenu={handleUpdateMenuItems}
              kitchenOpen={kitchenOpen}
              setKitchenOpen={handleUpdateKitchenOpen}
              freeDeliveryThreshold={freeDeliveryThreshold}
              setFreeDeliveryThreshold={handleUpdateFreeDeliveryThreshold}
              soldOutItems={soldOutItems}
              onToggleAvailability={handleToggleSoldOut}
              restaurantName={restaurantName}
              setRestaurantName={handleUpdateRestaurantName}
              restaurantPhone={restaurantPhone}
              setRestaurantPhone={handleUpdateRestaurantPhone}
              openingHours={openingHours}
              setOpeningHours={handleUpdateOpeningHours}
              deliveryFeeAmount={deliveryFeeAmount}
              setDeliveryFeeAmount={handleUpdateDeliveryFeeAmount}
              gstPercentage={gstPercentage}
              setGstPercentage={handleUpdateGstPercentage}
            />
          ) : (
            <AdminLogin
              onLoginSuccess={() => {
                setIsAdminLoggedIn(true);
                setWasAccessDenied(false);
                setView('admin');
              }}
              onBackToHome={() => {
                setWasAccessDenied(false);
                setView('home');
              }}
              showAccessDenied={true}
            />
          )
        )}
      </main>

      {/* Footnote Branding */}
      {view !== 'admin' && view !== 'admin-login' && (
        <Footer 
          onScrollTo={handleScrollTo} 
          onViewChange={(newView) => {
            setView(newView);
            setTrackingOrderId('');
          }}
        />
      )}

      {/* Customer Login / Register Modal */}
      <CustomerLoginModal
        isOpen={isCustomerLoginOpen}
        onClose={() => setIsCustomerLoginOpen(false)}
        onLoginSuccess={handleLoginCustomer}
      />

      {/* Slide-out cart drawer */}
      <CartSidebar
        isOpen={isCartOpen}
        cart={cart}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
        kitchenOpen={kitchenOpen}
        freeDeliveryThreshold={freeDeliveryThreshold}
      />

      {/* Nutrient / Customization Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToCart={(item, qty, pref, notes) =>
            handleAddToCartWithCustomization(item, qty, pref, notes)
          }
        />
      )}

      {/* Multi-step express checkout panel modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          cart={cart}
          total={subtotal}
          deliveryFee={deliveryFee}
          onClose={() => setIsCheckoutOpen(false)}
          onClearCart={handleClearCart}
          onTrackOrder={(orderId) => {
            setTrackingOrderId(orderId);
            setView('track');
            setIsCheckoutOpen(false);
          }}
          addNotification={addNotification}
          loggedInCustomer={loggedInCustomer}
          gstPercentage={gstPercentage}
        />
      )}

    </div>
  );
}
