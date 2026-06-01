import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Box, 
  Users, 
  ShoppingBag, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  X, 
  TrendingUp, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  Info,
  RefreshCw
} from 'lucide-react';

// --- Type Definitions ---
interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

interface OrderItemDetail {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product: {
    id: number;
    name: string;
    sku: string;
    price: number;
  };
}

interface OrderDetail {
  id: number;
  customer_id: number;
  total_price: number;
  status: string;
  created_at: string;
  customer: Customer;
  items: OrderItemDetail[];
}

interface DashboardStats {
  total_products: number;
  total_customers: number;
  total_orders: number;
  low_stock_count: number;
  total_sales: number;
  recent_orders: OrderDetail[];
}

type Page = 'dashboard' | 'products' | 'customers' | 'orders';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  // Search states
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Loading & Toast Notification states
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals Visibility
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Modal Editing Targets
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetail | null>(null);

  // Form States
  const [productForm, setProductForm] = useState({ sku: '', name: '', description: '', price: 0, stock: 0 });
  const [customerForm, setCustomerForm] = useState({ name: '', email: '' });
  const [orderForm, setOrderForm] = useState<{ customer_id: string; items: { product_id: string; quantity: number }[] }>({
    customer_id: '',
    items: [{ product_id: '', quantity: 1 }]
  });

  // Base API configuration (Vite proxy redirects to backend)
  const API_BASE = '';

  // Trigger Toast Notification
  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // --- API Fetches ---
  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  const fetchProducts = async (searchStr = '') => {
    try {
      const url = searchStr 
        ? `${API_BASE}/api/products?search=${encodeURIComponent(searchStr)}`
        : `${API_BASE}/api/products`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchCustomers = async (searchStr = '') => {
    try {
      const url = searchStr 
        ? `${API_BASE}/api/customers?search=${encodeURIComponent(searchStr)}`
        : `${API_BASE}/api/customers`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  // Initial Load & Page Change handler
  useEffect(() => {
    refreshAllData();
  }, [currentPage]);

  const refreshAllData = async () => {
    setIsLoading(true);
    if (currentPage === 'dashboard') {
      await fetchDashboardStats();
    } else if (currentPage === 'products') {
      await fetchProducts(productSearch);
    } else if (currentPage === 'customers') {
      await fetchCustomers(customerSearch);
    } else if (currentPage === 'orders') {
      await fetchOrders();
      // Fetch products and customers too, since the Create Order form needs them
      await fetchProducts();
      await fetchCustomers();
    }
    setIsLoading(false);
  };

  // Handle Search input changes
  useEffect(() => {
    if (currentPage === 'products') {
      const delayDebounceFn = setTimeout(() => {
        fetchProducts(productSearch);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [productSearch]);

  useEffect(() => {
    if (currentPage === 'customers') {
      const delayDebounceFn = setTimeout(() => {
        fetchCustomers(customerSearch);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [customerSearch]);


  // --- Product CRUD Submit ---
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingProduct ? 'PUT' : 'POST';
      const endpoint = editingProduct 
        ? `${API_BASE}/api/products/${editingProduct.id}`
        : `${API_BASE}/api/products`;

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save product');
      }

      notify(editingProduct ? 'Product updated successfully!' : 'Product created successfully!');
      setIsProductModalOpen(false);
      setEditingProduct(null);
      fetchProducts(productSearch);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete product');
      }
      notify('Product deleted successfully');
      fetchProducts(productSearch);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // --- Customer CRUD Submit ---
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingCustomer ? 'PUT' : 'POST';
      const endpoint = editingCustomer
        ? `${API_BASE}/api/customers/${editingCustomer.id}`
        : `${API_BASE}/api/customers`;

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save customer');
      }

      notify(editingCustomer ? 'Customer updated successfully!' : 'Customer created successfully!');
      setIsCustomerModalOpen(false);
      setEditingCustomer(null);
      fetchCustomers(customerSearch);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete customer');
      }
      notify('Customer deleted successfully');
      fetchCustomers(customerSearch);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // --- Order CRUD Submit ---
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!orderForm.customer_id) {
        throw new Error('Please select a customer.');
      }
      
      const parsedItems = orderForm.items.map(item => {
        if (!item.product_id) throw new Error('Please select products for all items.');
        return {
          product_id: parseInt(item.product_id),
          quantity: item.quantity
        };
      });

      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: parseInt(orderForm.customer_id),
          items: parsedItems
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create order');
      }

      notify('Order placed successfully!');
      setIsOrderModalOpen(false);
      fetchOrders();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // Cancel Order
  const handleCancelOrder = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this order? This will restore stock levels.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to cancel order');
      }
      notify('Order cancelled successfully. Stock has been restored.');
      fetchOrders();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // Form Helpers
  const openProductForm = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        price: product.price,
        stock: product.stock
      });
    } else {
      setEditingProduct(null);
      setProductForm({ sku: '', name: '', description: '', price: 0, stock: 0 });
    }
    setIsProductModalOpen(true);
  };

  const openCustomerForm = (customer: Customer | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerForm({ name: customer.name, email: customer.email });
    } else {
      setEditingCustomer(null);
      setCustomerForm({ name: '', email: '' });
    }
    setIsCustomerModalOpen(true);
  };

  const openOrderForm = () => {
    setOrderForm({
      customer_id: '',
      items: [{ product_id: '', quantity: 1 }]
    });
    setIsOrderModalOpen(true);
  };

  const addOrderItemRow = () => {
    setOrderForm({
      ...orderForm,
      items: [...orderForm.items, { product_id: '', quantity: 1 }]
    });
  };

  const removeOrderItemRow = (index: number) => {
    const updated = [...orderForm.items];
    updated.splice(index, 1);
    setOrderForm({ ...orderForm, items: updated });
  };

  const updateOrderItemRow = (index: number, field: 'product_id' | 'quantity', value: any) => {
    const updated = [...orderForm.items];
    updated[index] = { ...updated[index], [field]: value };
    setOrderForm({ ...orderForm, items: updated });
  };

  // Running Total Calculator for Order Modal
  const getOrderTotal = () => {
    return orderForm.items.reduce((sum, item) => {
      if (!item.product_id) return sum;
      const prod = products.find(p => p.id.toString() === item.product_id);
      return sum + (prod ? prod.price * item.quantity : 0);
    }, 0);
  };


  // --- Render Views ---
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <span>Aether Inventory</span>
        </div>
        
        <ul className="nav-links">
          <li>
            <div 
              className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentPage('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${currentPage === 'products' ? 'active' : ''}`}
              onClick={() => setCurrentPage('products')}
            >
              <Box size={18} />
              <span>Products</span>
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${currentPage === 'customers' ? 'active' : ''}`}
              onClick={() => setCurrentPage('customers')}
            >
              <Users size={18} />
              <span>Customers</span>
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${currentPage === 'orders' ? 'active' : ''}`}
              onClick={() => setCurrentPage('orders')}
            >
              <ShoppingBag size={18} />
              <span>Orders</span>
            </div>
          </li>
        </ul>

        {/* Sync Status Info Footer */}
        <div style={{ marginTop: 'auto', padding: '1rem 0 0 0', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={refreshAllData}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Sync Data</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="content">
        {/* Alerts / Toast */}
        {notification && (
          <div className={`toast ${notification.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            {notification.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span>{notification.message}</span>
            <button 
              onClick={() => setNotification(null)} 
              style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* --- View Router --- */}
        {currentPage === 'dashboard' && stats && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Operational Overview</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Real-time stock values and activity</p>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-info">
                  <span className="stat-label">Total Revenue</span>
                  <span className="stat-value">${stats.total_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="stat-icon-wrapper icon-emerald">
                  <DollarSign size={24} />
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-info">
                  <span className="stat-label">Orders Placed</span>
                  <span className="stat-value">{stats.total_orders}</span>
                </div>
                <div className="stat-icon-wrapper icon-blue">
                  <ShoppingBag size={24} />
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-info">
                  <span className="stat-label">Product Catalog</span>
                  <span className="stat-value">{stats.total_products}</span>
                </div>
                <div className="stat-icon-wrapper icon-purple">
                  <Box size={24} />
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-info">
                  <span className="stat-label">Low Stock Alerts</span>
                  <span className="stat-value">{stats.low_stock_count}</span>
                </div>
                <div className={`stat-icon-wrapper ${stats.low_stock_count > 0 ? 'icon-amber' : 'icon-emerald'}`}>
                  <AlertTriangle size={24} />
                </div>
              </div>
            </div>

            {/* Dashboard Sub-grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
              
              {/* Recent Orders */}
              <div className="card">
                <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
                  Recent Activity
                </h2>
                {stats.recent_orders.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-title">No orders yet</p>
                    <p style={{ fontSize: '0.85rem' }}>Generate test orders from the Orders page.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Customer</th>
                          <th>Value</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recent_orders.map(order => (
                          <tr key={order.id}>
                            <td>#{order.id}</td>
                            <td>{order.customer.name}</td>
                            <td>${order.total_price.toFixed(2)}</td>
                            <td>
                              <span className={`badge ${order.status === 'Completed' ? 'badge-success' : order.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Action shortcuts / low stock list */}
              <div className="card">
                <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={18} style={{ color: 'hsl(38, 92%, 50%)' }} />
                  Attention Required
                </h2>
                
                {/* Low Stock Checklist */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Products with 5 or fewer items remaining:
                  </p>
                  {products.filter(p => p.stock <= 5).length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-success)' }}>
                      <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>All stock levels healthy!</span>
                    </div>
                  ) : (
                    products.filter(p => p.stock <= 5).map(prod => (
                      <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-base)', border: '1px solid var(--color-border)' }}>
                        <div>
                          <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{prod.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>SKU: {prod.sku}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className={`badge ${prod.stock === 0 ? 'badge-danger' : 'badge-warning'}`}>
                            {prod.stock} left
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'products' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Product Inventory</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Catalog items, identifiers, and quantities</p>
              </div>
              <button className="btn btn-primary" onClick={() => openProductForm(null)}>
                <Plus size={16} />
                <span>Add Product</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="filter-bar">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search by name, SKU..." 
                  className="search-input"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            <div className="card">
              {products.length === 0 ? (
                <div className="empty-state">
                  <Box size={40} className="empty-state-icon" />
                  <p className="empty-state-title">No products found</p>
                  <p style={{ fontSize: '0.85rem' }}>Try adding a product or clearing your search filter.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Product Name</th>
                        <th>Price</th>
                        <th>Stock Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => (
                        <tr key={product.id}>
                          <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{product.sku}</td>
                          <td>
                            <div>
                              <p style={{ fontWeight: 500 }}>{product.name}</p>
                              {product.description && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{product.description}</p>}
                            </div>
                          </td>
                          <td>${product.price.toFixed(2)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className={`badge ${product.stock > 5 ? 'badge-success' : product.stock === 0 ? 'badge-danger' : 'badge-warning'}`}>
                                {product.stock} units
                              </span>
                              {product.stock <= 5 && (
                                <AlertTriangle size={14} style={{ color: 'hsl(38, 92%, 50%)' }} />
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="actions-cell">
                              <button 
                                className="btn btn-secondary btn-icon" 
                                title="Edit Product"
                                onClick={() => openProductForm(product)}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                className="btn btn-secondary btn-icon" 
                                title="Delete Product"
                                style={{ hoverColor: 'var(--color-danger)' }}
                                onClick={() => handleDeleteProduct(product.id)}
                              >
                                <Trash2 size={14} style={{ color: 'var(--color-danger)' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {currentPage === 'customers' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Customer Registry</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Manage contacts and profile registry</p>
              </div>
              <button className="btn btn-primary" onClick={() => openCustomerForm(null)}>
                <Plus size={16} />
                <span>Add Customer</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="filter-bar">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search by name, email..." 
                  className="search-input"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            <div className="card">
              {customers.length === 0 ? (
                <div className="empty-state">
                  <Users size={40} className="empty-state-icon" />
                  <p className="empty-state-title">No customers found</p>
                  <p style={{ fontSize: '0.85rem' }}>Try adding a customer or clearing your search.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email Address</th>
                        <th>Registered Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map(customer => (
                        <tr key={customer.id}>
                          <td>#{customer.id}</td>
                          <td style={{ fontWeight: 600 }}>{customer.name}</td>
                          <td>{customer.email}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)' }}>
                              <Calendar size={14} />
                              <span>{new Date(customer.created_at).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td>
                            <div className="actions-cell">
                              <button 
                                className="btn btn-secondary btn-icon" 
                                title="Edit Customer"
                                onClick={() => openCustomerForm(customer)}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                className="btn btn-secondary btn-icon" 
                                title="Delete Customer"
                                onClick={() => handleDeleteCustomer(customer.id)}
                              >
                                <Trash2 size={14} style={{ color: 'var(--color-danger)' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {currentPage === 'orders' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Order Directory</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Track orders, amounts, and manage stock returns</p>
              </div>
              <button className="btn btn-primary" onClick={openOrderForm}>
                <Plus size={16} />
                <span>Place Order</span>
              </button>
            </div>

            {/* Table */}
            <div className="card">
              {orders.length === 0 ? (
                <div className="empty-state">
                  <ShoppingBag size={40} className="empty-state-icon" />
                  <p className="empty-state-title">No orders created yet</p>
                  <p style={{ fontSize: '0.85rem' }}>Click "Place Order" to create your first transaction.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Items Count</th>
                        <th>Total Value</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id}>
                          <td style={{ fontWeight: 600 }}>#{order.id}</td>
                          <td>
                            <div>
                              <p style={{ fontWeight: 500 }}>{order.customer.name}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{order.customer.email}</p>
                            </div>
                          </td>
                          <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>${order.total_price.toFixed(2)}</td>
                          <td>
                            <span className={`badge ${order.status === 'Completed' ? 'badge-success' : order.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                              {order.status}
                            </span>
                          </td>
                          <td>
                            <div className="actions-cell">
                              <button 
                                className="btn btn-secondary btn-icon" 
                                title="View Details"
                                onClick={() => {
                                  setSelectedOrderDetail(order);
                                  setIsDetailsModalOpen(true);
                                }}
                              >
                                <Info size={14} />
                              </button>
                              {order.status !== 'Cancelled' && (
                                <button 
                                  className="btn btn-secondary btn-icon" 
                                  title="Cancel Order & Restock"
                                  onClick={() => handleCancelOrder(order.id)}
                                >
                                  <X size={14} style={{ color: 'var(--color-danger)' }} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* --- MODALS --- */}

      {/* 1. Product Form Modal */}
      {isProductModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {editingProduct ? 'Edit Catalog Product' : 'Add New Product'}
              </h2>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleProductSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">SKU (Stock Keeping Unit)</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. APL-128-IPH"
                    className="form-input"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. iPhone 15 Pro Max"
                    className="form-input"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea 
                    placeholder="Brief description..."
                    className="form-input form-textarea"
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unit Price ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required 
                      min="0.01"
                      className="form-input"
                      value={productForm.price || ''}
                      onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Available Stock</label>
                    <input 
                      type="number" 
                      required 
                      min="0"
                      className="form-input"
                      value={productForm.stock === 0 ? '0' : productForm.stock || ''}
                      onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsProductModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Customer Form Modal */}
      {isCustomerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {editingCustomer ? 'Modify Customer Info' : 'Register Customer'}
              </h2>
              <button 
                onClick={() => setIsCustomerModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCustomerSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Full Name"
                    className="form-input"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="name@company.com"
                    className="form-input"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCustomerModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Create Order Modal */}
      {isOrderModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Place New Order</h2>
              <button 
                onClick={() => setIsOrderModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleOrderSubmit}>
              <div className="modal-body">
                
                {/* Select Customer */}
                <div className="form-group">
                  <label className="form-label">Customer</label>
                  <select 
                    required
                    className="form-input"
                    value={orderForm.customer_id}
                    onChange={(e) => setOrderForm({ ...orderForm, customer_id: e.target.value })}
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                    ))}
                  </select>
                </div>

                {/* Items Builder */}
                <div className="form-group">
                  <label className="form-label">Order Items</label>
                  <div className="order-items-builder">
                    {orderForm.items.map((item, index) => {
                      const selectedProduct = products.find(p => p.id.toString() === item.product_id);
                      return (
                        <div className="order-item-row" key={index}>
                          {/* Product Selection */}
                          <select
                            required
                            className="form-input"
                            value={item.product_id}
                            onChange={(e) => updateOrderItemRow(index, 'product_id', e.target.value)}
                          >
                            <option value="">-- Choose Product --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id} disabled={p.stock === 0}>
                                {p.name} (SKU: {p.sku}) - ${p.price.toFixed(2)} [{p.stock} in stock]
                              </option>
                            ))}
                          </select>

                          {/* Unit Price Info */}
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', paddingLeft: '0.5rem' }}>
                            {selectedProduct ? `@ $${selectedProduct.price.toFixed(2)}` : '--'}
                          </div>

                          {/* Quantity */}
                          <input
                            type="number"
                            required
                            min="1"
                            placeholder="Qty"
                            className="form-input"
                            value={item.quantity}
                            onChange={(e) => updateOrderItemRow(index, 'quantity', parseInt(e.target.value) || 1)}
                          />

                          {/* Remove button */}
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            disabled={orderForm.items.length === 1}
                            onClick={() => removeOrderItemRow(index)}
                          >
                            <Trash2 size={14} style={{ color: orderForm.items.length === 1 ? 'var(--color-border)' : 'var(--color-danger)' }} />
                          </button>
                        </div>
                      );
                    })}

                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', marginTop: '0.5rem' }}
                      onClick={addOrderItemRow}
                    >
                      <Plus size={12} />
                      <span>Add Product Item</span>
                    </button>
                  </div>
                </div>

                {/* Total Price preview */}
                <div className="order-total-price">
                  Total Order Value: ${getOrderTotal().toFixed(2)}
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsOrderModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Process Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Order Details Modal */}
      {isDetailsModalOpen && selectedOrderDetail && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Order Details #{selectedOrderDetail.id}</h2>
              <button 
                onClick={() => {
                  setSelectedOrderDetail(null);
                  setIsDetailsModalOpen(false);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {/* Customer Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.25rem' }}>
                <div>
                  <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer Contact</h4>
                  <p style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.25rem' }}>{selectedOrderDetail.customer.name}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{selectedOrderDetail.customer.email}</p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date and Status</h4>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>Ordered: {new Date(selectedOrderDetail.created_at).toLocaleString()}</p>
                  <div style={{ marginTop: '0.4rem' }}>
                    <span className={`badge ${selectedOrderDetail.status === 'Completed' ? 'badge-success' : selectedOrderDetail.status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                      {selectedOrderDetail.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Items Ordered</h4>
              <div className="table-container" style={{ maxHeight: '200px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Unit Cost</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderDetail.items.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 500 }}>{item.product.name}</td>
                        <td>{item.product.sku}</td>
                        <td>{item.quantity}</td>
                        <td>${item.unit_price.toFixed(2)}</td>
                        <td style={{ fontWeight: 600 }}>${(item.unit_price * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>Aggregate Cost</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>${selectedOrderDetail.total_price.toFixed(2)}</span>
              </div>
            </div>
            <div className="modal-footer">
              {selectedOrderDetail.status !== 'Cancelled' && (
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={() => {
                    handleCancelOrder(selectedOrderDetail.id);
                    setIsDetailsModalOpen(false);
                  }}
                >
                  Cancel & Restock Items
                </button>
              )}
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setSelectedOrderDetail(null);
                  setIsDetailsModalOpen(false);
                }}
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
