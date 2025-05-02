// Arduino UNO Code for Warehouse Management System
#include <SPI.h>
#include <MFRC522.h>
#include <DHT.h>
#include <SoftwareSerial.h>

// Pin definitions
#define RST_PIN         9
#define SS_PIN          10
#define DHT_PIN         2
#define DHT_TYPE        DHT11

// Create instances
MFRC522 rfid(SS_PIN, RST_PIN);
DHT dht(DHT_PIN, DHT_TYPE);
SoftwareSerial nodeSerial(3, 4); // RX, TX for communication with NodeMCU

// Variables for RFID
byte knownTags[][4] = {
  {0x23, 0xAB, 0x7C, 0x31}, // Example tag 1
  {0x03, 0xD0, 0xDb, 0xEE},
  {0xFE,0x6D,0xB8,0x03}
};
String tagNames[] = {"Product A", "Product B","Product C"};
bool tagPresent[3] = {false, false, false};

// Variables for sensor readings
float temperature = 0;
float humidity = 0;
unsigned long previousMillis = 0;
const long interval = 2000; // Interval for sensor readings

void setup() {
  // Initialize serial communications
  Serial.begin(9600);
  nodeSerial.begin(9600);
  
  // Initialize SPI bus and RFID
  SPI.begin();
  rfid.PCD_Init();
  
  // Initialize DHT sensor
  dht.begin();
  
  Serial.println("Warehouse Management System - Arduino Ready");
  delay(1000);
}

void loop() {
  unsigned long currentMillis = millis();
  
  // Read temperature and humidity at regular intervals
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    readDHT();
    sendDataToNodeMCU();
  }
  
  // Check for RFID tags
  readRFID();
}

void readDHT() {
  // Read temperature and humidity
  humidity = dht.readHumidity();
  temperature = dht.readTemperature();
  
  // Check if readings are valid
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }
  
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.print("°C, Humidity: ");
  Serial.print(humidity);
  Serial.println("%");
}

void readRFID() {
  // Check if there's a new card present
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial())
    return;
    
  Serial.println("Card detected!");
  
  // Show UID on serial monitor
  Serial.print("UID: ");
  String content = "";
  byte letter;
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(rfid.uid.uidByte[i], HEX);
    content.concat(String(rfid.uid.uidByte[i] < 0x10 ? " 0" : " "));
    content.concat(String(rfid.uid.uidByte[i], HEX));
  }
  Serial.println();
  
  // Check if it's a known tag
  for (int i = 0; i < sizeof(knownTags)/sizeof(knownTags[0]); i++) {
    bool match = true;
    for (int j = 0; j < 4; j++) {
      if (rfid.uid.uidByte[j] != knownTags[i][j]) {
        match = false;
        break;
      }
    }
    
    if (match) {
      tagPresent[i] = !tagPresent[i]; // Toggle presence
      Serial.print(tagNames[i]);
      Serial.println(tagPresent[i] ? " added to inventory" : " removed from inventory");
      
      // Send RFID data to NodeMCU
      nodeSerial.print("RFID:");
      nodeSerial.print(i);
      nodeSerial.print(":");
      nodeSerial.println(tagPresent[i] ? "1" : "0");
      break;
    }
  }
  
  // Halt PICC and stop encryption
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void sendDataToNodeMCU() {
  // Send temperature and humidity data
  nodeSerial.print("DHT:");
  nodeSerial.print(temperature);
  nodeSerial.print(":");
  nodeSerial.println(humidity);
  
  // Send inventory status
  nodeSerial.print("INV:");
  for (int i = 0; i < sizeof(tagPresent)/sizeof(tagPresent[0]); i++) {
    nodeSerial.print(tagPresent[i] ? "1" : "0");
    if (i < sizeof(tagPresent)/sizeof(tagPresent[0]) - 1) {
      nodeSerial.print(",");
    }
  }
  nodeSerial.println();
}