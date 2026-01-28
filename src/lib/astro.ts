/**
 * 天文計算モジュール
 * 太陽と月の位置計算、軌跡生成、タイムゾーン検出などの機能を提供します
 */
import SunCalc from "suncalc";
import { DateTime } from "luxon";
import tzLookup from "tz-lookup";

/**
 * 軌跡上の1点を表すデータ型
 */
export type TrajPoint = {
  /** 時刻（Dateオブジェクト、UTCタイムスタンプを保持） */
  t: Date;
  /** 方位角（北を0として時計回り、ラジアン、0..2π） */
  azN: number;
  /** 高度角（地平線からの角度、ラジアン、-π/2..π/2） */
  alt: number;
  /** 月の照度（0..1、月のみ） */
  illum?: number;
};

/**
 * 都市情報を表すデータ型
 */
export type City = {
  /** 一意のID */
  id: string;
  /** 表示用ラベル（例: "Tokyo, Japan"） */
  label: string;
  /** 緯度（度） */
  lat: number;
  /** 経度（度） */
  lon: number;
  /** 表示色（CSS色文字列） */
  color: string;
};

/**
 * 緯度・経度からタイムゾーンを検出
 * @param lat - 緯度（度）
 * @param lon - 経度（度）
 * @returns IANAタイムゾーン名（例: "Asia/Tokyo"）
 */
export function cityTimezone(lat: number, lon: number): string {
  return tzLookup(lat, lon);
}

/**
 * SunCalcの方位角（南=0、西=正）を北基準の方位角（北=0、東=正）に変換
 * @param suncalcAzSouth0WestPlus - SunCalcの方位角（ラジアン）
 * @returns 北基準の方位角（ラジアン、0..2π）
 */
function toAzFromNorth(suncalcAzSouth0WestPlus: number): number {
  const twoPi = Math.PI * 2;
  const azN = (suncalcAzSouth0WestPlus + Math.PI) % twoPi;
  return azN < 0 ? azN + twoPi : azN;
}

/**
 * 指定された日付の太陽の軌跡を生成
 * 現地時間の1日分の軌跡を、指定された間隔で計算します
 * 
 * @param params - 計算パラメータ
 * @param params.lat - 緯度（度）
 * @param params.lon - 経度（度）
 * @param params.dateISO - 日付（YYYY-MM-DD形式）
 * @param params.stepMin - 計算間隔（分）
 * @returns 太陽の軌跡点の配列
 */
export function buildSunTrajectory(params: {
  lat: number;
  lon: number;
  dateISO: string;   // YYYY-MM-DD
  stepMin: number;
}): TrajPoint[] {
  const { lat, lon, dateISO, stepMin } = params;
  const tz = cityTimezone(lat, lon);

  // 現地時間の1日の開始時刻（00:00）から計算を開始
  const start = DateTime.fromISO(dateISO, { zone: tz }).startOf("day");
  const end = start.plus({ days: 1 });

  const pts: TrajPoint[] = [];
  // 指定された間隔で1日分の軌跡を計算
  for (let dt = start; dt < end; dt = dt.plus({ minutes: stepMin })) {
    // DateTimeをJavaScriptのDateオブジェクトに変換（UTCタイムスタンプを保持）
    const jsDate = dt.toJSDate();
    // SunCalcで太陽の位置を計算（DateオブジェクトはUTCとして解釈される）
    const pos = SunCalc.getPosition(jsDate, lat, lon);
    
    // デバッグ出力（最初の数回と3時付近）
    if (pts.length < 3 || (dt.hour === 3 && dt.minute === 0)) {
      console.log('[buildSunTrajectory]', {
        dtISO: dt.toISO(),
        dtHour: dt.hour,
        dtMinute: dt.minute,
        dtZone: dt.zoneName,
        jsDateISO: jsDate.toISOString(),
        jsDateLocal: `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')} ${String(jsDate.getHours()).padStart(2, '0')}:${String(jsDate.getMinutes()).padStart(2, '0')}`,
        alt: pos.altitude * 180 / Math.PI,
        tz
      });
    }
    
    pts.push({
      t: jsDate,
      azN: toAzFromNorth(pos.azimuth),
      alt: pos.altitude,
    });
  }
  return pts;
}

/**
 * 指定された日付の月の軌跡を生成
 * 現地時間の1日分の軌跡を、指定された間隔で計算します
 * 
 * @param params - 計算パラメータ
 * @param params.lat - 緯度（度）
 * @param params.lon - 経度（度）
 * @param params.dateISO - 日付（YYYY-MM-DD形式）
 * @param params.stepMin - 計算間隔（分）
 * @returns 月の軌跡点の配列（照度情報を含む）
 */
export function buildMoonTrajectory(params: {
  lat: number;
  lon: number;
  dateISO: string;
  stepMin: number;
}): TrajPoint[] {
  const { lat, lon, dateISO, stepMin } = params;
  const tz = cityTimezone(lat, lon);

  // 現地時間の1日の開始時刻（00:00）から計算を開始
  const start = DateTime.fromISO(dateISO, { zone: tz }).startOf("day");
  const end = start.plus({ days: 1 });

  const pts: TrajPoint[] = [];
  // 指定された間隔で1日分の軌跡を計算
  for (let dt = start; dt < end; dt = dt.plus({ minutes: stepMin })) {
    // DateTimeをJavaScriptのDateオブジェクトに変換（UTCタイムスタンプを保持）
    const jsDate = dt.toJSDate();
    // SunCalcで月の位置と照度を計算
    const pos = SunCalc.getMoonPosition(jsDate, lat, lon);
    const ill = SunCalc.getMoonIllumination(jsDate);
    
    // デバッグ出力（最初の数回のみ）
    if (pts.length < 3) {
      console.log('[buildMoonTrajectory]', {
        dtISO: dt.toISO(),
        dtHour: dt.hour,
        dtMinute: dt.minute,
        jsDateISO: jsDate.toISOString(),
        jsDateLocal: `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')} ${String(jsDate.getHours()).padStart(2, '0')}:${String(jsDate.getMinutes()).padStart(2, '0')}`,
        alt: pos.altitude * 180 / Math.PI
      });
    }
    
    pts.push({
      t: jsDate,
      azN: toAzFromNorth(pos.azimuth),
      alt: pos.altitude,
      illum: ill.fraction,
    });
  }
  return pts;
}
