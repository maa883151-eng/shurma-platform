import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ShoppingBag, ShoppingCart, Star, Plus, Loader2, Search } from 'lucide-react';

function ProductCard({ product, onAddToCart }) {
  return (
    <div className="card p-0 overflow-hidden hover:border-primary-500/40 transition-colors">
      <div className="aspect-square bg-gray-800 flex items-center justify-center overflow-hidden">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <ShoppingBag size={32} className="text-gray-600" />
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium text-gray-100 truncate">{product.name}</p>
        <p className="text-xs text-gray-500 truncate">{product.shop_name}</p>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-base font-bold text-primary-400">${parseFloat(product.price).toFixed(2)}</span>
            {product.compare_price && (
              <span className="text-xs text-gray-600 line-through ml-1">${parseFloat(product.compare_price).toFixed(2)}</span>
            )}
          </div>
          <button
            onClick={() => onAddToCart(product)}
            className="bg-primary-500/20 hover:bg-primary-500 text-primary-400 hover:text-white rounded-lg p-1.5 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
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
  const { slug } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
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
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [activeCategory, searchQuery]);

  const fetchCategories = async () => {
    const { data } = await api.get('/shop/categories');
    setCategories(data.categories);
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

  const addToCart = async (product) => {
    try {
      await api.post('/shop/cart', { product_id: product.id });
      fetchCart();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Marketplace</h1>
        <button onClick={() => setShowCart(!showCart)} className="relative btn-ghost flex items-center gap-2">
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
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold text-white">Your Cart ({cart.length} items)</h3>
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

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input pl-9"
          placeholder="Search products…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveCategory('')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!activeCategory ? 'bg-primary-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-100'}`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.slug)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat.slug ? 'bg-primary-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-100'}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary-500" size={28} /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
          <p>No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onAddToCart={addToCart} />
          ))}
        </div>
      )}
    </div>
  );
}
