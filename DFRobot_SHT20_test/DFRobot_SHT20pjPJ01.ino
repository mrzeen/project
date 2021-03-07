#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#ifndef STASSID
#define STASSID "smile.2g"
#define STAPSK  "0855407362"
#include <Wire.h>
#include "DFRobot_SHT20.h"
DFRobot_SHT20    sht20;
#endif
int Relay = D2;
int pinstatus = 0;
const char* ssid = STASSID;
const char* password = STAPSK;
WiFiServer server(80);
void setup()
{
  pinMode(Relay, OUTPUT);
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, 0);
  Serial.println();
  Serial.println();
  Serial.print(F("Connecting to "));
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {delay(500);Serial.print(F("."));}
  Serial.println();
  Serial.println(F("WiFi connected"));
  server.begin();
  Serial.println(F("Server started"));
  Serial.println(WiFi.localIP());
   server.begin();
  Serial.println("SHT20 Example!");
  sht20.initSHT20();                                  // Init SHT20 Sensor
  delay(100);
  sht20.checkSHT20();                                 // Check SHT20 Sensor
}

void loop()
{
  int datastatus = digitalRead(Relay);  

if(datastatus ==0) {
                
    pinstatus = 1;
            
  }
  else if(datastatus ==1){
     
         pinstatus = 0;                   
  }    

  float humd = sht20.readHumidity();                  // Read Humidity
  float temp = sht20.readTemperature();               // Read Temperature
  Serial.print(" อุณหภูมิ:");
  Serial.print(temp, 1);
  Serial.print("C");
  Serial.print("ความชื้น:");
  Serial.print(humd, 1);
  Serial.print("%");
  Serial.println();
  delay(1000);
if(temp <=31) {              
   
   Serial.print(" อุณหภูมิ:");
  Serial.print(temp, 1);
  Serial.print("C");
  Serial.print("ความชื้น:");
  Serial.print(humd, 1);
  Serial.print("%");
  Serial.println();
    Serial.println("low");
    Serial.println("OPEN");
    Serial.println(pinstatus);
   digitalWrite(Relay, 0);
            
  }
  else if(temp >=29){
  Serial.print(" อุณหภูมิ:");
  Serial.print(temp, 1);
  Serial.print("C");
  Serial.print("ความชื้น:");
  Serial.print(humd, 1);
  Serial.print("%");
  Serial.println();
        Serial.print("%");
       Serial.print(" ");
   Serial.println("high");
     Serial.println("OFF");
     Serial.println(pinstatus);
   digitalWrite(Relay, 1);
                            
  }
  delay(1000); 
     HTTPClient http;
    float tempid = temp;
    float humdid = humd;
    int statusx = pinstatus ;
    String url = "http://18.216.151.18/test.php?tempid="+String(tempid)+"&humdid="+String(humdid)+"&statusx="+String(statusx);
    Serial.println(url);
    http.begin(url);
    int httpCode = http.GET();
    if(httpCode > 0){Serial.println("OK");} else{Serial.println("ERROR");}
    http.end();
     delay(5000);
    }
