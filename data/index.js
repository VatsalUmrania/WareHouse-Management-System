// Configuration
const CONFIG = {
    DATA_INTERVAL: 10000,  // 10 seconds
    MAX_LOG_ENTRIES: 50,
    DEFAULT_TEMP_THRESHOLD: 30,
    DEFAULT_HUMIDITY_THRESHOLD: 70,
    DEFAULT_STOCK_THRESHOLD: 10,
    USER: 'VatsalUmrania',
    STORAGE_KEYS: {
        INVENTORY: 'warehouse_inventory',
        PRODUCTS: 'warehouse_rfid_products',
        THRESHOLDS: 'warehouse_thresholds',
        FAILED_REQUESTS: 'failedGoogleSheetsRequests'
    },
    GOOGLE_SHEETS_URL: 'https://script.google.com/macros/s/YOUR_APP_SCRIPT_ID/exec'
};

// Global variables
let lastDataSent = 0;
let socket;
let isConnected = false;
let reconnectInterval = null;

// Initial data
let products = {
    '23AB7C31': 'Product A',
    '03D0DbEE': 'Product B'
};
let inventory = {};
let tempThreshold = CONFIG.DEFAULT_TEMP_THRESHOLD;
let humidityThreshold = CONFIG.DEFAULT_HUMIDITY_THRESHOLD;
let stockThreshold = CONFIG.DEFAULT_STOCK_THRESHOLD;

// DOM Elements
const timeDisplay = document.getElementById('utc-time');
const currentUserDisplay = document.getElementById('current-user');
const tempDisplay = document.getElementById('temperature');
const humidityDisplay = document.getElementById('humidity');
const tempStatus = document.getElementById('temp-status');
const humidityStatus = document.getElementById('humidity-status');
const inventoryList = document.getElementById('inventory-list');
const inventoryAlerts = document.getElementById('inventory-alerts');
const activityLog = document.getElementById('activity-log');

const tempThresholdInput = document.getElementById('temp-threshold');
const humidityThresholdInput = document.getElementById('humidity-threshold');
const stockThresholdInput = document.getElementById('stock-threshold');
const currentTempThreshold = document.getElementById('current-temp-threshold');
const currentHumidityThreshold = document.getElementById('current-humidity-threshold');
const currentStockThreshold = document.getElementById('current-stock-threshold');

// RFID popup elements
const testRfidBtn = document.getElementById('test-rfid');
const rfidPopup = document.getElementById('rfid-popup');
const closePopupBtn = document.getElementById('close-popup');
const rfidTagId = document.getElementById('rfid-tag-id');
const rfidProductName = document.getElementById('rfid-product-name');
const itemQuantity = document.getElementById('item-quantity');
const btnAddInventory = document.getElementById('btn-add-inventory');
const btnRemoveInventory = document.getElementById('btn-remove-inventory');
const btnCancel = document.getElementById('btn-cancel');

const newRfidPopup = document.getElementById('new-rfid-popup');
const closeNewPopupBtn = document.getElementById('close-new-popup');
const newRfidTag = document.getElementById('new-rfid-tag');
const newProductNameInput = document.getElementById('new-product-name');
const newProductQtyInput = document.getElementById('new-product-qty');
const saveNewRfidBtn = document.getElementById('save-new-rfid');
const cancelNewRfidBtn = document.getElementById('cancel-new-rfid');

// Utility Functions
function formatUTCDate(date) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
           `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function updateTimeDisplay() {
    const now = new Date();
    timeDisplay.textContent = formatUTCDate(now);
}

// Storage Functions
function loadFromStorage() {
    try {
        const savedInventory = localStorage.getItem(CONFIG.STORAGE_KEYS.INVENTORY);
        if (savedInventory) {
            inventory = JSON.parse(savedInventory);
            updateInventoryDisplay();
        }
        
        const savedProducts = localStorage.getItem(CONFIG.STORAGE_KEYS.PRODUCTS);
        if (savedProducts) {
            Object.assign(products, JSON.parse(savedProducts));
        }
        
        const savedThresholds = localStorage.getItem(CONFIG.STORAGE_KEYS.THRESHOLDS);
        if (savedThresholds) {
            const thresholds = JSON.parse(savedThresholds);
            tempThreshold = thresholds.temperature || CONFIG.DEFAULT_TEMP_THRESHOLD;
            humidityThreshold = thresholds.humidity || CONFIG.DEFAULT_HUMIDITY_THRESHOLD;
            stockThreshold = thresholds.stock || CONFIG.DEFAULT_STOCK_THRESHOLD;
            updateThresholdDisplays();
        }
        
        addLogEntry('Data loaded from storage');
    } catch (error) {
        console.error('Error loading from storage:', error);
        addAlert('Error loading saved data. Resetting to defaults.', 'danger');
        recoverFromError();
    }
}

function saveInventoryToStorage() {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
    } catch (error) {
        console.error('Error saving inventory:', error);
        addAlert('Error saving inventory data', 'danger');
    }
}

function saveProductsToStorage() {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    } catch (error) {
        console.error('Error saving products:', error);
        addAlert('Error saving RFID product data', 'danger');
    }
}

function saveThresholdsToStorage() {
    try {
        const thresholds = {
            temperature: tempThreshold,
            humidity: humidityThreshold,
            stock: stockThreshold
        };
        localStorage.setItem(CONFIG.STORAGE_KEYS.THRESHOLDS, JSON.stringify(thresholds));
    } catch (error) {
        console.error('Error saving thresholds:', error);
        addAlert('Error saving threshold data', 'danger');
    }
}

// WebSocket Functions
function initWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${wsProtocol}//${window.location.hostname}:81/`);
    
    socket.onopen = function() {
        console.log('WebSocket connected');
        isConnected = true;
        clearInterval(reconnectInterval);
        addLogEntry('Connected to NodeMCU');
        socket.send('update');
    };
    
    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            addAlert('Error processing sensor data', 'danger');
        }
    };
    
    socket.onclose = function() {
        isConnected = false;
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                console.log('Attempting to reconnect...');
                initWebSocket();
            }, 5000);
        }
        addAlert('Connection lost. Attempting to reconnect...', 'warning');
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        addAlert('Connection error occurred', 'danger');
    };
}

// Data Processing Functions
function handleWebSocketMessage(data) {
    const now = Date.now();
    
    if (now - lastDataSent >= CONFIG.DATA_INTERVAL) {
        if (data.temperature !== undefined) {
            processTemperatureData(data.temperature);
        }
        if (data.humidity !== undefined) {
            processHumidityData(data.humidity);
        }
        lastDataSent = now;
    }
    
    if (data.action === 'rfid_detected') {
        processRFIDDetection(data);
    }
}

function processTemperatureData(temperature) {
    const currentTemp = parseFloat(temperature.toFixed(1));
    tempDisplay.textContent = `${currentTemp}°C`;
    const status = currentTemp > tempThreshold ? 'HIGH!' : 'Normal';
    tempStatus.textContent = status;
    tempStatus.style.color = status === 'HIGH!' ? '#e74c3c' : '#2ecc71';
    
    sendToGoogleSheets({
        type: 'temperature',
        timestamp: formatUTCDate(new Date()),
        value: currentTemp,
        threshold: tempThreshold,
        status: status,
        user: CONFIG.USER
    });
    
    if (status === 'HIGH!') {
        addAlert(`High temperature detected: ${currentTemp}°C`);
    }
}

function processHumidityData(humidity) {
    const currentHumidity = parseFloat(humidity.toFixed(1));
    humidityDisplay.textContent = `${currentHumidity}%`;
    const status = currentHumidity > humidityThreshold ? 'HIGH!' : 'Normal';
    humidityStatus.textContent = status;
    humidityStatus.style.color = status === 'HIGH!' ? '#e74c3c' : '#2ecc71';
    
    sendToGoogleSheets({
        type: 'humidity',
        timestamp: formatUTCDate(new Date()),
        value: currentHumidity,
        threshold: humidityThreshold,
        status: status,
        user: CONFIG.USER
    });
    
    if (status === 'HIGH!') {
        addAlert(`High humidity detected: ${currentHumidity}%`);
    }
}

function processRFIDDetection(data) {
    const tagId = data.tag_id || data.rfidTag;
    if (!tagId) {
        console.error("No tag ID in RFID data:", data);
        return;
    }
    
    if (products[tagId]) {
        const productName = products[tagId];
        showRfidPopup(tagId, productName);
        sendToGoogleSheets({
            type: 'rfid_detection',
            timestamp: formatUTCDate(new Date()),
            tagId: tagId,
            productName: productName,
            quantity: inventory[productName] || 0,
            user: CONFIG.USER
        });
        addLogEntry(`RFID detected: ${tagId} (${productName})`);
    } else {
        showNewRfidPopup(tagId);
        addLogEntry(`Unknown RFID detected: ${tagId}`);
    }
}

// Google Sheets Integration
function sendToGoogleSheets(data) {
    fetch(CONFIG.GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: JSON.stringify(data)
    })
    .then(() => {
        console.log('Data sent to Google Sheets:', data);
    })
    .catch(error => {
        console.error('Error sending to Google Sheets:', error);
        const failedRequests = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.FAILED_REQUESTS) || '[]');
        failedRequests.push(data);
        localStorage.setItem(CONFIG.STORAGE_KEYS.FAILED_REQUESTS, JSON.stringify(failedRequests));
        addAlert('Failed to send data to Google Sheets', 'danger');
    });
}

function retryFailedRequests() {
    const failedRequests = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.FAILED_REQUESTS) || '[]');
    if (failedRequests.length > 0) {
        console.log(`Retrying ${failedRequests.length} failed requests`);
        const retryingRequests = [...failedRequests];
        localStorage.setItem(CONFIG.STORAGE_KEYS.FAILED_REQUESTS, '[]');
        
        retryingRequests.forEach(data => {
            sendToGoogleSheets(data);
        });
    }
}

// UI Functions
function updateInventoryDisplay() {
    inventoryList.innerHTML = '';
    Object.entries(inventory).forEach(([product, quantity]) => {
        const item = document.createElement('div');
        item.className = 'inventory-item';
        item.innerHTML = `
            <span class="inventory-name">${product}</span>
            <span class="inventory-qty">${quantity} units</span>
        `;
        inventoryList.appendChild(item);
        
        if (quantity < stockThreshold) {
            addAlert(`Low stock alert: ${product} (${quantity} units)`);
        }
    });
    saveInventoryToStorage();
}

function updateThresholdDisplays() {
    tempThresholdInput.value = tempThreshold;
    humidityThresholdInput.value = humidityThreshold;
    stockThresholdInput.value = stockThreshold;
    currentTempThreshold.textContent = `${tempThreshold}°C`;
    currentHumidityThreshold.textContent = `${humidityThreshold}%`;
    currentStockThreshold.textContent = `${stockThreshold} units`;
}

function showRfidPopup(tagId, productName) {
    rfidPopup.classList.add('show');
    rfidTagId.textContent = tagId;
    rfidProductName.textContent = productName;
    itemQuantity.value = 1;
}

function showNewRfidPopup(tagId) {
    newRfidPopup.classList.add('show');
    newRfidTag.textContent = tagId;
    newProductNameInput.value = '';
    newProductQtyInput.value = 1;
}

// Inventory Management
function updateInventory(productName, quantity, action) {
    if (validateInventoryOperation(productName, quantity, action)) {
        const oldQuantity = inventory[productName] || 0;
        const newQuantity = action === 'add' ? oldQuantity + quantity : oldQuantity - quantity;
        inventory[productName] = newQuantity;
        
        sendToGoogleSheets({
            type: 'inventory',
            timestamp: formatUTCDate(new Date()),
            productName: productName,
            quantity: quantity,
            action: action,
            previousStock: oldQuantity,
            newTotal: newQuantity,
            stockThreshold: stockThreshold,
            user: CONFIG.USER
        });
        
        updateInventoryDisplay();
        addLogEntry(`${action === 'add' ? 'Added' : 'Removed'} ${quantity} unit(s) of ${productName}`);
    }
}

function validateInventoryOperation(productName, quantity, operation) {
    if (!productName || productName === 'Unknown Product') {
        addAlert('Invalid product name', 'danger');
        return false;
    }
    if (!quantity || quantity <= 0) {
        addAlert('Invalid quantity', 'danger');
        return false;
    }
    if (operation === 'remove' && (inventory[productName] || 0) < quantity) {
        addAlert(`Insufficient stock for ${productName}`, 'danger');
        return false;
    }
    return true;
}

// UI Feedback Functions
function addAlert(message, type = 'warning') {
    const existingAlerts = document.querySelectorAll('.alert');
    for (let alert of existingAlerts) {
        if (alert.textContent === message) return;
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    inventoryAlerts.prepend(alert);
    addLogEntry(message);
    
    setTimeout(() => alert.remove(), 5000);
}

function addLogEntry(message) {
    const now = new Date();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <div>${message}</div>
        <div class="log-time">${formatUTCDate(now)}</div>
    `;
    activityLog.prepend(logEntry);
    
    const entries = activityLog.querySelectorAll('.log-entry');
    if (entries.length > CONFIG.MAX_LOG_ENTRIES) {
        activityLog.removeChild(entries[entries.length - 1]);
    }
}

// Error Recovery
function recoverFromError() {
    try {
        inventory = {};
        products = {
            '23AB7C31': 'Product A',
            '03D0DbEE': 'Product B'
        };
        
        tempThreshold = CONFIG.DEFAULT_TEMP_THRESHOLD;
        humidityThreshold = CONFIG.DEFAULT_HUMIDITY_THRESHOLD;
        stockThreshold = CONFIG.DEFAULT_STOCK_THRESHOLD;
        
        saveInventoryToStorage();
        saveProductsToStorage();
        saveThresholdsToStorage();
        
        updateInventoryDisplay();
        updateThresholdDisplays();
        
        if (socket) {
            socket.close();
        }
        initWebSocket();
        
        addAlert('System recovered from error', 'info');
        return true;
    } catch (error) {
        console.error('Recovery failed:', error);
        addAlert('System recovery failed', 'danger');
        return false;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    try {
        updateTimeDisplay();
        setInterval(updateTimeDisplay, 1000);
        
        currentUserDisplay.textContent = CONFIG.USER;
        loadFromStorage();
        initWebSocket();
        
        // Set up periodic tasks
        setInterval(retryFailedRequests, 60000); // Retry failed requests every minute
        setInterval(() => {
            if (isConnected) {
                socket.send('update');
            }
        }, CONFIG.DATA_INTERVAL);
        
        addLogEntry('System initialized');
    } catch (error) {
        console.error('Initialization error:', error);
        addAlert('Error initializing system', 'danger');
        recoverFromError();
    }
});

// RFID Popup Event Listeners
testRfidBtn?.addEventListener('click', () => {
    const productNames = Object.values(products);
    const randomProduct = productNames[Math.floor(Math.random() * productNames.length)];
    const randomTag = Object.keys(products).find(key => products[key] === randomProduct);
    showRfidPopup(randomTag, randomProduct);
});

closePopupBtn?.addEventListener('click', () => rfidPopup.classList.remove('show'));
btnCancel?.addEventListener('click', () => rfidPopup.classList.remove('show'));

btnAddInventory?.addEventListener('click', () => {
    const productName = rfidProductName.textContent;
    const quantity = parseInt(itemQuantity.value) || 0;
    updateInventory(productName, quantity, 'add');
    rfidPopup.classList.remove('show');
});

btnRemoveInventory?.addEventListener('click', () => {
    const productName = rfidProductName.textContent;
    const quantity = parseInt(itemQuantity.value) || 0;
    updateInventory(productName, quantity, 'remove');
    rfidPopup.classList.remove('show');
});

// New RFID Popup Event Listeners
closeNewPopupBtn?.addEventListener('click', () => newRfidPopup.classList.remove('show'));
cancelNewRfidBtn?.addEventListener('click', () => newRfidPopup.classList.remove('show'));

saveNewRfidBtn?.addEventListener('click', () => {
    const tagId = newRfidTag.textContent;
    const productName = newProductNameInput.value.trim();
    const quantity = parseInt(newProductQtyInput.value) || 1;
    
    if (productName) {
        products[tagId] = productName;
        saveProductsToStorage();
        
        if (quantity > 0) {
            updateInventory(productName, quantity, 'add');
        }
        
        addLogEntry(`New RFID Card added: ${tagId} - ${productName}`);
        newRfidPopup.classList.remove('show');
    } else {
        addAlert('Please enter a product name', 'danger');
    }
});

// Threshold Input Event Listeners
tempThresholdInput?.addEventListener('input', function() {
    tempThreshold = parseInt(this.value);
    currentTempThreshold.textContent = `${tempThreshold}°C`;
    saveThresholdsToStorage();
    
    sendToGoogleSheets({
        type: 'threshold_update',
        timestamp: formatUTCDate(new Date()),
        parameter: 'temperature',
        value: tempThreshold,
        user: CONFIG.USER
    });
    
    if (isConnected) {
        socket.send(JSON.stringify({
            action: 'update_threshold',
            data: { type: 'temp', value: tempThreshold }
        }));
    }
});

humidityThresholdInput?.addEventListener('input', function() {
    humidityThreshold = parseInt(this.value);
    currentHumidityThreshold.textContent = `${humidityThreshold}%`;
    saveThresholdsToStorage();
    
    sendToGoogleSheets({
        type: 'threshold_update',
        timestamp: formatUTCDate(new Date()),
        parameter: 'humidity',
        value: humidityThreshold,
        user: CONFIG.USER
    });
    
    if (isConnected) {
        socket.send(JSON.stringify({
            action: 'update_threshold',
            data: { type: 'humidity', value: humidityThreshold }
        }));
    }
});

stockThresholdInput?.addEventListener('change', function() {
    stockThreshold = parseInt(this.value);
    currentStockThreshold.textContent = `${stockThreshold} units`;
    saveThresholdsToStorage();
    updateInventoryDisplay();
    
    sendToGoogleSheets({
        type: 'threshold_update',
        timestamp: formatUTCDate(new Date()),
        parameter: 'stock',
        value: stockThreshold,
        user: CONFIG.USER
    });
});