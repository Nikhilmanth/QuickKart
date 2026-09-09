import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken } from './api.js';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const EMPTY_CART = {
  items: [],
  count: 0,
  total: 0,
  items_total: 0,
  mrp_total: 0,
  savings: 0,
  delivery_fee: 25,
};

function calcCart(items) {
  const count = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const items_total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
  const mrp_total = items.reduce((s, i) => s + (Number(i.mrp || i.price) || 0) * (Number(i.qty) || 0), 0);
  const savings = Math.max(0, mrp_total - items_total);
  const delivery_fee = items_total >= 199 || items_total === 0 ? 0 : 25;
  const total = items_total + (items_total === 0 ? 0 : delivery_fee);

  return {
    items,
    count,
    items_total: Math.round(items_total * 100) / 100,
    mrp_total: Math.round(mrp_total * 100) / 100,
    savings: Math.round(savings * 100) / 100,
    delivery_fee,
    total: Math.round(total * 100) / 100,
  };
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('quickkart_local_cart');
      if (saved) {
        const items = JSON.parse(saved);
        if (Array.isArray(items) && items.length) {
          return calcCart(items);
        }
      }
    } catch {}
    return EMPTY_CART;
  });
  const [toast, setToast] = useState(null);

  // Persisted delivery location ("current location" or manually typed)
  const [location, setLocationState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('quickkart_location') || localStorage.getItem('blinkit_location') || 'null');
    } catch { return null; }
  });

  const setLocation = (loc) => {
    setLocationState(loc);
    localStorage.setItem('quickkart_location', JSON.stringify(loc));
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Sync session on mount
  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me')
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => {});
  }, []);

  const refreshCart = async () => {
    if (!getToken()) return;
    try {
      const serverCart = await api.get('/cart');
      if (serverCart && serverCart.items) {
        setCart(serverCart);
      }
    } catch {}
  };

  // Merge local guest cart into server cart once user logs in
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const localSaved = localStorage.getItem('quickkart_local_cart');
        if (localSaved) {
          const items = JSON.parse(localSaved);
          if (Array.isArray(items) && items.length) {
            for (const item of items) {
              await api.post('/cart/items', { productId: item.product_id, qty: item.qty }).catch(() => {});
            }
            localStorage.removeItem('quickkart_local_cart');
          }
        }
      } catch {}
      refreshCart();
    })();
  }, [user?.id]);

  const addToCart = async (productOrId) => {
    const isObj = typeof productOrId === 'object' && productOrId !== null;
    const productId = isObj ? productOrId.id : Number(productOrId);

    if (user && getToken()) {
      try {
        const updated = await api.post('/cart/items', { productId, qty: 1 });
        setCart(updated);
        showToast('Added to cart 🛒');
      } catch (e) {
        showToast(e.message || 'Could not add to cart');
      }
      return;
    }

    // Guest cart in localStorage
    try {
      let product = isObj ? productOrId : null;
      if (!product) {
        // Fetch product if only ID was passed
        const d = await api.get(`/catalog/products/${productId}`);
        product = d.product;
      }

      setCart((prev) => {
        const existingIdx = prev.items.findIndex((i) => (i.product_id ?? i.id) === productId);
        let nextItems;
        if (existingIdx >= 0) {
          nextItems = prev.items.map((it, idx) =>
            idx === existingIdx ? { ...it, qty: it.qty + 1 } : it
          );
        } else {
          nextItems = [
            ...prev.items,
            {
              product_id: productId,
              name: product.name,
              brand: product.brand || '',
              price: product.price,
              mrp: product.mrp,
              unit: product.unit || '',
              icon: product.icon || '📦',
              image_url: product.image_url || '',
              stock: product.stock || 50,
              qty: 1,
            },
          ];
        }
        localStorage.setItem('quickkart_local_cart', JSON.stringify(nextItems));
        return calcCart(nextItems);
      });
      showToast('Added to cart 🛒');
    } catch (e) {
      showToast(e.message || 'Could not add to cart');
    }
  };

  const updateQty = async (productId, qty) => {
    const pId = Number(productId);
    if (user && getToken()) {
      try {
        const updated = await api.patch(`/cart/items/${pId}`, { qty });
        setCart(updated);
      } catch (e) {
        showToast(e.message || 'Could not update quantity');
      }
      return;
    }

    // Guest cart
    setCart((prev) => {
      let nextItems;
      if (qty <= 0) {
        nextItems = prev.items.filter((i) => (i.product_id ?? i.id) !== pId);
      } else {
        nextItems = prev.items.map((i) =>
          (i.product_id ?? i.id) === pId ? { ...i, qty } : i
        );
      }
      localStorage.setItem('quickkart_local_cart', JSON.stringify(nextItems));
      return calcCart(nextItems);
    });
  };

  const removeItem = async (productId) => {
    return updateQty(productId, 0);
  };

  return (
    <AppCtx.Provider
      value={{
        user,
        setUser,
        cart,
        refreshCart,
        addToCart,
        updateQty,
        removeItem,
        toast,
        showToast,
        location,
        setLocation,
      }}
    >
      {children}
      {toast && <div className="toast">{toast}</div>}
    </AppCtx.Provider>
  );
}
