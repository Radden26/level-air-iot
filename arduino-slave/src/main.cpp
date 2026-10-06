/*
 * MONITORING LEVEL AIR 1 TANGKI - ARDUINO NANO SLAVE ID 1
 * Hardware Fix: 4x Probe -> BC547 -> PC817 -> D4-D7 (INPUT_PULLUP)
 *   D4 = 25% Merah, D5 = 50% Kuning, D6 = 75% Hijau, D7 = 100% Biru (LOW = ada air)
 *   D8-D11 LED indikator lokal via R 330 Ohm
 *   MAX485: DE/RE -> D2, RO -> D0 (RX), DI -> D1 (TX), A-A , B-B master, GND-GND, 120 ohm terminasi
 * Register Map (Modbus RTU Slave ID 1, 9600 8N1):
 *   Holding Register 40001 (addr 0) : level_persen  (0,25,50,75,100)
 *   Holding Register 40002 (addr 1) : bitmask       bit0=25% bit1=50% bit2=75% bit3=100%
 *   Holding Register 40003 (addr 2) : error_code    0=OK, 1=Probe fault (non-sekuensial)
 *   Coil 00001           (addr 0) : status pompa dummy (read/write)
 *
 * Cara Ganti SLAVE_ID: ubah #define SLAVE_ID di bawah lalu Re-Upload via PlatformIO.
 *   Jika tambah tangki baru: duplikat hardware ini, ganti SLAVE_ID=2,3 dst, Re-Flash.
 */

#include <Arduino.h>
#include <ModbusRTU.h>

// ===================== KONFIGURASI - GANTI DISINI JIKA TAMBAH SLAVE ============
#define SLAVE_ID 1  // << GANTI ID DI SINI (1..247) LALU REFLASH

// ===================== PIN DEFINISI ====================
#define PIN_PROBE_25  4  // D4 PC817 output 25% Merah
#define PIN_PROBE_50  5  // D5 50% Kuning
#define PIN_PROBE_75  6  // D6 75% Hijau
#define PIN_PROBE_100 7  // D7 100% Biru

#define PIN_LED_25    8  // D8 LED Merah
#define PIN_LED_50    9  // D9 LED Kuning
#define PIN_LED_75    10 // D10 LED Hijau
#define PIN_LED_100   11 // D11 LED Biru

#define PIN_DE_RE     2  // D2 MAX485 DE & RE (HIGH=TX, LOW=RX)

// ===================== MODBUS ==========================
ModbusRTU mb;

// Holding registers shadow (Modbus address 0..2)
uint16_t hreg_level = 0;
uint16_t hreg_bitmask = 0;
uint16_t hreg_error = 0;
bool coil_pompa = false;

unsigned long lastDebug = 0;
unsigned long lastRead  = 0;

// Callback dummy untuk coil 0 (pompa) agar bisa read/write dari master
bool cbWriteCoil(Modbus::ResultCode event, uint16_t address, void* data) {
  // event = query type, data pointer not used
  (void)event;
  (void)address;
  (void)data;
  return true;
}

void setup() {
  // Serial hardware D0/D1 untuk Modbus RTU 9600 8N1
  // CATATAN: Serial juga dipakai untuk debug print. Jika debug mengganggu Modbus,
  //          comment bagian Serial.print debug di loop() atau pakai SoftwareSerial.
  Serial.begin(9600);
  while (!Serial) { }

  pinMode(PIN_PROBE_25, INPUT_PULLUP);
  pinMode(PIN_PROBE_50, INPUT_PULLUP);
  pinMode(PIN_PROBE_75, INPUT_PULLUP);
  pinMode(PIN_PROBE_100, INPUT_PULLUP);

  pinMode(PIN_LED_25, OUTPUT);
  pinMode(PIN_LED_50, OUTPUT);
  pinMode(PIN_LED_75, OUTPUT);
  pinMode(PIN_LED_100, OUTPUT);

  // Matikan semua LED awal
  digitalWrite(PIN_LED_25, LOW);
  digitalWrite(PIN_LED_50, LOW);
  digitalWrite(PIN_LED_75, LOW);
  digitalWrite(PIN_LED_100, LOW);

  // Modbus slave init
  mb.begin(&Serial, PIN_DE_RE);
  mb.slave(SLAVE_ID);

  // Daftarkan 3 Holding Register (40001-40003) -> address 0,1,2
  mb.addHreg(0, 0); // level_persen
  mb.addHreg(1, 0); // bitmask
  mb.addHreg(2, 0); // error_code
  // 1 Coil (00001) -> address 0
  mb.addCoil(0, false);
  // Coil dan Hreg callback write optional
  mb.onSetCoil(0, [](TRegister* reg, uint16_t val) -> uint16_t {
    coil_pompa = val ? true : false;
    return val;
  });

  // Info boot (akan terlihat di Serial Monitor sebelum master polling)
  delay(500);
  Serial.println(F(""));
  Serial.println(F("=========================================="));
  Serial.print(F("[SLAVE "));
  Serial.print(SLAVE_ID);
  Serial.println(F("] BOOT OK - Monitoring Level Air 1 Tangki"));
  Serial.println(F("Probe: D4=25% D5=50% D6=75% D7=100% (LOW=ada air)"));
  Serial.println(F("LED  : D8-D11 | MAX485 DE/RE=D2 RO=D0 DI=D1 @9600 8N1"));
  Serial.println(F("Reg  : 40001=level% 40002=bitmask 40003=error Coil:00001=pompa"));
  Serial.println(F("=========================================="));
}

void loop() {
  // Task Modbus (wajib dipanggil sesering mungkin, non-blocking)
  mb.task();
  yield();

  // Baca probe tiap 100ms (debounce sederhana)
  if (millis() - lastRead >= 100) {
    lastRead = millis();

    // LOW = ada air (karena optocoupler phototransistor pull-up ke 5V)
    bool p25  = (digitalRead(PIN_PROBE_25) == LOW);
    bool p50  = (digitalRead(PIN_PROBE_50) == LOW);
    bool p75  = (digitalRead(PIN_PROBE_75) == LOW);
    bool p100 = (digitalRead(PIN_PROBE_100) == LOW);

    // LED indikator lokal (nyala jika ada air)
    digitalWrite(PIN_LED_25, p25  ? HIGH : LOW);
    digitalWrite(PIN_LED_50, p50  ? HIGH : LOW);
    digitalWrite(PIN_LED_75, p75  ? HIGH : LOW);
    digitalWrite(PIN_LED_100,p100 ? HIGH : LOW);

    // Bitmask bit0=25% bit1=50% bit2=75% bit3=100%
    uint16_t bitmask = 0;
    if (p25)  bitmask |= (1 << 0);
    if (p50)  bitmask |= (1 << 1);
    if (p75)  bitmask |= (1 << 2);
    if (p100) bitmask |= (1 << 3);

    // Hitung level_persen berdasar probe tertinggi yang aktif
    // Sekuensial normal: air naik dari bawah. Jika 100% aktif maka harus 25-75 aktif juga.
    uint16_t level_persen = 0;
    if (p100) level_persen = 100;
    else if (p75) level_persen = 75;
    else if (p50) level_persen = 50;
    else if (p25) level_persen = 25;
    else level_persen = 0;

    // Error detection: probe non-sekuensial (mis: 75% ON tapi 25% OFF) -> kemungkinan probe kotor / putus
    uint16_t error_code = 0;
    // Valid patterns: 0b0000, 0b0001, 0b0011, 0b0111, 0b1111
    if (bitmask != 0x00 && bitmask != 0x01 && bitmask != 0x03 && bitmask != 0x07 && bitmask != 0x0F) {
      error_code = 1; // Probe fault
      // Tetap tampilkan level berdasar tertinggi, tapi flag error
    }

    // Update shadow variables & Modbus registers (hanya jika berubah untuk hemat write)
    hreg_level   = level_persen;
    hreg_bitmask = bitmask;
    hreg_error   = error_code;

    mb.Hreg(0, hreg_level);
    mb.Hreg(1, hreg_bitmask);
    mb.Hreg(2, hreg_error);
    // Coil dipertahankan sesuai nilai terakhir (dummy pompa)
    mb.Coil(0, coil_pompa);

    // Debug serial tiap 1 detik (format: [SLAVE 1] 75% | 0111 / bitmask bin)
    if (millis() - lastDebug >= 1000) {
      lastDebug = millis();
      // Hati-hati: print di Serial yang sama dengan Modbus bisa mengganggu timing.
      // Pada baud 9600, interval 1 detik aman selama master polling tiap 2 detik.
      Serial.print(F("[SLAVE "));
      Serial.print(SLAVE_ID);
      Serial.print(F("] "));
      Serial.print(level_persen);
      Serial.print(F("% | "));
      // Cetak bitmask sebagai 4-bit binary string MSB->LSB (b3 b2 b1 b0)
      for (int i = 3; i >= 0; i--) {
        Serial.print((bitmask >> i) & 0x01);
      }
      Serial.print(F(" | err:"));
      Serial.print(error_code);
      Serial.print(F(" | coil:"));
      Serial.println(coil_pompa ? F("ON") : F("OFF"));
    }
  }
}
