export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: 'breakfast' | 'tea_coffee' | 'flavored_milk' | 'juices' | 'cold_pressed_juices' | 'snacks' | 'desserts';
  calories: number;
  protein: number; // in grams
  carbs: number; // in grams
  fats: number; // in grams
  rating: number;
  ingredients: string[];
  tags: string[];
  isFeatured?: boolean;
}

export interface CartItem {
  id: string; // unique for item + preferences
  menuItem: MenuItem;
  quantity: number;
  customNotes?: string;
  selectedPreference?: string; // e.g. "Extra Protein", "Gluten-Free", "Vegan"
}

export interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
  avatarColor: string;
}

export type OrderStatus = 'Order Placed' | 'Order Accepted' | 'Preparing' | 'Ready for Pickup' | 'Completed' | 'confirmed' | 'preparing' | 'ready' | 'completed';

export type NotificationType = 'order_update' | 'payment_alert' | 'promotional_offer' | 'new_menu_item' | 'rewards' | 'account';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  orderId?: string;
}

export interface NotificationSettings {
  order_update: boolean;
  payment_alert: boolean;
  promotional_offer: boolean;
  new_menu_item: boolean;
  rewards: boolean;
  account: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  selectedPreference: string;
  customNotes: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: 'deliver' | 'pickup';
  deliveryAddress: string;
  paymentMethod: 'upi' | 'cod' | 'card';
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  estimatedTime: string;
}

