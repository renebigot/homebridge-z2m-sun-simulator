import {
  API,
  AccessoryConfig,
  AccessoryPlugin,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

import { connect } from "mqtt";

class SunSimulator implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;
  private readonly mqttServer: string;
  private readonly topic: string;
  private readonly duration: number;
  private readonly isSunrise: boolean;

  private readonly lightbulbService: Service;
  private readonly informationService: Service;
  private hap: HAP;

  private mqttClient;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.topic = config.topic;
    this.duration = config.duration;
    this.isSunrise = config.isSunrise;
    this.hap = api.hap;

    let url = "mqtt://";
    if (config.mqtt.user) {
      url += config.mqtt.user;
      if (config.mqtt.password) {
        url += `:${config.mqtt.password}`;
      }
      url += "@";
    }
    url += `${config.mqtt.address}:${config.mqtt.port}`;

    log.info(`Connecting to ${url.replace(/\/\/.*?:.*?@/, "//")}`);
    this.mqttClient = connect(url);

    this.mqttClient.on("error", (error) => {
      log.error("MQTT error", error);
    });

    this.mqttClient.on("connect", () => {
      log.info("Connected to MQTT server");
    });

    this.lightbulbService = new this.hap.Service.Lightbulb(this.name);

    this.lightbulbService.getCharacteristic(this.hap.Characteristic.On)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.setLightState(value as boolean);
        callback();
      });

    this.informationService = new this.hap.Service.AccessoryInformation()
      .setCharacteristic(this.hap.Characteristic.Manufacturer, "Custom Manufacturer")
      .setCharacteristic(this.hap.Characteristic.Model, "SunriseSimulator")
      .setCharacteristic(this.hap.Characteristic.SerialNumber, "SS-01");


    log.info("SunSimulator finished initializing!");
  }

  setLightState(value: boolean) {
    let brightness = value ? (this.isSunrise ? 0 : 100) : (this.isSunrise ? 100 : 0);
    const step = (this.isSunrise ? 1 : -1) * (100 / (this.duration * 60));

    const interval = setInterval(() => {
      brightness += step;

      if ((step > 0 && brightness >= 100) || (step < 0 && brightness <= 0)) {
        brightness = this.isSunrise ? 100 : 0;
        clearInterval(interval);
        // Once the simulation is complete, you might want to turn off the light if it is a sunset simulation
        if (!this.isSunrise) {
          this.lightbulbService.getCharacteristic(this.hap.Characteristic.On).updateValue(false);
        }
      }

      // Ensure the brightness value is within the 0-100 range
      brightness = Math.max(0, Math.min(100, brightness));

      // Publish the brightness value to the MQTT topic
      if (brightness === 0) {
        this.mqttClient.publish(this.topic, JSON.stringify({ brightness }));
      } else {
        this.mqttClient.publish(this.topic, JSON.stringify({ state: "OFF", brightness }));
      }
    }, 1000);
  }

  getServices(): Service[] {
    return [this.informationService, this.lightbulbService];
  }
}

export default SunSimulator;
