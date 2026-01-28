/**
 * メインアプリケーションコンポーネント
 * 太陽と月の軌跡を3Dで可視化するアプリケーションのルートコンポーネント
 */
import { useMemo, useState } from "react";
import { Sidebar } from "./ui/Sidebar";
import { Scene3D, type CityTraj } from "./three/Scene3D";
import { buildMoonTrajectory, buildSunTrajectory, type City } from "./lib/astro";
import type { CityHit } from "./lib/geo";

/** 各都市に割り当てられる色（最大3都市まで対応） */
const COLORS = ["#ff8a3d", "#35d07f", "#7c6cff"];

/**
 * 都市検索結果をCityオブジェクトに変換
 * @param hit - 都市検索結果
 * @param idx - スロットのインデックス（色の割り当てに使用）
 * @returns Cityオブジェクト
 */
function toCity(hit: CityHit, idx: number): City {
  return {
    id: `${hit.name}-${hit.latitude}-${hit.longitude}`,
    label: `${hit.name}${hit.admin1 ? `, ${hit.admin1}` : ""}${hit.country ? `, ${hit.country}` : ""}`,
    lat: hit.latitude,
    lon: hit.longitude,
    color: COLORS[idx % COLORS.length],
  };
}

/**
 * メインアプリケーションコンポーネント
 * サイドバーと3Dシーンを配置し、状態管理を行います
 */
export default function App() {
  // UI状態
  const [dark, setDark] = useState(true); // ダークモード/ライトモード
  const [dateISO, setDateISO] = useState(() => new Date().toISOString().slice(0, 10)); // 選択された日付（YYYY-MM-DD形式）
  const [stepMin, setStepMin] = useState(10); // 軌跡の点の間隔（分）

  // 表示オプション
  const [showSun, setShowSun] = useState(true); // 太陽の軌跡を表示するか
  const [showMoon, setShowMoon] = useState(true); // 月の軌跡を表示するか
  const [showHorizon, setShowHorizon] = useState(true); // 地平線を表示するか
  const [showBelowHorizon, setShowBelowHorizon] = useState(false); // 地平線より下の軌跡も表示するか

  // 都市スロット（最大3つまで）
  const [slots, setSlots] = useState<(CityHit | null)[]>([null, null, null]);
  /**
   * 指定されたスロットに都市を設定
   * @param i - スロットのインデックス（0-2）
   * @param hit - 設定する都市（nullの場合はクリア）
   */
  const setSlot = (i: number, hit: CityHit | null) => {
    setSlots((prev) => prev.map((x, idx) => (idx === i ? hit : x)));
  };

  /**
   * 選択された都市と日付に基づいて太陽と月の軌跡データを生成
   * slots、dateISO、stepMinが変更されたときに再計算されます
   */
  const data: CityTraj[] = useMemo(() => {
    const out: CityTraj[] = [];
    slots.forEach((hit, i) => {
      if (!hit) return;
      const city = toCity(hit, i);
      const sun = buildSunTrajectory({ lat: city.lat, lon: city.lon, dateISO, stepMin });
      const moon = buildMoonTrajectory({ lat: city.lat, lon: city.lon, dateISO, stepMin });
      out.push({ city, sun, moon });
    });
    return out;
  }, [slots, dateISO, stepMin]);

  return (
    <div style={{
      height: "100vh",
      display: "grid",
      gridTemplateColumns: "360px 1fr",
      background: dark ? "#0a0f1f" : "#eef2ff",
      gap: 14,
      padding: 14,
      boxSizing: "border-box"
    }}>
      <div style={{
        borderRadius: 18,
        background: dark ? "rgba(15,25,55,0.7)" : "rgba(255,255,255,0.75)",
        border: dark ? "1px solid rgba(110,150,255,0.18)" : "1px solid rgba(20,30,70,0.12)",
        overflow: "hidden"
      }}>
        <Sidebar
          dark={dark} setDark={setDark}
          dateISO={dateISO} setDateISO={setDateISO}
          stepMin={stepMin} setStepMin={setStepMin}
          showSun={showSun} setShowSun={setShowSun}
          showMoon={showMoon} setShowMoon={setShowMoon}
          showHorizon={showHorizon} setShowHorizon={setShowHorizon}
          showBelowHorizon={showBelowHorizon} setShowBelowHorizon={setShowBelowHorizon}
          slots={slots} setSlot={setSlot}
          colors={COLORS}
        />
      </div>

      <div style={{
        borderRadius: 18,
        background: dark ? "rgba(15,25,55,0.55)" : "rgba(255,255,255,0.75)",
        border: dark ? "1px solid rgba(110,150,255,0.18)" : "1px solid rgba(20,30,70,0.12)",
        overflow: "hidden",
        position: "relative"
      }}>
        <div style={{ position: "absolute", top: 14, left: 18, zIndex: 2, color: dark ? "#dbe4ff" : "#15204a" }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.3 }}>Astro UI</div>
          <div style={{ opacity: 0.8, marginTop: 4 }}>ドラッグ：回転</div>
          <div style={{ opacity: 0.8, marginTop: 4 }}>ホイール：ズーム</div>
        </div>

        <Scene3D
          data={data}
          showSun={showSun}
          showMoon={showMoon}
          showHorizon={showHorizon}
          showBelowHorizon={showBelowHorizon}
          dark={dark}
          dateISO={dateISO}
        />
      </div>
    </div>
  );
}
