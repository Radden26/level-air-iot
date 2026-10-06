/*
 * MONITORING LEVEL AIR 1 TANGKI - ESP32 MASTER (Modbus RTU Master -> Firebase)
 * Hardware: ESP32 DevKit V1 + MAX485: DE/RE->GPIO4, RO->GPIO16 (RX2), DI->GPIO17 (TX2)
 *   Baud 9600 8N1, terminasi 120 ohm di kedua ujung, A-A B-B GND-GND
 *
 * Cara Ganti SLAVE_ID: ubah #define POLL_SLAVE_ID di bawah lalu Re-Upload.
 *   Firmware slave dan master harus matching ID, baud 9600.
 */

#include <Arduino.h>
#include <ModbusMaster.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <ArduinoJson.h>

// ===================== KONFIGURASI - GANTI DISINI JIKA TAMBAH SLAVE ============
#define POLL_SLAVE_ID 1  // << GANTI ID POLLING DISINI LALU REFLASH

// ===================== PIN MAX485 ====================
#define PIN_DE_RE  4     // GPIO4 DE/RE MAX485
#define PIN_RO     16    // GPIO16 RX2 ESP32 -> RO MAX485
#define PIN_DI     17    // GPIO17 TX2 ESP32 -> DI MAX485

// ===================== MODBUS TIMING =================
#define POLL_INTERVAL_MS 2000
#define MODBUS_TIMEOUT_MS 500
#define MODBUS_RETRY 3
#define OFFLINE_THRESHOLD 5 // gagal 5x berturut -> online:false

// ===================== FIREBASE CONFIG - GANTI SESUAI PROJECT ANDA ===========
// Cara isi: lihat dashboard/.env.example atau Firebase Console > Project Settings
#define WIFI_AP_NAME "LevelAir-AP"  // SSID AP saat WiFiManager belum konek
#define WIFI_AP_PASS ""              // kosong = open AP, atau isi password

#define API_KEY "ISI_API_KEY_ANDA_DISINI"
#define DATABASE_URL "https://NAMA_PROJECT_ANDA.firebaseio.com"
#define USER_EMAIL "ISI_EMAIL_USER_Firebase_Auth"  // atau kosong jika pakai Database Secret
#define USER_PASSWORD "ISI_PASSWORD_USER"

// Jika pakai Realtime Database tanpa Auth (test mode), kosongkan email/pass dan isi DATABASE_SECRET
#define DATABASE_SECRET "" // legacy token, kosongkan jika pakai auth email/pass

// Path Firebase
#define FB_PATH_REALTIME "/tanks/tangki1/realtime"
#define FB_PATH_HISTORY  "/tanks/tangki1/history"

// ===================== GLOBAL ==========================
ModbusMaster node;
HardwareSerial modbusSerial(2); // Serial2 = GPIO16/17

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool firebaseReady = false;
bool signupOK = false;

unsigned long lastPoll = 0;
unsigned long lastHistoryPush = 0;
uint8_t failCount = 0;
uint32_t pollCounter = 0;

// Callback Modbus untuk toggle DE/RE RS485
void preTransmission() {
  digitalWrite(PIN_DE_RE, HIGH); // TX mode
  delayMicroseconds(50);
}
void postTransmission() {
  delayMicroseconds(500); // guard time untuk transmisi selesai @9600
  digitalWrite(PIN_DE_RE, LOW); // RX mode
}

void setupFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;

  if (strlen(DATABASE_SECRET) > 0) {
    // Auth via legacy secret (untuk Realtime DB test mode lama)
    config.signer.tokens.legacy_token = DATABASE_SECRET;
  } else if (strlen(USER_EMAIL) > 0) {
    auth.user.email = USER_EMAIL;
    auth.user.password = USER_PASSWORD;
  } else {
    Serial.println(F("[FIREBASE] WARNING: Email/Pass kosong & Secret kosong - anonim mode"));
    // Anonymous signup jika diaktifkan di Firebase Auth
    if (Firebase.signUp(&config, &auth, "", "")) {
      signupOK = true;
      Serial.println(F("[FIREBASE] Anonymous signup OK"));
    }
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);

  // Timeout & retry Firebase
  config.timeout.rtdbKeepAlive = 45;
  config.timeout.rtdbStreamError = 5;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println(F("\n=========================================="));
  Serial.print(F("[MASTER] BOOT - Polling SLAVE ID "));
  Serial.println(POLL_SLAVE_ID);
  Serial.println(F("MAX485: DE/RE=GPIO4 RO=GPIO16 DI=GPIO17 @9600 8N1"));
  Serial.println(F("=========================================="));

  pinMode(PIN_DE_RE, OUTPUT);
  digitalWrite(PIN_DE_RE, LOW); // default RX

  // Serial2 untuk Modbus RS485 9600 8N1
  modbusSerial.begin(9600, SERIAL_8N1, PIN_RO, PIN_DI);

  node.begin(POLL_SLAVE_ID, modbusSerial);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);
  // ModbusMaster timeout idle - kita handle di loop dengan millis

  // === WiFiManager ===
  WiFiManager wm;
  // wm.resetSettings(); // uncomment untuk force reset wifi
  wm.setConnectTimeout(20);
  wm.setConfigPortalTimeout(180); // 3 menit portal
  wm.setBreakAfterConfig(true);

  bool res = wm.autoConnect(WIFI_AP_NAME, WIFI_AP_PASS);
  if (!res) {
    Serial.println(F("[WIFI] Gagal konek & timeout portal -> restart"));
    delay(3000);
    ESP.restart();
  } else {
    Serial.print(F("[WIFI] Terhubung ke: "));
    Serial.println(WiFi.SSID());
    Serial.print(F("[WIFI] IP: "));
    Serial.println(WiFi.localIP());
  }

  // NTP time untuk timestamp history (optional, bisa pakai millis jika offline)
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print(F("[NTP] Sync time"));
  int ntpRetry = 0;
  while (time(nullptr) < 100000 && ntpRetry < 10) {
    delay(500);
    Serial.print(F("."));
    ntpRetry++;
  }
  Serial.println();
  time_t now = time(nullptr);
  Serial.print(F("[NTP] Time: "));
  Serial.println(ctime(&now));

  // Firebase init
  setupFirebase();
}

void pushToFirebase(uint16_t level_persen, uint16_t bitmask, uint16_t error_code, uint32_t latency_ms) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[FIREBASE] Skip - WiFi tidak konek"));
    return;
  }
  if (!Firebase.ready()) {
    Serial.println(F("[FIREBASE] Not ready, skip"));
    return;
  }

  // Dapatkan timestamp epoch (NTP) atau fallback millis()
  time_t now = time(nullptr);
  long timestamp = (now > 100000) ? (long)now : (long)(millis() / 1000);

  FirebaseJson json;
  json.set("level_persen", level_persen);
  json.set("bitmask", bitmask);
  // dekomposisi bitmask ke 4 level bool untuk kemudahan dashboard
  json.set("levels/25", (bool)(bitmask & 0x01));
  json.set("levels/50", (bool)(bitmask & 0x02));
  json.set("levels/75", (bool)(bitmask & 0x04));
  json.set("levels/100", (bool)(bitmask & 0x08));
  json.set("error_code", error_code);
  json.set("online", true);
  json.set("latency_ms", latency_ms);
  json.set("last_update", timestamp);
  json.set("last_update_millis", (int)millis());
  json.set("slave_id", POLL_SLAVE_ID);
  json.set("rssi", WiFi.RSSI());
  json.set("ip", WiFi.localIP().toString());

  // Label level text
  String label = "KOSONG";
  if (level_persen >= 100) label = "PENUH";
  else if (level_persen >= 75) label = "TINGGI";
  else if (level_persen >= 50) label = "SEDANG";
  else if (level_persen >= 25) label = "RENDAH";
  json.set("label", label);

  // Kirim realtime (overwrite)
  if (Firebase.RTDB.setJSON(&fbdo, FB_PATH_REALTIME, &json)) {
    Serial.println(F("[FIREBASE] Realtime OK"));
  } else {
    Serial.print(F("[FIREBASE] Realtime FAIL: "));
    Serial.println(fbdo.errorReason());
  }

  // Push history tiap 60 detik
  if (millis() - lastHistoryPush >= 60000) {
    lastHistoryPush = millis();
    FirebaseJson hist;
    hist.set("level_persen", level_persen);
    hist.set("bitmask", bitmask);
    hist.set("error_code", error_code);
    hist.set("label", label);
    hist.set("timestamp", timestamp);

    String histPath = String(FB_PATH_HISTORY) + "/" + String(timestamp);
    if (Firebase.RTDB.setJSON(&fbdo, histPath.c_str(), &hist)) {
      Serial.print(F("[FIREBASE] History pushed @"));
      Serial.println(timestamp);
    } else {
      Serial.print(F("[FIREBASE] History FAIL: "));
      Serial.println(fbdo.errorReason());
    }
  }
}

void pushOffline() {
  if (WiFi.status() != WL_CONNECTED || !Firebase.ready()) return;
  time_t now = time(nullptr);
  long timestamp = (now > 100000) ? (long)now : (long)(millis() / 1000);

  FirebaseJson json;
  json.set("online", false);
  json.set("last_update", timestamp);
  json.set("last_update_millis", (int)millis());
  json.set("slave_id", POLL_SLAVE_ID);
  json.set("failCount", failCount);

  if (Firebase.RTDB.updateNode(&fbdo, FB_PATH_REALTIME, &json)) {
    Serial.println(F("[FIREBASE] Offline status sent"));
  } else {
    Serial.print(F("[FIREBASE] Offline send FAIL: "));
    Serial.println(fbdo.errorReason());
  }
}

void loop() {
  // Polling Modbus tiap 2 detik
  if (millis() - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = millis();
    pollCounter++;

    uint8_t result = 0xFF;
    uint16_t level_persen = 0, bitmask = 0, error_code = 0;
    uint32_t startMs = millis();
    bool success = false;

    // Retry 3x dengan timeout 500ms per attempt (ModbusMaster default ~1000ms, kita override dengan delay)
    for (int attempt = 0; attempt < MODBUS_RETRY; attempt++) {
      // ModbusMaster::readHoldingRegisters tidak punya timeout param langsung,
      // tapi kita bisa set node idle timeout via modbusSerial timeout
      modbusSerial.setTimeout(MODBUS_TIMEOUT_MS);
      result = node.readHoldingRegisters(0, 3); // addr 0 = 40001, count 3
      if (result == node.ku8MBSuccess) {
        level_persen = node.getResponseBuffer(0);
        bitmask      = node.getResponseBuffer(1);
        error_code   = node.getResponseBuffer(2);
        success = true;
        break;
      } else {
        Serial.print(F("[MODBUS] Attempt "));
        Serial.print(attempt + 1);
        Serial.print(F(" fail, err=0x"));
        Serial.println(result, HEX);
        delay(100); // jeda antar retry
      }
    }

    uint32_t latency = millis() - startMs;

    if (success) {
      failCount = 0;
      // Validasi level_persen range
      if (level_persen > 100) level_persen = 100;

      Serial.print(F("Master polling ID "));
      Serial.print(POLL_SLAVE_ID);
      Serial.print(F(" -> "));
      Serial.print(level_persen);
      Serial.print(F("% | bitmask:"));
      for (int i = 3; i >= 0; i--) Serial.print((bitmask >> i) & 1);
      Serial.print(F(" | err:"));
      Serial.print(error_code);
      Serial.print(F(" | "));
      Serial.print(latency);
      Serial.println(F("ms OK"));

      pushToFirebase(level_persen, bitmask, error_code, latency);

    } else {
      failCount++;
      Serial.print(F("Master polling ID "));
      Serial.print(POLL_SLAVE_ID);
      Serial.print(F(" -> TIMEOUT/GAGAL (failCount="));
      Serial.print(failCount);
      Serial.println(F(")"));

      if (failCount >= OFFLINE_THRESHOLD) {
        Serial.println(F("[STATUS] 5x gagal berturut -> kirim online:false"));
        pushOffline();
        // Hindari spam offline setiap poll; reset failCount agar hanya kirim sekali per 5 gagal?
        // Biarkan tetap count, tapi pushOffline hanya saat >= threshold dan tiap poll akan update timestamp offline
      }
    }
  }

  // Firebase keepalive & WiFiManager loop
  delay(10);
  yield();
}
