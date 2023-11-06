import { API } from "homebridge";
import { ACCESSORY_NAME } from "./settings";
import SunSimulator from "./sun-simulator";

export = (api: API) => {
  api.registerAccessory(ACCESSORY_NAME, SunSimulator);
};
