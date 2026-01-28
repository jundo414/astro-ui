/**
 * 地理情報モジュール
 * 都市検索機能を提供します
 */

/**
 * 都市検索結果を表すデータ型
 */
export type CityHit = {
  /** 都市名 */
  name: string;
  /** 国名（オプション） */
  country?: string;
  /** 州・都道府県名（オプション） */
  admin1?: string;
  /** 緯度（度） */
  latitude: number;
  /** 経度（度） */
  longitude: number;
};

/**
 * Open-Meteo Geocoding APIを使用して都市を検索
 * @param q - 検索クエリ（都市名）
 * @returns 検索結果の配列（最大8件）
 */
export async function searchCity(q: string): Promise<CityHit[]> {
  // 空のクエリの場合は空配列を返す
  if (!q.trim()) return [];
  
  // Open-Meteo Geocoding APIにリクエスト
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "ja");
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const results = (json?.results ?? []) as any[];

  // APIレスポンスをCityHit形式に変換
  return results.map((r) => ({
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}
