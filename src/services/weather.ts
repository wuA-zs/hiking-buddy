/**
 * Weather service — Open-Meteo API (free, no key required)
 */

export interface Weather {
  temp: number;
  feelsLike: number;
  description: string;
  humidity: number;
  windSpeed: number;
  windDir: string;
  forecast: string;
}

export async function getWeather(lat: number, lng: number): Promise<Weather> {
  try {
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`,
    );
    const data = await resp.json();

    const current = data.current;
    const temp = Math.round(current.temperature_2m);
    const feelsLike = Math.round(current.apparent_temperature);
    const humidity = current.relative_humidity_2m;
    const windSpeed = Math.round(current.wind_speed_10m * 10) / 10;
    const windDir = degreesToDirection(current.wind_direction_10m);
    const description = weatherCodeToDescription(current.weather_code);

    const daily = data.daily;
    const forecast = daily
      ? `今日 ${Math.round(daily.temperature_2m_min[0])}°C ~ ${Math.round(daily.temperature_2m_max[0])}°C`
      : "";

    return { temp, feelsLike, description, humidity, windSpeed, windDir, forecast };
  } catch {
    return {
      temp: 0,
      feelsLike: 0,
      description: "无法获取",
      humidity: 0,
      windSpeed: 0,
      windDir: "",
      forecast: "无法获取",
    };
  }
}

function degreesToDirection(deg: number): string {
  const dirs = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  return dirs[Math.round(deg / 45) % 8];
}

function weatherCodeToDescription(code: number): string {
  const map: Record<number, string> = {
    0: "晴",
    1: "大部晴",
    2: "多云",
    3: "阴",
    45: "雾",
    48: "冻雾",
    51: "小毛毛雨",
    53: "毛毛雨",
    55: "大毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "雪粒",
    80: "阵雨",
    81: "中阵雨",
    82: "大阵雨",
    95: "雷暴",
    96: "冰雹雷暴",
    99: "大冰雹雷暴",
  };
  return map[code] ?? "未知";
}
