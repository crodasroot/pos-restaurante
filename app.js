// app.js - Gestión de múltiples órdenes
// Requiere db.js cargado antes

// State
let orders = {};  // { orderId: { id, number, items: [...], createdAt, status: 'active'|'waiting' } }
let currentOrderId = null;
let nextOrderNumber = 1;
let currentPanel = 'cart';
let isMobile = window.innerWidth < 768;
let currentSalesFilter = 'day';  // 'day', 'week', 'month', 'year'

async function init() {
  setupResponsiveness();
  bindUI();
  setupNavigation();
  initializeDateFilters();
  await renderItems();
  await renderSales();

  // Crear primera orden
  createNewOrder();

  // Mostrar carrito por defecto en móvil
  showPanel('cart');
}

function initializeDateFilters() {
  // Establecer fecha de hoy en ambos campos
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dateFrom').value = today;
  document.getElementById('dateTo').value = today;
}

function setupResponsiveness() {
  window.addEventListener('resize', () => {
    const wasDesktop = !isMobile;
    isMobile = window.innerWidth < 768;
    
    if (wasDesktop && isMobile) {
      // Cambiar de desktop a móvil
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      showPanel('cart');
    } else if (!wasDesktop && !isMobile) {
      // Cambiar de móvil a desktop
      document.querySelectorAll('.panel').forEach(p => p.classList.add('active'));
      document.getElementById('historyPanel').classList.remove('active');
    }
  });
}

function setupNavigation() {
  const navBtns = {
    'nav-menu': 'menu',
    'nav-cart': 'cart',
    'nav-history': 'history'
  };

  Object.entries(navBtns).forEach(([btnId, panelName]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showPanel(panelName);
      });
    }
  });

  // Botón de menú en topbar (para mostrar/ocultar en móvil)
  const toggleMenuBtn = document.getElementById('toggleMenuBtn');
  if (toggleMenuBtn) {
    toggleMenuBtn.addEventListener('click', () => {
      if (currentPanel === 'menu') {
        showPanel('cart');
      } else {
        showPanel('menu');
      }
    });
  }
}

function showPanel(panelName) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  
  let panelEl;
  switch(panelName) {
    case 'menu':
      panelEl = document.getElementById('menuPanel');
      break;
    case 'cart':
      panelEl = document.getElementById('cartPanel');
      break;
    case 'history':
      panelEl = document.getElementById('historyPanel');
      break;
  }

  if (panelEl) {
    panelEl.classList.add('active');
    currentPanel = panelName;
  }

  // Actualizar botones de navegación
  if (isMobile) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${panelName}`);
    if (activeBtn) activeBtn.classList.add('active');
  }
}

function bindUI() {
  document.getElementById('itemForm').addEventListener('submit', onSaveItem);
  document.getElementById('clearItemBtn').addEventListener('click', clearItemForm);
  document.getElementById('backupBtn').addEventListener('click', onExport);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change', onImportFile);

  // Órdenes
  document.getElementById('newOrderBtn').addEventListener('click', createNewOrder);
  document.getElementById('clearCartBtn').addEventListener('click', onClearCurrentOrder);

  // Cobro
  document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
  document.getElementById('cancelPayBtn').addEventListener('click', closeCheckout);
  document.getElementById('closeModalBtn').addEventListener('click', closeCheckout);
  document.getElementById('confirmPayBtn').addEventListener('click', confirmPayment);
  document.getElementById('paidAmount').addEventListener('input', updateChange);

  // Filtros de historial
  setupSalesFilters();
}

function setupSalesFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remover clase active de todos los botones
      filterBtns.forEach(b => b.classList.remove('active'));
      // Agregar clase active al botón clickeado
      btn.classList.add('active');
      // Actualizar el filtro actual
      currentSalesFilter = btn.dataset.filter;
      // Actualizar los campos de fecha según el filtro
      updateDateInputsByFilter(btn.dataset.filter);
      // Re-renderizar las ventas con el nuevo filtro
      renderSales();
    });
  });

  // Listeners para los inputs de fecha
  dateFrom.addEventListener('change', () => {
    // Desactivar todos los botones al usar fechas personalizadas
    filterBtns.forEach(b => b.classList.remove('active'));
    currentSalesFilter = 'custom';
    renderSales();
  });

  dateTo.addEventListener('change', () => {
    // Desactivar todos los botones al usar fechas personalizadas
    filterBtns.forEach(b => b.classList.remove('active'));
    currentSalesFilter = 'custom';
    renderSales();
  });
}

function updateDateInputsByFilter(filter) {
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  switch(filter) {
    case 'day':
      dateFrom.value = todayStr;
      dateTo.value = todayStr;
      break;

    case 'week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFrom.value = weekAgo.toISOString().split('T')[0];
      dateTo.value = todayStr;
      break;

    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      dateFrom.value = monthStart.toISOString().split('T')[0];
      dateTo.value = todayStr;
      break;

    case 'year':
      const yearStart = new Date(today.getFullYear(), 0, 1);
      dateFrom.value = yearStart.toISOString().split('T')[0];
      dateTo.value = todayStr;
      break;
  }
}

function showMessage(msg) {
  alert(msg);
}

// ============ GESTIÓN DE ÓRDENES ============

function createNewOrder() {
  // Poner orden actual en espera
  if (currentOrderId && orders[currentOrderId]) {
    orders[currentOrderId].status = 'waiting';
  }
  
  const orderId = Date.now().toString();
  const number = nextOrderNumber++;
  
  orders[orderId] = {
    id: orderId,
    number: number,
    items: [],
    createdAt: new Date().toISOString(),
    status: 'active'
  };
  
  switchToOrder(orderId);
  renderOrdersTabs();
  renderCart();
  showMessage(`✓ Nueva orden #${number} creada`);
}

function switchToOrder(orderId) {
  if (!orders[orderId]) return showMessage('Orden no encontrada');
  
  // Poner orden anterior en espera (si no está pagada)
  if (currentOrderId && orders[currentOrderId] && currentOrderId !== orderId) {
    orders[currentOrderId].status = 'waiting';
  }
  
  currentOrderId = orderId;
  orders[orderId].status = 'active';
  
  renderOrdersTabs();
  renderCart();
}

function getCurrentOrder() {
  return orders[currentOrderId] || null;
}

function deleteOrder(orderId) {
  if (Object.keys(orders).length === 1) {
    // Crear nueva orden si se elimina la única
    createNewOrder();
    return;
  }
  
  delete orders[orderId];
  
  if (currentOrderId === orderId) {
    const firstOrderId = Object.keys(orders)[0];
    switchToOrder(firstOrderId);
  }
  
  renderOrdersTabs();
}

function renderOrdersTabs() {
  const container = document.getElementById('ordersTabs');
  container.innerHTML = '';
  
  const orderIds = Object.keys(orders);
  
  if (orderIds.length === 0) {
    return;
  }
  
  orderIds.forEach((orderId) => {
    const order = orders[orderId];
    const tab = document.createElement('button');
    const isActive = orderId === currentOrderId;
    const statusIcon = order.status === 'active' ? '⚡' : '⏸️';
    
    tab.className = `order-tab ${isActive ? 'active' : ''}`;
    tab.innerHTML = `
      <div class="order-tab-header">
        <span class="order-tab-status">${statusIcon}</span>
        <div class="order-tab-number">#${order.number}</div>
      </div>
      <div class="order-tab-items">${order.items.length} items</div>
    `;
    
    tab.addEventListener('click', () => switchToOrder(orderId));
    
    // Right click o long press para eliminar
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm(`¿Eliminar orden #${order.number}?`)) {
        deleteOrder(orderId);
      }
    });
    
    let pressTimer;
    tab.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => {
        if (confirm(`¿Eliminar orden #${order.number}?`)) {
          deleteOrder(orderId);
        }
      }, 1000);
    });
    
    tab.addEventListener('touchend', () => clearTimeout(pressTimer));
    
    container.appendChild(tab);
  });
}

function onClearCurrentOrder() {
  const order = getCurrentOrder();
  if (!order || !order.items.length) return showMessage('🛒 Orden vacía');
  if (!confirm(`¿Vaciar orden #${order.number}?`)) return;
  
  order.items = [];
  renderCart();
  renderOrdersTabs();
}

// ============ ITEMS DEL MENÚ ============

async function onSaveItem(e) {
  e.preventDefault();
  const id = document.getElementById('itemId').value;
  const name = document.getElementById('itemName').value.trim();
  const price = parseFloat(document.getElementById('itemPrice').value) || 0;
  const type = document.getElementById('itemType').value;

  if (!name) return showMessage('Por favor ingresa el nombre del platillo');
  if (price <= 0) return showMessage('El precio debe ser mayor a 0');

  const item = { name, price, type };
  if (id) {
    item.id = Number(id);
    await putItem(item);
    showMessage('Platillo actualizado ✓');
  } else {
    await addItem(item);
    showMessage('Platillo agregado ✓');
  }
  clearItemForm();
  await renderItems();
}

function clearItemForm() {
  document.getElementById('itemId').value = '';
  document.getElementById('itemName').value = '';
  document.getElementById('itemPrice').value = '';
  document.getElementById('itemType').value = 'platillo';
}

async function renderItems() {
  const items = await getAllItems();
  const container = document.getElementById('itemsList');
  container.innerHTML = '';
  
  if (!items.length) {
    container.innerHTML = '<div style="padding:16px;text-align:center;color:white;opacity:0.6">📭 No hay platillos aún.<br><br>Agrega uno arriba para comenzar.</div>';
    return;
  }

  items.forEach(it => {
    const div = document.createElement('div');
    div.className = 'item';
    
    const typeEmoji = {
      'platillo': '🍽️',
      'bebida': '🥤',
      'otros': '📌'
    }[it.type] || '📌';

    div.innerHTML = `
      <div class="meta">
        <strong>${escapeHtml(it.name)}</strong>
        <small>${typeEmoji} ${it.type}</small>
        <small>💵 $${Number(it.price).toFixed(2)}</small>
      </div>
      <div class="item-buttons">
        <button data-id="${it.id}" class="addBtn btn-small" style="background:#10b981;margin:0">➕</button>
        <button data-id="${it.id}" class="editBtn btn-small" style="background:#3b82f6;margin:0">✏️</button>
        <button data-id="${it.id}" class="delBtn btn-small" style="background:#ef4444;margin:0">🗑️</button>
      </div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll('.addBtn').forEach(b => {
    b.addEventListener('click', (ev) => {
      const id = ev.target.dataset.id;
      addToCart(Number(id));
    });
  });

  container.querySelectorAll('.editBtn').forEach(b => {
    b.addEventListener('click', async (ev) => {
      const id = Number(ev.target.dataset.id);
      const items = await getAllItems();
      const it = items.find(x => x.id === id);
      if (!it) return;
      document.getElementById('itemId').value = it.id;
      document.getElementById('itemName').value = it.name;
      document.getElementById('itemPrice').value = it.price;
      document.getElementById('itemType').value = it.type;
      // Scroll al formulario
      document.getElementById('menuPanel').scrollTop = 0;
    });
  });

  container.querySelectorAll('.delBtn').forEach(b => {
    b.addEventListener('click', async (ev) => {
      const id = Number(ev.target.dataset.id);
      if (!confirm('¿Seguro que quieres borrar este platillo?')) return;
      await deleteItem(id);
      await renderItems();
    });
  });
}

async function addToCart(itemId) {
  const items = await getAllItems();
  const it = items.find(i => i.id === itemId);
  if (!it) return showMessage('Item no encontrado');
  
  const order = getCurrentOrder();
  if (!order) return showMessage('No hay orden activa');
  
  const existing = order.items.find(c => c.id === it.id);
  if (existing) {
    existing.qty++;
  } else {
    order.items.push({ id: it.id, name: it.name, price: it.price, qty: 1 });
  }
  
  renderCart();
  renderOrdersTabs();
  
  // Notificación visual
  const btn = document.querySelector(`[data-id="${itemId}"].addBtn`);
  if (btn) {
    const originalText = btn.textContent;
    btn.textContent = '✓ Agregado';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 800);
  }
}

function renderCart() {
  const order = getCurrentOrder();
  const list = document.getElementById('cartList');
  list.innerHTML = '';
  
  if (!order || !order.items.length) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:#d1d5db;font-size:14px">🛒 Orden vacía<br><br>Agrega platillos desde el menú</div>';
    updateCartTotal();
    return;
  }

  order.items.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'cart-row';
    
    const total = (c.price * c.qty).toFixed(2);
    
    row.innerHTML = `
      <div class="cart-row-left">
        <div class="cart-row-name">${escapeHtml(c.name)}</div>
        <div class="cart-row-price">$${Number(c.price).toFixed(2)} c/u</div>
      </div>
      <div class="qty-control">
        <button data-idx="${idx}" class="dec-btn" style="padding:0;width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center">−</button>
        <input type="number" readonly value="${c.qty}" class="qty-input" style="width:30px;text-align:center;padding:0;border:none;background:transparent;color:white" />
        <button data-idx="${idx}" class="inc-btn" style="padding:0;width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center">+</button>
      </div>
      <div class="cart-row-total">Q ${total}</div>
      <button data-idx="${idx}" class="cart-row-del">🗑️</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.inc-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const i = Number(e.target.dataset.idx);
      order.items[i].qty++;
      renderCart();
      renderOrdersTabs();
    });
  });

  list.querySelectorAll('.dec-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const i = Number(e.target.dataset.idx);
      if (order.items[i].qty > 1) {
        order.items[i].qty--;
      } else {
        order.items.splice(i, 1);
      }
      renderCart();
      renderOrdersTabs();
    });
  });

  list.querySelectorAll('.cart-row-del').forEach(b => {
    b.addEventListener('click', (e) => {
      const i = Number(e.target.dataset.idx);
      order.items.splice(i, 1);
      renderCart();
      renderOrdersTabs();
    });
  });

  updateCartTotal();
}

function updateCartTotal() {
  const order = getCurrentOrder();
  const total = order ? order.items.reduce((s, c) => s + c.price * c.qty, 0) : 0;
  const count = order ? order.items.reduce((s, c) => s + c.qty, 0) : 0;
  document.getElementById('cartTotal').textContent = `$${total.toFixed(2)}`;
  document.getElementById('cartCount').textContent = count;
}

// ============ COBRO ============

function openCheckout() {
  const order = getCurrentOrder();
  if (!order || !order.items.length) {
    return showMessage('🛒 Orden vacía. Agrega platillos primero.');
  }
  
  const total = order.items.reduce((s, c) => s + c.price * c.qty, 0);
  
  // Mostrar orden
  document.getElementById('checkoutOrderId').textContent = order.number;
  
  // Mostrar items
  const itemsList = document.getElementById('checkoutItemsList');
  itemsList.innerHTML = '';
  order.items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'checkout-item';
    const itemTotal = (item.price * item.qty).toFixed(2);
    div.innerHTML = `
      <div class="checkout-item-name">${escapeHtml(item.name)}</div>
      <div class="checkout-item-qty">${item.qty}</div>
      <div class="checkout-item-price">$${itemTotal}</div>
    `;
    itemsList.appendChild(div);
  });
  
  document.getElementById('checkoutSubtotal').textContent = `$${total.toFixed(2)}`;
  document.getElementById('checkoutTotal').textContent = `$${total.toFixed(2)}`;
  document.getElementById('paidAmount').value = total.toFixed(2);
  document.getElementById('paidAmount').focus();
  updateChange();
  document.getElementById('checkoutModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.add('hidden');
  document.body.style.overflow = '';
}

function updateChange() {
  const paid = parseFloat(document.getElementById('paidAmount').value) || 0;
  const total = parseFloat(document.getElementById('checkoutTotal').textContent.replace('$', '')) || 0;
  const change = paid - total;
  const changeEl = document.getElementById('changeDue');
  changeEl.textContent = `$${(change >= 0 ? change : 0).toFixed(2)}`;
  
  // Cambiar color según si hay vuelto
  if (change < 0) {
    changeEl.style.color = '#ef4444';
  } else if (change === 0) {
    changeEl.style.color = '#f59e0b';
  } else {
    changeEl.style.color = '#10b981';
  }
}

async function confirmPayment() {
  const order = getCurrentOrder();
  const paid = parseFloat(document.getElementById('paidAmount').value) || 0;
  const total = parseFloat(document.getElementById('checkoutTotal').textContent.replace('Q', '')) || 0;
  
  if (paid < total) return showMessage(`❌ Cantidad insuficiente. Falta: Q ${(total - paid).toFixed(2)}`);
  
  const sale = {
    orderNumber: order.number,
    createdAt: new Date().toISOString(),
    items: order.items.slice(),
    total,
    paid,
    change: paid - total
  };
  
  await addSale(sale);
  
  // Cerrar orden actual y crear nueva
  deleteOrder(currentOrderId);
  createNewOrder();
  renderOrdersTabs();
  renderCart();
  await renderSales();
  closeCheckout();
  showMessage(`✓ Pago de Orden #${sale.orderNumber} registrado`);
}

// ============ HISTORIAL ============

// Función auxiliar para verificar si una fecha está en el periodo del filtro
function isInFilterPeriod(saleDate, filter) {
  const sale = new Date(saleDate);
  const saleStart = new Date(sale.getFullYear(), sale.getMonth(), sale.getDate());

  // Si el filtro es 'custom' o hay fechas personalizadas, usar el rango de fechas
  if (filter === 'custom') {
    const dateFromValue = document.getElementById('dateFrom').value;
    const dateToValue = document.getElementById('dateTo').value;

    if (!dateFromValue || !dateToValue) return true;

    const dateFrom = new Date(dateFromValue + 'T00:00:00');
    const dateTo = new Date(dateToValue + 'T23:59:59');

    return sale >= dateFrom && sale <= dateTo;
  }

  // Para filtros predefinidos
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch(filter) {
    case 'day':
      // Mismo día
      return saleStart.getTime() === todayStart.getTime();

    case 'week':
      // Últimos 7 días
      const weekAgo = new Date(todayStart);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return saleStart >= weekAgo;

    case 'month':
      // Mismo mes y año
      return sale.getMonth() === now.getMonth() && sale.getFullYear() === now.getFullYear();

    case 'year':
      // Mismo año
      return sale.getFullYear() === now.getFullYear();

    default:
      return true;
  }
}

async function renderSales() {
  const allSales = await getAllSales();
  const el = document.getElementById('salesList');
  el.innerHTML = '';

  if (!allSales.length) {
    el.innerHTML = '<div style="padding:24px;text-align:center;color:#d1d5db;font-size:14px">📭 Sin historial de ventas aún</div>';
    return;
  }

  // Filtrar ventas según el periodo seleccionado
  const sales = allSales.filter(s => isInFilterPeriod(s.createdAt, currentSalesFilter));

  if (!sales.length) {
    const filterNames = {
      'day': 'hoy',
      'week': 'esta semana',
      'month': 'este mes',
      'year': 'este año',
      'custom': 'en el rango seleccionado'
    };
    el.innerHTML = `<div style="padding:24px;text-align:center;color:#d1d5db;font-size:14px">📭 Sin ventas ${filterNames[currentSalesFilter]}</div>`;
    return;
  }

  sales.slice().reverse().forEach(s => {
    const date = new Date(s.createdAt);
    const dateStr = date.toLocaleDateString('es-ES');
    const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const itemsStr = s.items
      .map(item => `${item.qty}x ${escapeHtml(item.name)}`)
      .join(', ');

    const d = document.createElement('div');
    d.className = 'sale';
    d.innerHTML = `
      <div class="sale-header">
        <span>Orden #${s.orderNumber} • 📅 ${dateStr}</span>
        <span>🕐 ${timeStr}</span>
      </div>
      <div class="sale-items">${itemsStr}</div>
      <div class="sale-total">Total: Q ${Number(s.total).toFixed(2)}</div>
    `;
    el.appendChild(d);
  });
}

// Export / Import
async function onExport() {
  const data = await exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pos_export_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showMessage('✓ Datos exportados');
}

function onImportFile(ev) {
  const f = ev.target.files[0];
  if (!f) return;
  
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const json = JSON.parse(reader.result);
      await importData(json);
      await renderItems();
      await renderSales();
      showMessage('✓ Importación completada correctamente');
    } catch (err) {
      console.error(err);
      showMessage('❌ Error al importar JSON');
    }
  };
  reader.readAsText(f);
}

// helper
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// Initialize
document.addEventListener('DOMContentLoaded', init);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
