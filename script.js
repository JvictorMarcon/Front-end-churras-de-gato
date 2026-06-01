// API Configuration
const API_URL = 'https://backend-churras-d-gato.vercel.app';

// Global variables
let currentView = 'dashboard';
let products = [];
let retiradas = [];
let charts = {};
let searchTimeout = null;
let currentSearchTerm = '';

// Categorias que usam KG
const KG_CATEGORIES = ['Carnes', 'Carnes Congeladas', 'Aves', 'Peixes', 'Frios'];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    showDashboard();
    loadProducts();
    loadRetiradas();
    setupMobileMenu();
    setupResponsiveCharts();
    
    // Adicionar listener para redimensionamento
    window.addEventListener('resize', () => {
        setupResponsiveCharts();
        if (currentView === 'dashboard') {
            updateDashboard();
        }
    });
});

// Setup Mobile Menu
function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeMenuBtn = document.getElementById('closeMobileMenu');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
            document.body.classList.add('mobile-menu-open');
        });
    }
    
    const closeMenu = () => {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
        document.body.classList.remove('mobile-menu-open');
    };
    
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);
}

// Fechar menu mobile ao clicar em link
function closeMobileMenuOnClick() {
    if (window.innerWidth < 1024) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobileOverlay');
        if (sidebar) sidebar.classList.add('-translate-x-full');
        if (overlay) overlay.classList.add('hidden');
        document.body.classList.remove('mobile-menu-open');
    }
}

// Setup Responsive Charts
function setupResponsiveCharts() {
    const chartsContainer = document.getElementById('contentArea');
    if (chartsContainer) {
        const chartContainers = document.querySelectorAll('.chart-container');
        chartContainers.forEach(container => {
            if (window.innerWidth < 768) {
                container.classList.add('w-full', 'overflow-x-auto');
            } else {
                container.classList.remove('w-full', 'overflow-x-auto');
            }
        });
    }
}

// Load Retiradas from localStorage
function loadRetiradas() {
    const stored = localStorage.getItem('retiradas');
    if (stored) {
        retiradas = JSON.parse(stored);
    } else {
        retiradas = [];
    }
}

// Save Retirada
function saveRetirada(retirada) {
    retiradas.unshift(retirada); // Adiciona no início
    // Manter apenas últimos 100 registros
    if (retiradas.length > 100) {
        retiradas = retiradas.slice(0, 100);
    }
    localStorage.setItem('retiradas', JSON.stringify(retiradas));
}

// Show Toast Notification
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const colors = {
        success: 'bg-green-500',
        error: 'bg-[#A62424]',
        info: 'bg-[#D36B1A]',
        warning: 'bg-yellow-500'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    toast.className = `toast ${colors[type]} text-white px-4 sm:px-6 py-3 sm:py-4 rounded-lg shadow-lg flex items-center space-x-3 min-w-[280px] sm:min-w-[300px] text-sm sm:text-base`;
    toast.innerHTML = `
        <i class="fas ${icons[type]} text-lg sm:text-xl"></i>
        <span class="flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="hover:opacity-80">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Get unit type based on category
function getUnitType(categoria) {
    return KG_CATEGORIES.includes(categoria) ? 'kg' : 'un';
}

// Format quantity with unit
function formatQuantity(quantidade, categoria) {
    const unit = getUnitType(categoria);
    if (unit === 'kg') {
        return `${quantidade.toFixed(2)} kg`;
    }
    return `${quantidade} unidade${quantidade !== 1 ? 's' : ''}`;
}

// Validate quantity based on category
function validateQuantity(quantidade, categoria) {
    const unitType = getUnitType(categoria);
    
    if (unitType === 'kg') {
        if (quantidade <= 0) return 'A quantidade em KG deve ser maior que zero';
        if (quantidade > 1000) return 'Quantidade muito alta! Máximo 1000 KG';
        return null;
    } else {
        if (!Number.isInteger(quantidade)) return 'Quantidade de unidades deve ser um número inteiro';
        if (quantidade <= 0) return 'A quantidade de unidades deve ser maior que zero';
        if (quantidade > 99999) return 'Quantidade muito alta! Máximo 99.999 unidades';
        return null;
    }
}

// Load Products from API
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/estoque`);
        if (!response.ok) throw new Error('Erro ao carregar produtos');
        products = await response.json();
        
        if (currentView === 'dashboard') {
            updateDashboard();
        } else if (currentView === 'estoque') {
            renderEstoque();
        } else if (currentView === 'retiradas') {
            renderRetiradas();
        }
    } catch (error) {
        showToast('Erro ao carregar produtos: ' + error.message, 'error');
    }
}

// Check if product is expired
function isExpired(validade) {
    const today = new Date();
    const expirationDate = new Date(validade);
    today.setHours(0, 0, 0, 0);
    return expirationDate < today;
}

// Get product stats
function getProductStats() {
    const total = products.length;
    const active = products.filter(p => !isExpired(p.validade)).length;
    const expired = products.filter(p => isExpired(p.validade)).length;
    return { total, active, expired };
}

// Search products
function searchProducts(term) {
    if (!term || term.trim() === '') {
        return products;
    }
    
    const searchTerm = term.toLowerCase().trim();
    return products.filter(product => 
        product.produto.toLowerCase().includes(searchTerm) ||
        product.marca.toLowerCase().includes(searchTerm) ||
        product.categoria.toLowerCase().includes(searchTerm)
    );
}

// Highlight search term in text
function highlightText(text, searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

// Show Dashboard
async function showDashboard() {
    currentView = 'dashboard';
    document.getElementById('pageTitle').innerHTML = '<i class="fas fa-chart-line mr-2"></i>Dashboard';
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('bg-[#7F3E11]', 'text-[#FFFFFF]');
        item.classList.add('text-[#C2C2C2]');
    });
    document.querySelectorAll('.nav-item')[0].classList.add('bg-[#7F3E11]', 'text-[#FFFFFF]');
    
    await loadProducts();
    closeMobileMenuOnClick();
}

// Update Dashboard
function updateDashboard() {
    const stats = getProductStats();
    
    // Calcular total de retiradas
    const totalRetiradas = retiradas.length;
    const ultimasRetiradas = retiradas.slice(0, 5);
    
    const content = `
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div class="bg-[#161616] rounded-lg p-4 sm:p-6 border border-[#7F3E11]">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[#C2C2C2] text-xs sm:text-sm">Total de Produtos</p>
                        <p class="text-2xl sm:text-3xl font-bold text-[#FFFFFF] mt-2">${stats.total}</p>
                    </div>
                    <i class="fas fa-boxes text-3xl sm:text-4xl text-[#D36B1A]"></i>
                </div>
            </div>
            
            <div class="bg-[#161616] rounded-lg p-4 sm:p-6 border border-[#7F3E11]">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[#C2C2C2] text-xs sm:text-sm">Produtos Ativos</p>
                        <p class="text-2xl sm:text-3xl font-bold text-green-500 mt-2">${stats.active}</p>
                    </div>
                    <i class="fas fa-check-circle text-3xl sm:text-4xl text-green-500"></i>
                </div>
            </div>
            
            <div class="bg-[#161616] rounded-lg p-4 sm:p-6 border border-[#7F3E11]">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[#C2C2C2] text-xs sm:text-sm">Produtos Vencidos</p>
                        <p class="text-2xl sm:text-3xl font-bold text-[#A62424] mt-2">${stats.expired}</p>
                    </div>
                    <i class="fas fa-exclamation-triangle text-3xl sm:text-4xl text-[#A62424]"></i>
                </div>
            </div>
            
            <div class="bg-[#161616] rounded-lg p-4 sm:p-6 border border-[#7F3E11]">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[#C2C2C2] text-xs sm:text-sm">Total de Retiradas</p>
                        <p class="text-2xl sm:text-3xl font-bold text-[#D36B1A] mt-2">${totalRetiradas}</p>
                    </div>
                    <i class="fas fa-clipboard-list text-3xl sm:text-4xl text-[#D36B1A]"></i>
                </div>
            </div>
        </div>
        
        <!-- Charts -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div class="bg-[#161616] rounded-lg p-4 sm:p-6 border border-[#7F3E11]">
                <h3 class="text-base sm:text-lg font-semibold text-[#FFFFFF] mb-4">
                    <i class="fas fa-chart-bar mr-2 text-[#D36B1A]"></i>
                    Produtos com Maior Quantidade
                </h3>
                <div class="chart-container">
                    <canvas id="quantityChart"></canvas>
                </div>
            </div>
            
            <div class="bg-[#161616] rounded-lg p-4 sm:p-6 border border-[#7F3E11]">
                <h3 class="text-base sm:text-lg font-semibold text-[#FFFFFF] mb-4">
                    <i class="fas fa-chart-pie mr-2 text-[#D36B1A]"></i>
                    Status dos Produtos
                </h3>
                <div class="chart-container">
                    <canvas id="statusChart"></canvas>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div class="bg-[#161616] rounded-lg p-4 sm:p-6 border border-[#7F3E11]">
                <h3 class="text-base sm:text-lg font-semibold text-[#FFFFFF] mb-4">
                    <i class="fas fa-chart-line mr-2 text-[#D36B1A]"></i>
                    Produtos por Categoria
                </h3>
                <div class="chart-container">
                    <canvas id="categoryChart"></canvas>
                </div>
            </div>
            
            <div class="bg-[#161616] rounded-lg p-4 sm:p-6 border border-[#7F3E11]">
                <h3 class="text-base sm:text-lg font-semibold text-[#FFFFFF] mb-4">
                    <i class="fas fa-history mr-2 text-[#D36B1A]"></i>
                    Últimas Retiradas
                </h3>
                <div class="space-y-3 max-h-80 overflow-y-auto">
                    ${ultimasRetiradas.length === 0 ? `
                        <p class="text-[#C2C2C2] text-center py-8">Nenhuma retirada registrada ainda</p>
                    ` : ultimasRetiradas.map(ret => `
                        <div class="bg-[#0A0A0A] rounded-lg p-3 border border-[#7F3E11]">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="text-[#FFFFFF] font-semibold">${ret.produto}</p>
                                    <p class="text-[#C2C2C2] text-sm">Responsável: ${ret.responsavel}</p>
                                    <p class="text-[#C2C2C2] text-xs">${new Date(ret.data).toLocaleString('pt-BR')}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-[#D36B1A] font-bold">-${ret.quantidade} ${ret.unidade}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('contentArea').innerHTML = content;
    
    // Create charts after content is loaded
    setTimeout(() => {
        createQuantityChart();
        createStatusChart();
        createCategoryChart();
    }, 100);
}

// Create Quantity Chart
function createQuantityChart() {
    const ctx = document.getElementById('quantityChart').getContext('2d');
    const topProducts = [...products]
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);
    
    if (charts.quantity) charts.quantity.destroy();
    
    charts.quantity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topProducts.map(p => p.produto.length > 15 ? p.produto.substring(0, 12) + '...' : p.produto),
            datasets: [{
                label: 'Quantidade em Estoque',
                data: topProducts.map(p => p.quantidade),
                backgroundColor: '#D36B1A',
                borderColor: '#7F3E11',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#C2C2C2', font: { size: window.innerWidth < 768 ? 10 : 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const product = topProducts[context.dataIndex];
                            const unit = getUnitType(product.categoria);
                            return `${context.dataset.label}: ${context.raw} ${unit === 'kg' ? 'kg' : 'unidades'}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: { color: '#C2C2C2', font: { size: window.innerWidth < 768 ? 10 : 12 } },
                    grid: { color: '#7F3E11' }
                },
                x: {
                    ticks: { color: '#C2C2C2', font: { size: window.innerWidth < 768 ? 10 : 12 } },
                    grid: { color: '#7F3E11' }
                }
            }
        }
    });
}

// Create Status Chart
function createStatusChart() {
    const ctx = document.getElementById('statusChart').getContext('2d');
    const stats = getProductStats();
    
    if (charts.status) charts.status.destroy();
    
    charts.status = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Ativos', 'Vencidos'],
            datasets: [{
                data: [stats.active, stats.expired],
                backgroundColor: ['#10B981', '#A62424'],
                borderColor: '#161616',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#C2C2C2', font: { size: window.innerWidth < 768 ? 10 : 12 } }
                }
            }
        }
    });
}

// Create Category Chart
function createCategoryChart() {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const categories = {};
    
    products.forEach(product => {
        if (!categories[product.categoria]) {
            categories[product.categoria] = 0;
        }
        categories[product.categoria] += product.quantidade;
    });
    
    if (charts.category) charts.category.destroy();
    
    charts.category = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                label: 'Quantidade por Categoria',
                data: Object.values(categories),
                backgroundColor: 'rgba(211, 107, 26, 0.2)',
                borderColor: '#D36B1A',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#C2C2C2', font: { size: window.innerWidth < 768 ? 10 : 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Quantidade Total: ${context.raw.toFixed(2)} ${context.raw > 1 ? 'unidades/kg' : 'unidade/kg'}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: { color: '#C2C2C2', font: { size: window.innerWidth < 768 ? 10 : 12 } },
                    grid: { color: '#7F3E11' }
                },
                x: {
                    ticks: { color: '#C2C2C2', font: { size: window.innerWidth < 768 ? 10 : 12 }, rotation: window.innerWidth < 768 ? 45 : 0 },
                    grid: { color: '#7F3E11' }
                }
            }
        }
    });
}

// Show Estoque Page
async function showEstoque() {
    currentView = 'estoque';
    document.getElementById('pageTitle').innerHTML = '<i class="fas fa-boxes mr-2"></i>Gerenciar Estoque';
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('bg-[#7F3E11]', 'text-[#FFFFFF]');
        item.classList.add('text-[#C2C2C2]');
    });
    document.querySelectorAll('.nav-item')[1].classList.add('bg-[#7F3E11]', 'text-[#FFFFFF]');
    
    await loadProducts();
    closeMobileMenuOnClick();
}

// Show Retiradas Page
async function showRetiradas() {
    currentView = 'retiradas';
    document.getElementById('pageTitle').innerHTML = '<i class="fas fa-clipboard-list mr-2"></i>Registro de Retiradas';
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('bg-[#7F3E11]', 'text-[#FFFFFF]');
        item.classList.add('text-[#C2C2C2]');
    });
    document.querySelectorAll('.nav-item')[2].classList.add('bg-[#7F3E11]', 'text-[#FFFFFF]');
    
    await loadProducts();
    renderRetiradas();
    closeMobileMenuOnClick();
}

// Render Retiradas Page
function renderRetiradas() {
    const content = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <!-- Formulário de Retirada -->
            <div class="bg-[#161616] rounded-lg p-4 sm:p-6 border border-[#7F3E11]">
                <h3 class="text-base sm:text-lg font-semibold text-[#FFFFFF] mb-4">
                    <i class="fas fa-sign-out-alt mr-2 text-[#D36B1A]"></i>
                    Registrar Nova Retirada
                </h3>
                
                <form onsubmit="registrarRetirada(event)">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-[#C2C2C2] mb-2">Produto *</label>
                            <select id="produtoRetirada" required class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A]">
                                <option value="">Selecione um produto...</option>
                                ${products.filter(p => !isExpired(p.validade)).map(product => `
                                    <option value="${product.id}" data-quantidade="${product.quantidade}" data-categoria="${product.categoria}" data-nome="${product.produto}">
                                        ${product.produto} - ${product.marca} (${formatQuantity(product.quantidade, product.categoria)} disponível)
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2">Quantidade a Retirar *</label>
                            <input type="number" id="quantidadeRetirada" required step="any" class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A]">
                            <p id="quantidadeDisponivel" class="text-xs text-[#C2C2C2] mt-1"></p>
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2">Responsável pela Retirada *</label>
                            <input type="text" id="responsavel" required class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A]" placeholder="Nome do responsável">
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2">Observação (Opcional)</label>
                            <textarea id="observacao" rows="3" class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A]" placeholder="Motivo da retirada, destino, etc..."></textarea>
                        </div>
                    </div>
                    
                    <div class="mt-6">
                        <button type="submit" class="w-full bg-[#D36B1A] hover:bg-[#7F3E11] text-white font-semibold py-3 px-4 rounded-lg transition-all">
                            <i class="fas fa-check-circle mr-2"></i>
                            Registrar Retirada
                        </button>
                    </div>
                </form>
            </div>
            
            <!-- Histórico de Retiradas -->
            <div class="bg-[#161616] rounded-lg p-4 sm:p-6 border border-[#7F3E11]">
                <h3 class="text-base sm:text-lg font-semibold text-[#FFFFFF] mb-4">
                    <i class="fas fa-history mr-2 text-[#D36B1A]"></i>
                    Histórico de Retiradas
                </h3>
                
                <div class="space-y-3 max-h-[500px] overflow-y-auto">
                    ${retiradas.length === 0 ? `
                        <p class="text-[#C2C2C2] text-center py-8">Nenhuma retirada registrada ainda</p>
                    ` : retiradas.map(ret => `
                        <div class="bg-[#0A0A0A] rounded-lg p-3 sm:p-4 border border-[#7F3E11] hover:border-[#D36B1A] transition-all">
                            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <p class="text-[#FFFFFF] font-semibold">${ret.produto}</p>
                                        <span class="text-xs ${ret.unidade === 'kg' ? 'bg-[#D36B1A]' : 'bg-[#7F3E11]'} text-white px-2 py-1 rounded-full">
                                            ${ret.unidade === 'kg' ? 'KG' : 'UN'}
                                        </span>
                                    </div>
                                    <p class="text-[#C2C2C2] text-sm mt-1">
                                        <i class="fas fa-user mr-1"></i> Responsável: ${ret.responsavel}
                                    </p>
                                    ${ret.observacao ? `
                                        <p class="text-[#C2C2C2] text-xs mt-1">
                                            <i class="fas fa-comment mr-1"></i> ${ret.observacao}
                                        </p>
                                    ` : ''}
                                    <p class="text-[#C2C2C2] text-xs mt-1">
                                        <i class="fas fa-calendar mr-1"></i> ${new Date(ret.data).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                                <div class="text-left sm:text-right">
                                    <p class="text-[#D36B1A] font-bold text-lg">-${ret.quantidade} ${ret.unidade}</p>
                                    <p class="text-[#C2C2C2] text-xs">Saldo anterior: ${ret.saldoAnterior} ${ret.unidade}</p>
                                    <p class="text-green-500 text-xs">Novo saldo: ${ret.novoSaldo} ${ret.unidade}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('contentArea').innerHTML = content;
    
    // Adicionar listener para o select do produto
    const produtoSelect = document.getElementById('produtoRetirada');
    if (produtoSelect) {
        produtoSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const quantidade = selectedOption.getAttribute('data-quantidade');
            const categoria = selectedOption.getAttribute('data-categoria');
            const unitType = getUnitType(categoria);
            
            const disponivelSpan = document.getElementById('quantidadeDisponivel');
            if (disponivelSpan) {
                if (unitType === 'kg') {
                    disponivelSpan.innerHTML = `Disponível: ${parseFloat(quantidade).toFixed(2)} kg`;
                } else {
                    disponivelSpan.innerHTML = `Disponível: ${quantidade} unidades`;
                }
            }
            
            const quantidadeInput = document.getElementById('quantidadeRetirada');
            if (quantidadeInput) {
                quantidadeInput.step = unitType === 'kg' ? '0.01' : '1';
                quantidadeInput.min = unitType === 'kg' ? '0.01' : '1';
            }
        });
    }
}

// Registrar Retirada
async function registrarRetirada(event) {
    event.preventDefault();
    
    const produtoId = parseInt(document.getElementById('produtoRetirada').value);
    const quantidade = parseFloat(document.getElementById('quantidadeRetirada').value);
    const responsavel = document.getElementById('responsavel').value;
    const observacao = document.getElementById('observacao').value;
    
    // Encontrar o produto
    const product = products.find(p => p.id === produtoId);
    if (!product) {
        showToast('Produto não encontrado!', 'error');
        return;
    }
    
    // Validar quantidade
    if (quantidade <= 0) {
        showToast('Quantidade inválida!', 'error');
        return;
    }
    
    if (quantidade > product.quantidade) {
        const unitType = getUnitType(product.categoria);
        showToast(`Quantidade insuficiente! Disponível: ${product.quantidade} ${unitType === 'kg' ? 'kg' : 'unidades'}`, 'error');
        return;
    }
    
    // Calcular novo saldo
    const novoSaldo = product.quantidade - quantidade;
    const unitType = getUnitType(product.categoria);
    
    try {
        // Atualizar o produto no backend
        const response = await fetch(`${API_URL}/estoque/${produtoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantidade: novoSaldo })
        });
        
        if (!response.ok) throw new Error('Erro ao registrar retirada');
        
        // Registrar a retirada
        const retirada = {
            id: Date.now(),
            produtoId: produtoId,
            produto: product.produto,
            marca: product.marca,
            quantidade: quantidade,
            unidade: unitType === 'kg' ? 'kg' : 'un',
            saldoAnterior: product.quantidade,
            novoSaldo: novoSaldo,
            responsavel: responsavel,
            observacao: observacao,
            data: new Date().toISOString()
        };
        
        saveRetirada(retirada);
        
        showToast(`Retirada registrada com sucesso! ${quantidade} ${unitType === 'kg' ? 'kg' : 'unidades'} retirados por ${responsavel}`, 'success');
        
        // Limpar formulário
        document.getElementById('produtoRetirada').value = '';
        document.getElementById('quantidadeRetirada').value = '';
        document.getElementById('responsavel').value = '';
        document.getElementById('observacao').value = '';
        document.getElementById('quantidadeDisponivel').innerHTML = '';
        
        // Recarregar dados
        await loadProducts();
        
        // Se estiver na página de retiradas, atualizar a lista
        if (currentView === 'retiradas') {
            renderRetiradas();
        }
        
    } catch (error) {
        showToast('Erro ao registrar retirada: ' + error.message, 'error');
    }
}

// Handle search input
function handleSearchInput() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentSearchTerm = searchInput.value;
        renderEstoque();
    }, 300);
}

// Clear search
function clearSearch() {
    currentSearchTerm = '';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    renderEstoque();
}

// Render Estoque Page
function renderEstoque() {
    const stats = getProductStats();
    const filteredProducts = searchProducts(currentSearchTerm);
    const searchResultCount = filteredProducts.length;
    const isMobile = window.innerWidth < 768;
    
    const content = `
        <!-- Stats Bar -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
            <div class="bg-[#161616] rounded-lg p-4 border border-[#7F3E11]">
                <p class="text-[#C2C2C2] text-xs sm:text-sm">Total</p>
                <p class="text-xl sm:text-2xl font-bold text-[#FFFFFF]">${stats.total}</p>
            </div>
            <div class="bg-[#161616] rounded-lg p-4 border border-[#7F3E11]">
                <p class="text-[#C2C2C2] text-xs sm:text-sm">Ativos</p>
                <p class="text-xl sm:text-2xl font-bold text-green-500">${stats.active}</p>
            </div>
            <div class="bg-[#161616] rounded-lg p-4 border border-[#7F3E11]">
                <p class="text-[#C2C2C2] text-xs sm:text-sm">Vencidos</p>
                <p class="text-xl sm:text-2xl font-bold text-[#A62424]">${stats.expired}</p>
            </div>
            <div>
                <button onclick="showCadastroModal()" class="w-full bg-[#D36B1A] hover:bg-[#7F3E11] text-white font-semibold py-2 sm:py-3 px-4 rounded-lg transition-all text-sm sm:text-base">
                    <i class="fas fa-plus mr-2"></i>
                    Novo Produto
                </button>
            </div>
        </div>
        
        <!-- Search Bar -->
        <div class="bg-[#161616] rounded-lg p-4 border border-[#7F3E11] mb-6 sm:mb-8">
            <div class="flex flex-col sm:flex-row gap-3">
                <div class="flex-1 relative">
                    <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-[#C2C2C2]"></i>
                    <input 
                        type="text" 
                        id="searchInput" 
                        placeholder="Pesquisar por produto, marca ou categoria..." 
                        class="w-full pl-10 pr-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base"
                        oninput="handleSearchInput()"
                        value="${currentSearchTerm}"
                    >
                    ${currentSearchTerm ? `
                        <button onclick="clearSearch()" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#C2C2C2] hover:text-[#FFFFFF]">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="text-[#C2C2C2] py-2 px-4 bg-[#0A0A0A] rounded-lg border border-[#7F3E11] text-center sm:text-left">
                    <i class="fas fa-filter mr-2"></i>
                    ${searchResultCount} resultado${searchResultCount !== 1 ? 's' : ''}
                </div>
            </div>
        </div>
        
        <!-- Products Table -->
        <div class="bg-[#161616] rounded-lg border border-[#7F3E11] overflow-hidden">
            <div class="table-container overflow-x-auto">
                <table class="w-full min-w-[600px]">
                    <thead class="bg-[#0A0A0A] border-b border-[#7F3E11]">
                        <tr>
                            <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#C2C2C2] uppercase tracking-wider">Produto</th>
                            <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#C2C2C2] uppercase tracking-wider ${isMobile ? 'hidden sm:table-cell' : ''}">Marca</th>
                            <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#C2C2C2] uppercase tracking-wider">Categoria</th>
                            <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#C2C2C2] uppercase tracking-wider">Quantidade</th>
                            <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#C2C2C2] uppercase tracking-wider ${isMobile ? 'hidden sm:table-cell' : ''}">Validade</th>
                            <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#C2C2C2] uppercase tracking-wider">Status</th>
                            <th class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[#C2C2C2] uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#7F3E11]">
                        ${filteredProducts.length === 0 ? `
                            <tr>
                                <td colspan="7" class="px-4 sm:px-6 py-12 text-center text-[#C2C2C2]">
                                    <i class="fas fa-search text-3xl sm:text-4xl mb-4 block"></i>
                                    <p class="text-base sm:text-lg">Nenhum produto encontrado</p>
                                    <p class="text-xs sm:text-sm mt-2">Tente outros termos de busca</p>
                                </td>
                            </tr>
                        ` : filteredProducts.map(product => {
                            const unitType = getUnitType(product.categoria);
                            const unitLabel = unitType === 'kg' ? 'kg' : 'un';
                            const formattedQuantity = unitType === 'kg' ? product.quantidade.toFixed(2) : product.quantidade;
                            
                            const highlightedProduto = currentSearchTerm ? highlightText(product.produto, currentSearchTerm) : product.produto;
                            const highlightedMarca = currentSearchTerm ? highlightText(product.marca, currentSearchTerm) : product.marca;
                            const highlightedCategoria = currentSearchTerm ? highlightText(product.categoria, currentSearchTerm) : product.categoria;
                            
                            return `
                            <tr class="hover:bg-[#0A0A0A] transition-all">
                                <td class="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-[#FFFFFF]">
                                    <div class="flex items-center flex-wrap gap-1">
                                        <span class="text-sm sm:text-base">${highlightedProduto}</span>
                                        <span class="${unitType === 'kg' ? 'kilo-badge' : 'unit-badge'} text-xs">
                                            <i class="fas ${unitType === 'kg' ? 'fa-weight-hanging' : 'fa-box'} mr-1"></i>
                                            ${unitType === 'kg' ? 'KG' : 'UN'}
                                        </span>
                                    </div>
                                 </td>
                                <td class="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-[#C2C2C2] text-sm ${isMobile ? 'hidden sm:table-cell' : ''}">${highlightedMarca}</td>
                                <td class="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-[#C2C2C2] text-sm">${highlightedCategoria}</td>
                                <td class="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-[#FFFFFF] font-semibold text-sm sm:text-base">${formattedQuantity} ${unitLabel}</td>
                                <td class="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-[#C2C2C2] text-sm ${isMobile ? 'hidden sm:table-cell' : ''}">${formatDate(product.validade)}</td>
                                <td class="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                    ${isExpired(product.validade) ? 
                                        '<span class="expired-badge px-2 py-1 text-xs font-semibold rounded-full bg-[#A62424] text-white whitespace-nowrap"><i class="fas fa-skull mr-1"></i>Vencido</span>' : 
                                        '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-500 text-white whitespace-nowrap"><i class="fas fa-check mr-1"></i>Ativo</span>'
                                    }
                                 </td>
                                <td class="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                    <button onclick="showEditarModal(${product.id})" class="text-[#D36B1A] hover:text-[#7F3E11] mr-2 sm:mr-3 transition-all">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deletarProduto(${product.id})" class="text-[#A62424] hover:text-red-700 transition-all">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                 </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('contentArea').innerHTML = content;
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Show Cadastro Modal
function showCadastroModal() {
    const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal p-4" onclick="if(event.target === this) closeModal()">
            <div class="bg-[#161616] rounded-lg p-6 sm:p-8 max-w-md w-full mx-auto border border-[#7F3E11] max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl sm:text-2xl font-bold text-[#FFFFFF]">
                        <i class="fas fa-plus-circle text-[#D36B1A] mr-2"></i>
                        Novo Produto
                    </h2>
                    <button onclick="closeModal()" class="text-[#C2C2C2] hover:text-[#FFFFFF]">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <form onsubmit="cadastrarProduto(event)">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-[#C2C2C2] mb-2 text-sm sm:text-base">Produto *</label>
                            <input type="text" id="produto" required class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base">
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2 text-sm sm:text-base">Marca *</label>
                            <input type="text" id="marca" required class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base">
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2 text-sm sm:text-base">Categoria *</label>
                            <select id="categoria" required class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base" onchange="updateQuantidadeLabel()">
                                <option value="">Selecione...</option>
                                <option value="Carnes">Carnes (KG)</option>
                                <option value="Carnes Congeladas">Carnes Congeladas (KG)</option>
                                <option value="Aves">Aves (KG)</option>
                                <option value="Peixes">Peixes (KG)</option>
                                <option value="Frios">Frios (KG)</option>
                                <option value="Bebidas">Bebidas (Unidade)</option>
                                <option value="Acompanhamentos">Acompanhamentos (Unidade)</option>
                                <option value="Temperos">Temperos (Unidade)</option>
                                <option value="Outros">Outros (Unidade)</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2 text-sm sm:text-base" id="quantidadeLabel">Quantidade *</label>
                            <input type="number" id="quantidade" required min="0.01" step="any" class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base">
                            <p id="quantidadeHelp" class="text-xs text-[#C2C2C2] mt-1"></p>
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2 text-sm sm:text-base">Data de Validade *</label>
                            <input type="date" id="validade" required class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base">
                        </div>
                    </div>
                    
                    <div class="mt-6 flex flex-col sm:flex-row gap-3">
                        <button type="button" onclick="closeModal()" class="flex-1 px-4 py-2 bg-[#0A0A0A] border border-[#C2C2C2] text-[#C2C2C2] rounded-lg hover:bg-[#7F3E11] hover:text-white transition-all text-sm sm:text-base">
                            Cancelar
                        </button>
                        <button type="submit" class="flex-1 px-4 py-2 bg-[#D36B1A] text-white rounded-lg hover:bg-[#7F3E11] transition-all text-sm sm:text-base">
                            Cadastrar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').innerHTML = modalHTML;
    updateQuantidadeLabel();
}

// Update quantity label based on selected category
function updateQuantidadeLabel() {
    const categoriaSelect = document.getElementById('categoria');
    const quantidadeLabel = document.getElementById('quantidadeLabel');
    const quantidadeHelp = document.getElementById('quantidadeHelp');
    const quantidadeInput = document.getElementById('quantidade');
    
    if (!categoriaSelect || !quantidadeLabel) return;
    
    const selectedCategory = categoriaSelect.value;
    const unitType = getUnitType(selectedCategory);
    
    if (unitType === 'kg') {
        quantidadeLabel.innerHTML = 'Quantidade (KG) *';
        quantidadeHelp.innerHTML = 'Digite a quantidade em quilogramas (KG). Ex: 2.5';
        if (quantidadeInput) {
            quantidadeInput.step = '0.01';
            quantidadeInput.min = '0.01';
        }
    } else {
        quantidadeLabel.innerHTML = 'Quantidade (Unidades) *';
        quantidadeHelp.innerHTML = 'Digite a quantidade em unidades. Ex: 10';
        if (quantidadeInput) {
            quantidadeInput.step = '1';
            quantidadeInput.min = '1';
        }
    }
}

// Cadastrar Produto
async function cadastrarProduto(event) {
    event.preventDefault();
    
    const produto = document.getElementById('produto').value;
    const marca = document.getElementById('marca').value;
    const categoria = document.getElementById('categoria').value;
    let quantidade = parseFloat(document.getElementById('quantidade').value);
    const validade = document.getElementById('validade').value;
    
    // Validate quantity based on category
    const validationError = validateQuantity(quantidade, categoria);
    if (validationError) {
        showToast(validationError, 'error');
        return;
    }
    
    // Ensure quantity is properly formatted for KG categories
    if (getUnitType(categoria) === 'kg') {
        quantidade = parseFloat(quantidade.toFixed(2));
    } else {
        quantidade = parseInt(quantidade);
    }
    
    // Check if product already exists
    const existingProduct = products.find(p => 
        p.produto.toLowerCase() === produto.toLowerCase() && 
        p.marca.toLowerCase() === marca.toLowerCase()
    );
    
    if (existingProduct) {
        // Update quantity
        const newQuantidade = existingProduct.quantidade + quantidade;
        await atualizarProduto(existingProduct.id, { quantidade: newQuantidade });
        const unitType = getUnitType(existingProduct.categoria);
        showToast(`Produto "${produto}" atualizado! Nova ${unitType === 'kg' ? 'quantidade em KG' : 'quantidade'}: ${newQuantidade} ${unitType === 'kg' ? 'kg' : 'unidades'}`, 'info');
    } else {
        // Create new product
        const data = { produto, marca, categoria, quantidade, validade };
        
        try {
            const response = await fetch(`${API_URL}/estoque`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error('Erro ao cadastrar');
            
            const unitType = getUnitType(categoria);
            showToast(`Produto "${produto}" cadastrado com sucesso! ${quantidade} ${unitType === 'kg' ? 'kg' : 'unidades'}`, 'success');
            closeModal();
            await loadProducts();
            if (currentView === 'estoque') renderEstoque();
            else if (currentView === 'dashboard') updateDashboard();
        } catch (error) {
            showToast('Erro ao cadastrar: ' + error.message, 'error');
        }
    }
}

// Show Editar Modal
function showEditarModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    const unitType = getUnitType(product.categoria);
    const formattedQuantidade = unitType === 'kg' ? product.quantidade.toFixed(2) : product.quantidade;
    
    const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal p-4" onclick="if(event.target === this) closeModal()">
            <div class="bg-[#161616] rounded-lg p-6 sm:p-8 max-w-md w-full mx-auto border border-[#7F3E11] max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-xl sm:text-2xl font-bold text-[#FFFFFF]">
                        <i class="fas fa-edit text-[#D36B1A] mr-2"></i>
                        Editar Produto
                    </h2>
                    <button onclick="closeModal()" class="text-[#C2C2C2] hover:text-[#FFFFFF]">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <form onsubmit="atualizarProduto(${id}, event)">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-[#C2C2C2] mb-2 text-sm sm:text-base">Produto</label>
                            <input type="text" id="produto" value="${product.produto.replace(/"/g, '&quot;')}" class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base">
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2 text-sm sm:text-base">Marca</label>
                            <input type="text" id="marca" value="${product.marca.replace(/"/g, '&quot;')}" class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base">
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2 text-sm sm:text-base">Categoria</label>
                            <select id="categoria" class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base">
                                <option value="Carnes" ${product.categoria === 'Carnes' ? 'selected' : ''}>Carnes (KG)</option>
                                <option value="Carnes Congeladas" ${product.categoria === 'Carnes Congeladas' ? 'selected' : ''}>Carnes Congeladas (KG)</option>
                                <option value="Aves" ${product.categoria === 'Aves' ? 'selected' : ''}>Aves (KG)</option>
                                <option value="Peixes" ${product.categoria === 'Peixes' ? 'selected' : ''}>Peixes (KG)</option>
                                <option value="Frios" ${product.categoria === 'Frios' ? 'selected' : ''}>Frios (KG)</option>
                                <option value="Bebidas" ${product.categoria === 'Bebidas' ? 'selected' : ''}>Bebidas (Unidade)</option>
                                <option value="Acompanhamentos" ${product.categoria === 'Acompanhamentos' ? 'selected' : ''}>Acompanhamentos (Unidade)</option>
                                <option value="Temperos" ${product.categoria === 'Temperos' ? 'selected' : ''}>Temperos (Unidade)</option>
                                <option value="Outros" ${product.categoria === 'Outros' ? 'selected' : ''}>Outros (Unidade)</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2 text-sm sm:text-base">Quantidade (${unitType === 'kg' ? 'KG' : 'Unidades'})</label>
                            <input type="number" id="quantidade" value="${formattedQuantidade}" min="0" step="${unitType === 'kg' ? '0.01' : '1'}" class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base">
                        </div>
                        
                        <div>
                            <label class="block text-[#C2C2C2] mb-2 text-sm sm:text-base">Data de Validade</label>
                            <input type="date" id="validade" value="${product.validade}" class="w-full px-4 py-2 bg-[#0A0A0A] border border-[#7F3E11] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#D36B1A] text-sm sm:text-base">
                        </div>
                    </div>
                    
                    <div class="mt-6 flex flex-col sm:flex-row gap-3">
                        <button type="button" onclick="closeModal()" class="flex-1 px-4 py-2 bg-[#0A0A0A] border border-[#C2C2C2] text-[#C2C2C2] rounded-lg hover:bg-[#7F3E11] hover:text-white transition-all text-sm sm:text-base">
                            Cancelar
                        </button>
                        <button type="submit" class="flex-1 px-4 py-2 bg-[#D36B1A] text-white rounded-lg hover:bg-[#7F3E11] transition-all text-sm sm:text-base">
                            Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').innerHTML = modalHTML;
}

// Atualizar Produto
async function atualizarProduto(id, event) {
    if (event) event.preventDefault();
    
    const produto = document.getElementById('produto')?.value;
    const marca = document.getElementById('marca')?.value;
    const categoria = document.getElementById('categoria')?.value;
    let quantidade = document.getElementById('quantidade') ? parseFloat(document.getElementById('quantidade').value) : null;
    const validade = document.getElementById('validade')?.value;
    
    // Validate quantity if provided
    if (quantidade !== null && categoria) {
        const validationError = validateQuantity(quantidade, categoria);
        if (validationError) {
            showToast(validationError, 'error');
            return;
        }
        
        // Format quantity properly
        if (getUnitType(categoria) === 'kg') {
            quantidade = parseFloat(quantidade.toFixed(2));
        } else {
            quantidade = parseInt(quantidade);
        }
    }
    
    const data = {};
    if (produto) data.produto = produto;
    if (marca) data.marca = marca;
    if (categoria) data.categoria = categoria;
    if (quantidade !== null) data.quantidade = quantidade;
    if (validade) data.validade = validade;
    
    try {
        const response = await fetch(`${API_URL}/estoque/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('Erro ao atualizar');
        
        showToast('Produto atualizado com sucesso!', 'success');
        closeModal();
        await loadProducts();
        if (currentView === 'estoque') renderEstoque();
        else if (currentView === 'dashboard') updateDashboard();
    } catch (error) {
        showToast('Erro ao atualizar: ' + error.message, 'error');
    }
}

// Deletar Produto
async function deletarProduto(id) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    
    try {
        const response = await fetch(`${API_URL}/estoque/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Erro ao deletar');
        
        showToast('Produto excluído com sucesso!', 'success');
        await loadProducts();
        if (currentView === 'estoque') renderEstoque();
        else if (currentView === 'dashboard') updateDashboard();
    } catch (error) {
        showToast('Erro ao deletar: ' + error.message, 'error');
    }
}

// Close Modal
function closeModal() {
    document.getElementById('modalContainer').innerHTML = '';
}