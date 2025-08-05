export interface IQAirApiResponse {
  status: string;
  data: {
    city: string;
    state: string;
    country: string;
    location: {
      type: string;
      coordinates: [number, number];
    };
    current: {
      pollution: {
        ts: string;
        aqius: number;
        mainus: string;
        aqicn: number;
        maincn: string;
      };
      weather: {
        ts: string;
        tp: number;
        pr: number;
        hu: number;
        ws: number;
        wd: number;
        ic: string;
      };
    };
  };
}

export interface IQAirApiError {
  status: string;
  data: {
    message: string;
    code?: string;
  };
}

export interface IQAirApiRequest {
  city: string;
  state?: string;
  country: string;
  key: string;
}

export interface IQAirApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface IQAirPollutionData {
  ts: string;
  aqius: number;
  mainus: string;
  aqicn: number;
  maincn: string;
}

export interface IQAirWeatherData {
  ts: string;
  tp: number;
  pr: number;
  hu: number;
  ws: number;
  wd: number;
  ic: string;
}

export interface IQAirLocationData {
  type: string;
  coordinates: [number, number];
}

export interface IQAirCurrentData {
  pollution: IQAirPollutionData;
  weather: IQAirWeatherData;
}

export interface IQAirData {
  city: string;
  state: string;
  country: string;
  location: IQAirLocationData;
  current: IQAirCurrentData;
}
