// NodeMCU Code for Warehouse Management System (Without Google Sheets Integration)
// Updated logic: When an RFID card is read, the system sends an event so that the client
// can prompt the user to enter the number of items to add or remove.
// If a product's name is empty, it defaults to "Unknown Product."
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <SoftwareSerial.h>
#include <LittleFS.h>  // Include LittleFS for file system

// Network credentials
const char* ssid = "moto g85 5G_7598";
const char* password = "Vatsal@123";

// Communication with Arduino
SoftwareSerial arduinoSerial(D2, D1); // RX (D2/GPIO4), TX (D1/GPIO5)

// Web server and WebSocket
ESP8266WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

// Pin definitions for alerts
#define TEMP_LED D5
#define STOCK_LED D6
#define BUZZER D7

// Variables for sensor data
float temperature = 0;
float humidity = 0;
bool productPresent[3] = {false, false, false};
String productNames[3] = {"Product A", "Product B", "Product C"};  // Legacy tracking for prod A and B
int productQuantities[3] = {0, 0, 0};  // Legacy tracking for first two products

// Maximum number of products to track
#define MAX_PRODUCTS 4

// Product inventory data structure
struct Product {
  String name;
  int quantity;
  String rfidTag;
  bool present;
};
Product inventory[MAX_PRODUCTS];

// Threshold values
const float TEMP_THRESHOLD = 30.0;
const int LOW_STOCK_THRESHOLD = 1;

// String to store incoming data from Arduino
String inputString = "";
boolean stringComplete = false;

// Timers for WebSocket updates and file save
unsigned long lastWebSocketUpdate = 0;
const long webSocketInterval = 100; // 100 ms
unsigned long lastSaveTime = 0;
const long saveInterval = 60000; // Save every 60 seconds

// Global RFID event flag and storage for last event product details.
// These are used to instruct the client to open a popup for product quantity input.
bool newRFIDEvent = false;
String lastRFIDTag = "";
String lastProductName = "";

void setup() {
  // Initialize serial communications
  Serial.begin(9600);
  arduinoSerial.begin(9600);
  
  // Initialize pins
  pinMode(TEMP_LED, OUTPUT);
  pinMode(STOCK_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  
  // Initialize LittleFS
  if (!LittleFS.begin()) {
    Serial.println("An error occurred while mounting LittleFS");
    return;
  }
  Serial.println("LittleFS mounted successfully");
  
  // Load inventory data from LittleFS
  loadInventoryData();
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected to WiFi. IP address: ");
  Serial.println(WiFi.localIP());
  
  // Setup web server routes
  server.on("/", handleRoot);
  server.on("/index.html", handleRoot);
  server.on("/styles.css", handleCSS);
  server.on("/index.js", handleJS);
  server.onNotFound(handleNotFound);
  server.begin();
  
  // Start WebSocket server
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  
  Serial.println("HTTP server and WebSocket server started");
}

void loop() {
  // Handle web server and WebSocket clients
  server.handleClient();
  webSocket.loop();
  
  // Read data from Arduino
  while (arduinoSerial.available()) {
    char inChar = (char)arduinoSerial.read();
    inputString += inChar;
    if (inChar == '\n') {
      stringComplete = true;
    }
  }
  
  // Process complete message from Arduino
  if (stringComplete) {
    processArduinoData(inputString);
    inputString = "";
    stringComplete = false;
  }
  
  // Check sensor thresholds and trigger alerts
  checkThresholds();
  
  // Send periodic WebSocket updates
  unsigned long currentMillis = millis();
  if (currentMillis - lastWebSocketUpdate >= webSocketInterval) {
    lastWebSocketUpdate = currentMillis;
    sendWebSocketUpdate();
  }
  
  // Save inventory data periodically
  if (currentMillis - lastSaveTime >= saveInterval) {
    lastSaveTime = currentMillis;
    saveInventoryData();
  }
  
  delay(1000);
}

void loadInventoryData() {
  if (LittleFS.exists("/inventory.json")) {
    File file = LittleFS.open("/inventory.json", "r");
    if (file) {
      StaticJsonDocument<1024> doc;
      DeserializationError error = deserializeJson(doc, file);
      
      if (error) {
        Serial.println("Failed to read inventory file");
      } else {
        JsonArray products = doc["products"];
        // Clear existing inventory
        for (int i = 0; i < MAX_PRODUCTS; i++) {
          inventory[i].name = "";
          inventory[i].quantity = 0;
          inventory[i].rfidTag = "";
          inventory[i].present = false;
        }
        // Load inventory from file
        int index = 0;
        for (JsonObject product : products) {
          if (index < MAX_PRODUCTS) {
            inventory[index].name = product["name"].as<String>();
            inventory[index].quantity = product["quantity"].as<int>();
            inventory[index].rfidTag = product["rfidTag"].as<String>();
            inventory[index].present = product["present"].as<bool>();
            // Update legacy arrays for first two products
            if (index < 2) {
              productNames[index] = inventory[index].name;
              productQuantities[index] = inventory[index].quantity;
              productPresent[index] = inventory[index].present;
            }
            index++;
          }
        }
        Serial.println("Inventory data loaded successfully");
      }
      file.close();
    }
  } else {
    // No file exists — initialize with default values.
    inventory[0] = {"Product A", 15, "A1B2C3D4", false};
    inventory[1] = {"Product B", 8, "E5F6G7H8", false};
    inventory[2] = {"Product C", 23, "I9J0K1L2", false};
    inventory[3] = {"Product D", 5, "M3N4O5P6", false};
    for (int i = 0; i < 2; i++) {
      productNames[i] = inventory[i].name;
      productQuantities[i] = inventory[i].quantity;
      productPresent[i] = inventory[i].present;
    }
    saveInventoryData();
    Serial.println("Created default inventory data");
  }
}

void saveInventoryData() {
  File file = LittleFS.open("/inventory.json", "w");
  if (!file) {
    Serial.println("Failed to open inventory file for writing");
    return;
  }
  StaticJsonDocument<1024> doc;
  JsonArray products = doc.createNestedArray("products");
  for (int i = 0; i < MAX_PRODUCTS; i++) {
    if (inventory[i].name != "") {
      JsonObject product = products.createNestedObject();
      product["name"] = inventory[i].name;
      product["quantity"] = inventory[i].quantity;
      product["rfidTag"] = inventory[i].rfidTag;
      product["present"] = inventory[i].present;
    }
  }
  if (serializeJson(doc, file) == 0) {
    Serial.println("Failed to write to inventory file");
  } else {
    Serial.println("Inventory data saved successfully");
  }
  file.close();
}

void processArduinoData(String data) {
  // Remove newline and whitespace.
  data.trim();
  
  if (data.startsWith("DHT:")) {
    // Expected format: DHT:temperature:humidity
    int firstColon = data.indexOf(':');
    int secondColon = data.indexOf(':', firstColon + 1);
    temperature = data.substring(firstColon + 1, secondColon).toFloat();
    humidity = data.substring(secondColon + 1).toFloat();
    Serial.print("Received from Arduino - Temperature: ");
    Serial.print(temperature);
    Serial.print("°C, Humidity: ");
    Serial.print(humidity);
    Serial.println("%");
    sendWebSocketUpdate();
  }
  else if (data.startsWith("RFID:")) {
    // Expected format: RFID:productIndex:status
    // The status (1 for add, 0 for remove) is received.
    int firstColon = data.indexOf(':');
    int secondColon = data.indexOf(':', firstColon + 1);
    int productIndex = data.substring(firstColon + 1, secondColon).toInt();
    int status = data.substring(secondColon + 1).toInt();
    
    if (productIndex >= 0 && productIndex < MAX_PRODUCTS) {
      Serial.print("RFID Event for Product: ");
      Serial.println(inventory[productIndex].name);
      // Set flag and store product details for client to display a popup.
      newRFIDEvent = true;
      lastRFIDTag = inventory[productIndex].rfidTag;
      // If the product name is empty, default to "Unknown Product"
      if(inventory[productIndex].name == "") {
        lastProductName = "Unknown Product";
      } else {
        lastProductName = inventory[productIndex].name;
      }
      // Do not automatically change quantity—this will be managed by client/user input.
      sendWebSocketUpdate();
    }
  }
  else if (data.startsWith("INV:")) {
    // Expected format: INV:status1,status2,...
    String statusString = data.substring(4);
    int nextComma = 0;
    int index = 0;
    while (nextComma >= 0 && index < MAX_PRODUCTS) {
      int currentComma = nextComma;
      nextComma = statusString.indexOf(',', currentComma + 1);
      String value;
      if (nextComma >= 0) {
        value = statusString.substring(currentComma == 0 ? 0 : currentComma + 1, nextComma);
      } else {
        value = statusString.substring(currentComma == 0 ? 0 : currentComma + 1);
      }
      bool present = (value == "1");
      if (index < 2) {
        productPresent[index] = present;
      }
      inventory[index].present = present;
      index++;
    }
    sendWebSocketUpdate();
  }
}

void checkThresholds() {
  // Temperature alert
  bool tempAlert = (temperature > TEMP_THRESHOLD);
  digitalWrite(TEMP_LED, tempAlert ? HIGH : LOW);
  
  // Stock alert: count products below low stock threshold.
  int lowStockCount = 0;
  for (int i = 0; i < MAX_PRODUCTS; i++) {
    if (inventory[i].quantity < LOW_STOCK_THRESHOLD) {
      lowStockCount++;
    }
  }
  bool stockAlert = (lowStockCount > 0);
  digitalWrite(STOCK_LED, stockAlert ? HIGH : LOW);
  
  // Trigger buzzer if any alert is active.
  if (tempAlert || stockAlert) {
    digitalWrite(BUZZER, HIGH);
    delay(100);
    digitalWrite(BUZZER, LOW);
    delay(100);
  }
}

void sendWebSocketUpdate() {
  StaticJsonDocument<1024> jsonDoc;
  jsonDoc["temperature"] = temperature;
  jsonDoc["humidity"] = humidity;
  jsonDoc["tempAlert"] = (temperature > TEMP_THRESHOLD);
  
  // If an RFID event is pending, notify the client to open the popup.
  if (newRFIDEvent) {
    jsonDoc["action"] = "rfid_detected";
    jsonDoc["rfidTag"] = lastRFIDTag;
    jsonDoc["productName"] = lastProductName;
    // Reset the event flag so the action is only sent once per event.
    newRFIDEvent = false;
  }
  
  JsonArray productsArray = jsonDoc.createNestedArray("products");
  for (int i = 0; i < MAX_PRODUCTS; i++) {
    if (inventory[i].name != "") {
      JsonObject product = productsArray.createNestedObject();
      product["name"] = inventory[i].name;
      product["quantity"] = inventory[i].quantity;
      product["present"] = inventory[i].present;
    }
  }
  
  String jsonString;
  serializeJson(jsonDoc, jsonString);
  webSocket.broadcastTXT(jsonString);
}

void handleRoot() {
  if (LittleFS.exists("/index.html")) {
    File file = LittleFS.open("/index.html", "r");
    server.streamFile(file, "text/html");
    file.close();
  } else {
    server.send(404, "text/plain", "Index file not found!");
  }
}

void handleCSS() {
  if (LittleFS.exists("/styles.css")) {
    File file = LittleFS.open("/styles.css", "r");
    server.streamFile(file, "text/css");
    file.close();
  } else {
    server.send(404, "text/plain", "CSS file not found!");
  }
}

void handleJS() {
  if (LittleFS.exists("/index.js")) {
    File file = LittleFS.open("/index.js", "r");
    server.streamFile(file, "application/javascript");
    file.close();
  } else {
    server.send(404, "text/plain", "JavaScript file not found!");
  }
}

void handleNotFound() {
  String path = server.uri();
  Serial.println("File not found: " + path);
  if (path.endsWith("/")) path += "index.html";
  String contentType = "text/plain";
  if (path.endsWith(".html")) contentType = "text/html";
  else if (path.endsWith(".css")) contentType = "text/css";
  else if (path.endsWith(".js")) contentType = "application/javascript";
  
  if (LittleFS.exists(path)) {
    File file = LittleFS.open(path, "r");
    server.streamFile(file, contentType);
    file.close();
    return;
  }
  server.send(404, "text/plain", "File Not Found");
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      break;
    case WStype_CONNECTED: {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[%u] Connected from %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);
        sendWebSocketUpdate();
      }
      break;
    case WStype_TEXT: {
        Serial.printf("[%u] Received text: %s\n", num, payload);
        String message = String((char*)payload);
        if(message == "update") {
          sendWebSocketUpdate();
        }
        else if(message.startsWith("update_inventory:")) {
          StaticJsonDocument<512> doc;
          DeserializationError error = deserializeJson(doc, message.substring(16));
          if (!error) {
            String productName = doc["name"];
            int quantity = doc["quantity"];
            int action = doc["action"]; // 1 = add, 0 = remove
            // Find the product and update quantity based on user input.
            for (int i = 0; i < MAX_PRODUCTS; i++) {
              if (inventory[i].name == productName) {
                if (action == 1) {
                  inventory[i].quantity += quantity;
                } else {
                  inventory[i].quantity = max(0, inventory[i].quantity - quantity);
                }
                if (i < 2) {
                  productQuantities[i] = inventory[i].quantity;
                }
                saveInventoryData();
                sendWebSocketUpdate();
                break;
              }
            }
          }
        }
      }
      break;
  }
}