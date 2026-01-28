/**
 * サイドバーUIコンポーネント
 * アプリケーションの設定と都市選択を行うUIを提供します
 */
import { useEffect, useState } from "react";
import { searchCity, type CityHit } from "../lib/geo";

/**
 * サイドバーコンポーネント
 * ダークモード切り替え、日付選択、表示オプション、都市選択などの機能を提供します
 * 
 * @param props - コンポーネントのプロパティ
 */
export function Sidebar(props: {
  dark: boolean;
  setDark: (v: boolean) => void;
  dateISO: string;
  setDateISO: (v: string) => void;
  stepMin: number;
  setStepMin: (v: number) => void;

  showSun: boolean; setShowSun: (v: boolean) => void;
  showMoon: boolean; setShowMoon: (v: boolean) => void;
  showHorizon: boolean; setShowHorizon: (v: boolean) => void;
  showBelowHorizon: boolean; setShowBelowHorizon: (v: boolean) => void;

  slots: (CityHit | null)[];
  setSlot: (i: number, hit: CityHit | null) => void;
  colors?: string[]; // 都市ごとの色配列
}) {
  const COLORS = props.colors || ["#ff8a3d", "#35d07f", "#7c6cff"];
  
  return (
    <div style={{
      padding: 16, color: props.dark ? "#dbe4ff" : "#15204a",
      display: "flex", flexDirection: "column", gap: 14
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <label>ダークモード</label>
        <input type="checkbox" checked={props.dark} onChange={e => props.setDark(e.target.checked)} />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <label>年月日</label>
        <input type="date" value={props.dateISO} onChange={e => props.setDateISO(e.target.value)} />
        <label>間隔（分）</label>
        <select value={props.stepMin} onChange={e => props.setStepMin(parseInt(e.target.value, 10))}>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
        </select>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <label><input type="checkbox" checked={props.showSun} onChange={e=>props.setShowSun(e.target.checked)} /> 太陽</label>
        <label><input type="checkbox" checked={props.showMoon} onChange={e=>props.setShowMoon(e.target.checked)} /> 月</label>
        <label><input type="checkbox" checked={props.showHorizon} onChange={e=>props.setShowHorizon(e.target.checked)} /> 地平線</label>
        <label><input type="checkbox" checked={props.showBelowHorizon} onChange={e=>props.setShowBelowHorizon(e.target.checked)} /> 地平線より下の軌跡も表示</label>
      </div>

      <CitySlots slots={props.slots} setSlot={props.setSlot} dark={props.dark} colors={COLORS} showSun={props.showSun} showMoon={props.showMoon} />
    </div>
  );
}

/**
 * 都市スロットコンテナコンポーネント
 * 最大3つの都市スロットを表示します
 */
function CitySlots(props: {
  slots: (CityHit | null)[];
  setSlot: (i: number, hit: CityHit | null) => void;
  dark: boolean;
  colors: string[];
  showSun: boolean;
  showMoon: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {props.slots.map((hit, i) => (
        <CitySlot 
          key={i} 
          index={i} 
          hit={hit} 
          setSlot={props.setSlot} 
          dark={props.dark}
          color={props.colors[i % props.colors.length]}
          showSun={props.showSun}
          showMoon={props.showMoon}
        />
      ))}
    </div>
  );
}

/**
 * 個別の都市スロットコンポーネント
 * 都市検索、選択、表示を行うUIを提供します
 */
function CitySlot(props: {
  index: number;
  hit: CityHit | null;
  setSlot: (i: number, hit: CityHit | null) => void;
  dark: boolean;
  color: string;
  showSun: boolean;
  showMoon: boolean;
}) {
  /**
   * 月の色を計算（太陽の色を白で薄める）
   * 差を大きくするため0.6の係数を使用
   * 都市が選択されていない場合でも、スロットに割り当てられた色を使用する
   */
  const moonColor = (() => {
    const r = parseInt(props.color.slice(1, 3), 16);
    const g = parseInt(props.color.slice(3, 5), 16);
    const b = parseInt(props.color.slice(5, 7), 16);
    const whiteR = 255, whiteG = 255, whiteB = 255;
    const lerpR = Math.round(r + (whiteR - r) * 0.6);
    const lerpG = Math.round(g + (whiteG - g) * 0.6);
    const lerpB = Math.round(b + (whiteB - b) * 0.6);
    return `#${lerpR.toString(16).padStart(2, '0')}${lerpG.toString(16).padStart(2, '0')}${lerpB.toString(16).padStart(2, '0')}`;
  })();
  // 都市検索の状態
  const [q, setQ] = useState(""); // 検索クエリ
  const [list, setList] = useState<CityHit[]>([]); // 検索結果

  /**
   * 検索クエリが変更されたときに都市を検索
   * コンポーネントのアンマウント時にリクエストをキャンセルします
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await searchCity(q);
      if (alive) setList(r);
    })();
    return () => { alive = false; }; // クリーンアップ: アンマウント時にフラグをfalseに
  }, [q]);

  return (
    <div style={{
      padding: 12, borderRadius: 14,
      background: props.dark ? "rgba(30,45,92,0.35)" : "rgba(230,235,255,0.8)",
      border: props.dark ? "1px solid rgba(110,150,255,0.25)" : "1px solid rgba(30,45,92,0.15)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>都市 {props.index + 1}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4, fontSize: "12px" }}>
            {props.showSun && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span 
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    background: props.color,
                    borderRadius: "50%",
                    border: props.dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.1)"
                  }}
                />
                <span>太陽</span>
              </div>
            )}
            {props.showMoon && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    background: moonColor,
                    borderRadius: "50%",
                    border: props.dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.1)"
                  }}
                />
                <span>月</span>
              </div>
            )}
          </div>
        </div>
        <button onClick={() => props.setSlot(props.index, null)}>クリア</button>
      </div>

      <input
        placeholder="都市を検索..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ 
          width: "100%", 
          marginTop: 8, 
          padding: 10, 
          borderRadius: 10,
          boxSizing: "border-box"
        }}
      />

      {props.hit && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, opacity: 0.9 }}>
          <div style={{ fontWeight: 700 }}>{props.hit.name}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {props.hit.admin1 ? `${props.hit.admin1}, ` : ""}{props.hit.country ?? ""}
          </div>
        </div>
      )}

      {q.trim() && (
        <div style={{ marginTop: 8, display: "grid", gap: 6, maxHeight: 160, overflow: "auto" }}>
          {list.map((x, k) => (
            <button
              key={k}
              style={{ textAlign: "left", padding: 8, borderRadius: 10 }}
              onClick={() => { props.setSlot(props.index, x); setQ(""); }}
            >
              <div style={{ fontWeight: 700 }}>{x.name}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {x.admin1 ? `${x.admin1}, ` : ""}{x.country ?? ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
