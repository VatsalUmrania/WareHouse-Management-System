# Warehouse Management System

[![Languages](https://img.shields.io/github/languages/top/VatsalUmrania/WareHouse-Management-System)](https://github.com/VatsalUmrania/WareHouse-Management-System)
[![License](https://img.shields.io/github/license/VatsalUmrania/WareHouse-Management-System)](LICENSE)

## 📋 Overview

The **Warehouse Management System** is designed to streamline the processes of tracking inventory, managing orders, and optimizing warehouse operations. Built with a combination of JavaScript, C++, CSS, and HTML, this system provides an efficient and user-friendly platform for warehouse administrators.

---

## ✨ Features

- **Inventory Management**: Track and manage stock levels efficiently.
- **Order Processing**: Handle customer orders seamlessly.
- **Real-Time Updates**: Monitor stock levels and order statuses in real time.
- **User-Friendly Interface**: Designed for ease of use with a clean and intuitive UI.
- **Google-Sheet-Integration**

---


---

## 📂 Project Structure

```
WareHouse-Management-System/
│
├── Uno.ino               # Core source code
├── Nodemcu/          # Images, icons, and other assets
├────── Nodemcu.ino           # CSS files for styling
├────── data/    # C++ backend logic
├──────────index.html         # Main HTML file
├──────────index.js           # Js File
├──────────styles.css         #styles
├── README.md          # Project documentation
└── LICENSE            # License file
```

---

## 🔌 Hardware Connections

### Power Supply
- **External 5V** → NodeMCU Vin
- **NodeMCU 3.3V** → Arduino UNO 3.3V
- **NodeMCU GND** → Arduino UNO GND

### Communication
- **NodeMCU D1 (GPIO5)** → Arduino UNO TX
- **NodeMCU D2 (GPIO4)** → Arduino UNO RX

### Sensors on Arduino UNO
- **DHT11 Data** → Arduino PIN 2
- **DHT11 VCC** → Arduino 3.3V
- **DHT11 GND** → Arduino GND

### RFID RC522
- **RST** → Arduino PIN 9
- **SDA (SS)** → Arduino PIN 10
- **MOSI** → Arduino PIN 11
- **MISO** → Arduino PIN 12
- **SCK** → Arduino PIN 13
- **GND** → Arduino GND
- **3.3V** → Arduino 3.3V

### Alert System on NodeMCU
- **Temperature Alert LED** → NodeMCU D5
- **Stock Alert LED** → NodeMCU D6
- **Buzzer** → NodeMCU D7

---

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/VatsalUmrania/WareHouse-Management-System.git
   cd WareHouse-Management-System
   ```

2. Open `index.html` in your preferred browser for the front-end interface with the Server.

---

## 🔧 Technologies Used

| Language       | Percentage |
|----------------|------------|
| JavaScript     | 42.8%      |
| C++            | 30.9%      |
| CSS            | 14.9%      |
| HTML           | 11.4%      |
## 📧 Contact

- **Author**: Vatsal Umrania
- **GitHub**: [VatsalUmrania](https://github.com/VatsalUmrania)
- **Email**: [vbumrania@gmail.com](mailto:vbumrania@gmail.com)
