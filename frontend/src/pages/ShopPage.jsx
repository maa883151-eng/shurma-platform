import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ShoppingBag, ShoppingCart, Star, Plus, Loader2, Search, Heart, Zap, X, Clock } from 'lucide-react';

function timeLeft(ts) {
  const s = Math.max(0, (new Date(ts) - Date.now()) / 1000);
  if (s <= 0) return 'Ended';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function ProductCard({ product, onAddToCart, onWishlist, wishlisted }) {
  const activePrice = product.deal_price && product.deal_ends_at && new Date(product.deal_ends_at) > new Date()
    ? product.deal_price
    : product.price;
  const isDeal = activePrice !== product.price;

  return (
    <div className="card p-0 overflow-hidden hover:border-primary-500/40 transition-colors group relative">
      <div className="aspect-square bg-gray-800 flex items-center justify-center overflow-hidden relative">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <ShoppingBag size={32} className="text-gray-600" />
        )}
        {isDeal && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
            DEAL
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onWishlist(product); }}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-900/80 flex items-center justify-center transition-colors ${wishlisted ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}`}
        >
          <Heart size={13} fill={wishlisted ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium text-gray-100 truncate">{product.name}</p>
        <p className="text-xs text-gray-500 truncate">{product.shop_name}</p>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-base font-bold text-primary-400">${parseFloat(activePrice).toFixed(2)}</span>
            {(product.compare_price || isDeal) && (
              <span className="text-xs text-gray-600 line-through ml-1">
                ${parseFloat(isDeal ? product.price : product.compare_price).toFixed(2)}
              </span>
            )}
          </div>
          <button
            onClick={() => onAddToCart(product)}
            className="bg-primary-500/20 hover:bg-primary-500 text-primary-400 hover:text-white rounded-lg p-1.5 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        {isDeal && product.deal_ends_at && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <Clock size={10} /> {timeLeft(product.deal_ends_at)}
          </div>
        )}
        {product.rating > 0 && (
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <Star size={10} fill="currentColor" />
            <span>{parseFloat(product.rating).toFixed(1)}</span>
            <span className="text-gray-600">({product.review_count})</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [tab, setTab] = useState('shop');

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchCart();
    fetchWishlist();
    fetchDeals();
  }, []);

  useEffect(() => { fetchProducts(); }, [activeCategory, searchQuery]);

  const fetchCategories = async () => {
    const { data } = await api.get('/shop/categories');
    setCategories(data.categories);
  };

  const fetchDeals = async () => {
    try {
      const { data } = await api.get('/shop/deals');
      setDeals(data.deals);
    } catch {}
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory) params.set('category', activeCategory);
      if (searchQuery) params.set('q', searchQuery);
      const { data } = await api.get(`/shop/products?${params}`);
      setProducts(data.products);
    } finally { setLoading(false); }
  };

  const fetchCart = async () => {
    const { data } = await api.get('/shop/cart');
    setCart(data.cart);
    setCartTotal(data.total);
  };

  const fetchWishlist = async () => {
    try {
      const { data } = await api.get('/shop/wishlist');
      setWishlist(data.wishlist.map((p) => p.id));
    } catch {}
  };

  const addToCart = async (product) => {
    try {
      await api.post('/shop/cart', { product_id: product.id });
      fetchCart();
    } catch {}
  };

  const toggleWishlist = async (product) => {
    try {
      if (wishlist.includes(product.id)) {
        await api.delete(`/shop/wishlist/${product.id}`);
        setWishlist((w) => w.filter((id) => id !== product.id));
      } else {
        await api.post('/shop/wishlist', { product_id: product.id });
        setWishlist((w) => [...w, product.id]);
      }
    } catch {}
  };

  const removeFromCart = async (productId) => {
    await api.delete(`/shop/cart/${productId}`);
    fetchCart();
  };

  const checkout = async () => {
    setCheckingOut(true);
    try {
      const { data } = await api.post('/shop/checkout');
      if (data.url) window.open(data.url, '_blank');
      else { alert('Order placed! (Demo mode)'); fetchCart(); }
    } catch {} finally { setCheckingOut(false); }
  };

  const displayProducts = tab === 'wishlist'
    ? products.filter((p) => wishlist.includes(p.id))
    : products;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ShoppingBag size={20} className="text-primary-400" /> Marketplace
        </h1>
        <button onClick={() => setShowCart(!showCart)} className="relative btn-ghost flex items-center gap-2 text-sm">
          <ShoppingCart size={18} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full text-xs flex items-center justify-center font-bold">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* Cart panel */}
      {showCart && (
        <div className="card p-4 space-y-3 animate-slide-down">
          <h3 className="font-semibold text-white">Cart ({cart.length})</h3>
          {cart.length === 0 ? (
            <p className="text-sm text-gray-500">Cart is empty</p>
          ) : (
            <>
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <div className="flex-1 truncate">
                    <span className="text-gray-200">{item.name}</span>
                    <span className="text-gray-500 ml-2">×{item.quantity}</span>
                  </div>
                  <span className="text-primary-400">${(item.price * item.quantity).toFixed(2)}</span>
                  <button onClick={() => removeFromCart(item.product_id)} className="text-gray-600 hover:text-red-400 text-xs">Remove</button>
                </div>
              ))}
              <div className="border-t border-gray-800 pt-3 flex items-center justify-between">
                <span className="font-semibold text-white">Total: ${cartTotal}</span>
                <button onClick={checkout} disabled={checkingOut} className="btn-primary text-sm">
                  {checkingOut ? <Loader2 size={14} className="animate-spin" /> : 'Checkout'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Flash Deals */}
      {deals.length > 0 && tab === 'shop' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-yellow-400" />
            <h2 className="text-sm font-bold text-gray-200">Flash Deals</h2>
            <span className="text-xs text-gray-500">· Limited time</span>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {deals.map((p) => (
              <div key={p.id} className="shrink-0 w-36 card p-0 overflow-hidden hover:border-red-500/40 transition-colors">
                <div className="h-24 bg-gray-800 overflow-hidden relative">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={24} className="text-gray-600" /></div>
                  )}
                  <div className="absolute top-1 left-1 bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 rounded">
                    -{Math.round((1 - p.deal_price / p.price) * 100)}%
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-200 truncate font-medium">{p.name}</p>
                  <p className="text-sm font-bold text-red-400">${parseFloat(p.deal_price).toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500 flex items-center gap-0.5"><Clock size={8} /> {timeLeft(p.deal_ends_at)}</p>
                  <button onClick={() => addToCart(p)} className="mt-1 w-full bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded text-xs py-1 transition-colors">
                    Add to cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
        {[['shop', 'Shop'], ['wishlist', `Wishlist${wishlist.length ? ` (${wishlist.length})` : ''}`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'shop' && (
        <>
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="input pl-9" placeholder="Search products…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button onClick={() => setActiveCategory('')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!activeCategory ? 'bg-primary-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-100'}`}>
              All
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.slug)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat.slug ? 'bg-primary-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-100'}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary-500" size={28} /></div>
      ) : displayProducts.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
          <p>{tab === 'wishlist' ? 'No saved items' : 'No products found'}</p>
          {tab === 'wishlist' && <p className="text-xs mt-1">Tap the ♥ on products to save them here.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayProducts.map((p) => (
            <ProductCard key={p.id} product={p} onAddToCart={addToCart} onWishlist={toggleWishlist} wishlisted={wishlist.includes(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
