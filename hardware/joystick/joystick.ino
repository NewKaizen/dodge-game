// Joystick serial do Dodge: UM Arduino por jogador, cada um na própria porta USB.
// O mesmo sketch serve para os dois: troque só JOGADOR antes de gravar (1 ou 2).
// Protocolo: docs/protocolo-serial.md
//
// Joystick -> jogo:  JOY <n> <x> <y>   (x, y de -100 a 100)   ·   BTN <n> A|B|C
// Jogo -> joystick:  PING · GAME · MENU · DISCONNECT   (estado; com ou sem "<n> " na frente)
//                    <n> VIDA <hpAtual> <hpMaximo>  ·  <n> BUZZER
// A porta já é exclusiva deste controle, então o número que vem na frente dos
// comandos é ignorado: quem decide qual jogador é qual porta é o jogo. O JOGADOR
// abaixo só vai nas mensagens JOY/BTN e aparece no OLED (o jogo pode trocar).

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ---------- QUAL JOGADOR (mude antes de gravar) ----------
const int JOGADOR = 1;

// PINOS
const int JOYSTICK_X_PIN = A0;
const int JOYSTICK_Y_PIN = A1;

const int BUTTON_A_PIN = 2;
const int BUTTON_B_PIN = 3;
const int BUTTON_PAUSE_PIN = 8;

const int LED_RED_PIN = 7;
const int LED_GREEN_PIN = A3;
const int LED_BLUE_PIN = A2;

const int BUZZER_PIN = 5;

const int OLED_WIDTH = 128;
const int OLED_HEIGHT = 32;
const int OLED_RESET = -1;
const uint8_t OLED_ADDRESS = 0x3C;

// CONFIGURAÇÕES
const unsigned long SERIAL_BAUD = 9600;
const unsigned long JOYSTICK_INTERVAL = 50;
const unsigned long DEBOUNCE_TIME = 40;
const unsigned long CONNECTION_TIMEOUT = 3000;
const unsigned long BLUE_BLINK_INTERVAL = 300;

const int DEADZONE = 60;
const bool RGB_COMMON_ANODE = false;

Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RESET);

// ESTADOS
enum ConsoleState { STATE_DISCONNECTED, STATE_CONNECTED, STATE_GAMEPLAY };
ConsoleState consoleState = STATE_DISCONNECTED;

unsigned long lastPing = 0;
unsigned long lastBlueBlink = 0;
unsigned long lastJoystickUpdate = 0;
bool blueBlinkState = false;
bool displayDisponivel = false;

// número mostrado e mandado no JOY/BTN (começa em JOGADOR; o jogo pode mandar "<n> JOGADOR")
int jogadorAtual = JOGADOR;

// JOYSTICK
int centerX = 512;
int centerY = 512;
int lastX = 0;
int lastY = 0;

// BOTÕES
bool lastButtonA = HIGH;
bool lastButtonB = HIGH;
bool lastButtonPause = HIGH;
unsigned long lastButtonATime = 0;
unsigned long lastButtonBTime = 0;
unsigned long lastButtonPauseTime = 0;

// VIDA
float vidaAtualPersonagem = 100.0f;
float vidaMaximaPersonagem = 100.0f;
int porcentagemVida = 100;

// SERIAL
String bufferUSB = "";

// ---------- LED RGB ----------
void escreverLED(int pin, bool ligado) {
  digitalWrite(pin, RGB_COMMON_ANODE ? (ligado ? LOW : HIGH) : (ligado ? HIGH : LOW));
}
void desligarLED() { escreverLED(LED_RED_PIN, false); escreverLED(LED_GREEN_PIN, false); escreverLED(LED_BLUE_PIN, false); }
void ledVermelho() { escreverLED(LED_RED_PIN, true); escreverLED(LED_GREEN_PIN, false); escreverLED(LED_BLUE_PIN, false); }
void ledVerde() { escreverLED(LED_RED_PIN, false); escreverLED(LED_GREEN_PIN, true); escreverLED(LED_BLUE_PIN, false); }
void ledAzul() { escreverLED(LED_RED_PIN, false); escreverLED(LED_GREEN_PIN, false); escreverLED(LED_BLUE_PIN, true); }

void atualizarLED() {
  switch (consoleState) {
    case STATE_DISCONNECTED: ledVermelho(); break;
    case STATE_CONNECTED: ledVerde(); break;
    case STATE_GAMEPLAY:
      if (millis() - lastBlueBlink >= BLUE_BLINK_INTERVAL) {
        lastBlueBlink = millis();
        blueBlinkState = !blueBlinkState;
        if (blueBlinkState) ledAzul(); else desligarLED();
      }
      break;
  }
}

// ---------- VIDA ----------
int calcularPorcentagemVida(float vidaAtual, float vidaMaxima) {
  if (isnan(vidaAtual) || isnan(vidaMaxima) || isinf(vidaAtual) || isinf(vidaMaxima) || vidaMaxima <= 0.0f || vidaAtual <= 0.0f) return 0;
  if (vidaAtual >= vidaMaxima) return 100;
  return constrain((int)((vidaAtual / vidaMaxima) * 100.0f + 0.5f), 0, 100);
}

bool converterValorHP(String texto, float &resultado) {
  texto.trim();
  if (texto.length() == 0) return false;
  bool encontrouDigito = false;
  bool encontrouPonto = false;
  for (unsigned int i = 0; i < texto.length(); i++) {
    char c = texto.charAt(i);
    if (c >= '0' && c <= '9') encontrouDigito = true;
    else if (c == '.' && !encontrouPonto) encontrouPonto = true;
    else return false;
  }
  if (!encontrouDigito) return false;
  resultado = texto.toFloat();
  return !isnan(resultado) && !isinf(resultado);
}

// "VIDA 150 200" (HP real) ou "VIDA 75" (porcentagem, formato antigo)
bool interpretarVida(String dados, float &vidaAtual, float &vidaMaxima, int &porcentagem) {
  dados.trim();
  if (dados.length() == 0) return false;
  int separador = dados.indexOf(' ');
  if (separador < 0) {
    float valor = 0.0f;
    if (!converterValorHP(dados, valor) || valor > 100.0f) return false;
    vidaAtual = valor;
    vidaMaxima = 100.0f;
    porcentagem = calcularPorcentagemVida(vidaAtual, vidaMaxima);
    return true;
  }
  String textoAtual = dados.substring(0, separador);
  String textoMaximo = dados.substring(separador + 1);
  textoAtual.trim();
  textoMaximo.trim();
  if (textoMaximo.indexOf(' ') >= 0) return false;
  float hpAtual = 0.0f;
  float hpMaximo = 0.0f;
  if (!converterValorHP(textoAtual, hpAtual) || !converterValorHP(textoMaximo, hpMaximo) || hpMaximo <= 0.0f) return false;
  vidaAtual = hpAtual;
  vidaMaxima = hpMaximo;
  porcentagem = calcularPorcentagemVida(vidaAtual, vidaMaxima);
  return true;
}

// ---------- DISPLAY OLED ----------
void atualizarDisplay() {
  if (!displayDisponivel) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  if (consoleState == STATE_DISCONNECTED) {
    display.setCursor(0, 0);
    display.print('P');
    display.print(jogadorAtual);
    display.setCursor(27, 7);
    display.print(F("SEM CONEXAO"));
    display.setCursor(21, 19);
    display.print(F("COM O SERVIDOR"));
    display.display();
    return;
  }

  display.setCursor(0, 0);
  display.print('P');
  display.print(jogadorAtual);
  display.print(F("  HP: "));
  display.print(vidaAtualPersonagem, 0);
  display.print('/');
  display.print(vidaMaximaPersonagem, 0);

  const int barraX = 0, barraY = 13, barraLargura = 128, barraAltura = 19;
  display.drawRect(barraX, barraY, barraLargura, barraAltura, SSD1306_WHITE);
  int larguraPreenchida = map(porcentagemVida, 0, 100, 0, barraLargura - 2);
  if (larguraPreenchida > 0) display.fillRect(barraX + 1, barraY + 1, larguraPreenchida, barraAltura - 2, SSD1306_WHITE);
  display.display();
}

void definirEstado(ConsoleState novoEstado) {
  if (consoleState == novoEstado) return;
  consoleState = novoEstado;
  atualizarDisplay();
}

void atualizarVida(float hpAtual, float hpMaximo, int porcentagem) {
  if (vidaAtualPersonagem == hpAtual && vidaMaximaPersonagem == hpMaximo && porcentagemVida == porcentagem) return;
  vidaAtualPersonagem = hpAtual;
  vidaMaximaPersonagem = hpMaximo;
  porcentagemVida = constrain(porcentagem, 0, 100);
  atualizarDisplay();
}

void ativarBuzzer() { tone(BUZZER_PIN, 1000, 250); }

// ---------- COMANDOS ----------
void processarEstadoJogo(const String &comando) {
  if (comando == "PING") {
    lastPing = millis();
    if (consoleState == STATE_DISCONNECTED) definirEstado(STATE_CONNECTED);
  } else if (comando == "GAME") {
    lastPing = millis();
    blueBlinkState = false;
    lastBlueBlink = millis();
    definirEstado(STATE_GAMEPLAY);
  } else if (comando == "MENU") {
    lastPing = millis();
    definirEstado(STATE_CONNECTED);
  } else if (comando == "DISCONNECT") {
    definirEstado(STATE_DISCONNECTED);
  }
}

void processarComando(String comando) {
  comando.trim();
  comando.toUpperCase();
  if (comando.length() == 0) return;

  // "<n> CMD": a porta é só deste controle, então o <n> não filtra nada
  String payload = comando;
  int separador = comando.indexOf(' ');
  if (separador > 0) {
    String primeiro = comando.substring(0, separador);
    bool numero = primeiro.length() <= 2;
    for (unsigned int i = 0; i < primeiro.length(); i++) numero = numero && isDigit(primeiro.charAt(i));
    if (numero) {
      payload = comando.substring(separador + 1);
      payload.trim();
      // "<n> JOGADOR": o jogo diz qual jogador esta porta é (P1, P2...)
      if (payload == "JOGADOR") {
        int n = primeiro.toInt();
        if (n >= 1 && n <= 9 && n != jogadorAtual) {
          jogadorAtual = n;
          atualizarDisplay();
        }
        return;
      }
    }
  }

  if (payload.startsWith("VIDA ")) {
    float hpAtual = 0.0f, hpMaximo = 0.0f;
    int porcentagem = 0;
    if (interpretarVida(payload.substring(5), hpAtual, hpMaximo, porcentagem)) atualizarVida(hpAtual, hpMaximo, porcentagem);
    return;
  }

  if (payload == "BUZZER" || payload == "BUZZER ATIVAR") {
    ativarBuzzer();
    return;
  }

  if (payload.startsWith("LED ")) {
    String cor = payload.substring(4);
    cor.trim();
    if (cor == "VERMELHO" || cor == "RED") ledVermelho();
    else if (cor == "VERDE" || cor == "GREEN") ledVerde();
    else if (cor == "AZUL" || cor == "BLUE") ledAzul();
    else if (cor == "DESLIGADO" || cor == "OFF") desligarLED();
    return;
  }

  processarEstadoJogo(payload);
}

void lerSerialUSB() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (bufferUSB.length() > 0) {
        processarComando(bufferUSB);
        bufferUSB = "";
      }
    } else if (bufferUSB.length() < 100) {
      bufferUSB += c;
    } else {
      bufferUSB = "";
    }
  }
}

// ---------- JOYSTICK ----------
int converterEixo(int valor, int centro) {
  int diferenca = valor - centro;
  if (abs(diferenca) <= DEADZONE) return 0;
  int resultado = diferenca > 0 ? map(diferenca, DEADZONE, 511, 0, 100) : map(diferenca, -511, -DEADZONE, -100, 0);
  return constrain(resultado, -100, 100);
}

void enviarJoy(int x, int y) {
  Serial.print(F("JOY "));
  Serial.print(jogadorAtual);
  Serial.print(' ');
  Serial.print(x);
  Serial.print(' ');
  Serial.println(y);
}

void atualizarJoystick() {
  int x = converterEixo(analogRead(JOYSTICK_X_PIN), centerX);
  int y = converterEixo(analogRead(JOYSTICK_Y_PIN), centerY);
  if (x != lastX || y != lastY) {
    enviarJoy(x, y);
    lastX = x;
    lastY = y;
  }
}

void enviarBotao(char botao) {
  Serial.print(F("BTN "));
  Serial.print(jogadorAtual);
  Serial.print(' ');
  Serial.println(botao);
}

void verificarBotoes() {
  unsigned long agora = millis();
  bool buttonA = digitalRead(BUTTON_A_PIN);
  bool buttonB = digitalRead(BUTTON_B_PIN);
  bool buttonPause = digitalRead(BUTTON_PAUSE_PIN);

  if (buttonA == LOW && lastButtonA == HIGH && agora - lastButtonATime >= DEBOUNCE_TIME) { enviarBotao('A'); lastButtonATime = agora; }
  if (buttonB == LOW && lastButtonB == HIGH && agora - lastButtonBTime >= DEBOUNCE_TIME) { enviarBotao('B'); lastButtonBTime = agora; }
  if (buttonPause == LOW && lastButtonPause == HIGH && agora - lastButtonPauseTime >= DEBOUNCE_TIME) { enviarBotao('C'); lastButtonPauseTime = agora; }

  lastButtonA = buttonA;
  lastButtonB = buttonB;
  lastButtonPause = buttonPause;
}

void calibrarJoystick() {
  long somaX = 0, somaY = 0;
  const int AMOSTRAS = 50;
  for (int i = 0; i < AMOSTRAS; i++) {
    somaX += analogRead(JOYSTICK_X_PIN);
    somaY += analogRead(JOYSTICK_Y_PIN);
    delay(10);
  }
  centerX = somaX / AMOSTRAS;
  centerY = somaY / AMOSTRAS;
}

void verificarConexao() {
  if (consoleState != STATE_DISCONNECTED && millis() - lastPing > CONNECTION_TIMEOUT) definirEstado(STATE_DISCONNECTED);
}

// ---------- SETUP / LOOP ----------
void setup() {
  Serial.begin(SERIAL_BAUD);

  pinMode(BUTTON_A_PIN, INPUT_PULLUP);
  pinMode(BUTTON_B_PIN, INPUT_PULLUP);
  pinMode(BUTTON_PAUSE_PIN, INPUT_PULLUP);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_BLUE_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);
  desligarLED();

  Wire.begin();
  displayDisponivel = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);

  calibrarJoystick();
  consoleState = STATE_DISCONNECTED;
  lastPing = 0;
  lastX = 0;
  lastY = 0;
  atualizarDisplay();

  enviarJoy(0, 0); // anuncia o controle (o jogo vê qual porta falou)
}

void loop() {
  lerSerialUSB();
  verificarConexao();
  if (millis() - lastJoystickUpdate >= JOYSTICK_INTERVAL) {
    lastJoystickUpdate = millis();
    atualizarJoystick();
  }
  verificarBotoes();
  atualizarLED();
}
