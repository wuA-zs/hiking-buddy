/**
 * Maps service — 高德地图 API for reverse geocoding and POI search
 * 无 Key 时降级返回坐标
 */

import { getAmapKey } from "../lib/config";

export interface Address {
  formatted: string;
  province: string;
  city: string;
  district: string;
  street?: string;
}

export interface POI {
  id: string;
  name: string;
  type: string;
  distance: number;
  direction: string;
  address: string;
  latitude: number;
  longitude: number;
}

export async function reverseGeocode(lat: number, lng: number): Promise<Address> {
  const key = await getAmapKey();
  if (!key) {
    return { formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, province: "", city: "", district: "" };
  }

  try {
    const resp = await fetch(
      `https://restapi.amap.com/v3/geocode/regeo?key=${key}&location=${lng},${lat}&extensions=base`,
    );
    const data = await resp.json();
    if (data.status === "1" && data.regeocode) {
      const addr = data.regeocode.addressComponent;
      return {
        formatted: data.regeocode.formatted_address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        province: addr.province ?? "",
        city: addr.city ?? "",
        district: addr.district ?? "",
        street: addr.streetNumber?.street ?? undefined,
      };
    }
  } catch {
    // fallback
  }

  return { formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, province: "", city: "", district: "" };
}

export async function searchNearby(
  lat: number,
  lng: number,
  keyword?: string,
  radius = 1000,
): Promise<POI[]> {
  const key = await getAmapKey();
  if (!key) return [];

  try {
    const types = keyword
      ? `&keywords=${encodeURIComponent(keyword)}`
      : "&types=110100|110200|110300|120000|130100|140100|141200";
    const resp = await fetch(
      `https://restapi.amap.com/v3/place/around?key=${key}&location=${lng},${lat}&radius=${radius}${types}&offset=10&sortrule=distance`,
    );
    const data = await resp.json();
    if (data.status === "1" && data.pois) {
      return data.pois.map((poi: { name: string; type?: string; distance?: string | number; location?: string; pname?: string; address?: string }) => {
        const [poiLng, poiLat] = (poi.location ?? "0,0").split(",").map(Number);
        const dist = poi.distance ? Number(poi.distance) : 0;
        return {
          id: `${poi.name}-${poi.location ?? "0,0"}`,
          name: poi.name,
          type: poi.type ?? "",
          distance: dist,
          direction: getDirection(lat, lng, poiLat, poiLng),
          address: poi.address ?? poi.pname ?? "",
          latitude: poiLat,
          longitude: poiLng,
        };
      });
    }
  } catch {
    // Return empty
  }

  return [];
}

function getDirection(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const dLat = toLat - fromLat;
  const dLng = toLng - fromLng;
  const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  const dirs = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  const index = Math.round(((angle + 360) % 360) / 45) % 8;
  return `${dirs[index]}方`;
}
