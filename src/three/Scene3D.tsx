/**
 * 3Dシーン管理モジュール
 * Three.jsを使用して太陽と月の軌跡を3Dで可視化します
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { City } from "../lib/astro";
import { buildHorizonDisk, buildAzimuthRing, buildAzimuthTicks, buildPoints, buildTrajectoryLinesSplitByHorizon, frameCameraToObject, buildCompassLabels } from "./buildObjects";
import type { TrajPoint } from "../lib/astro";
import { cityTimezone } from "../lib/astro";
import SunCalc from "suncalc";
import { DateTime } from "luxon";

/**
 * 都市ごとの軌跡データ
 */
export type CityTraj = {
  /** 都市情報 */
  city: City;
  /** 太陽の軌跡点の配列 */
  sun: TrajPoint[];
  /** 月の軌跡点の配列 */
  moon: TrajPoint[];
};

/**
 * 3Dシーンコンポーネント
 * 太陽と月の軌跡を3Dで表示し、マウス操作でインタラクティブに操作できます
 * 
 * @param props - コンポーネントのプロパティ
 * @param props.data - 都市ごとの軌跡データ
 * @param props.showSun - 太陽の軌跡を表示するか
 * @param props.showMoon - 月の軌跡を表示するか
 * @param props.showHorizon - 地平線を表示するか
 * @param props.showBelowHorizon - 地平線より下の軌跡も表示するか
 * @param props.dark - ダークモードかどうか
 * @param props.dateISO - 月齢計算用の日付（YYYY-MM-DD形式）
 */
export function Scene3D(props: {
  data: CityTraj[];
  showSun: boolean;
  showMoon: boolean;
  showHorizon: boolean;
  showBelowHorizon: boolean;
  dark: boolean;
  dateISO?: string; // 月齢計算用
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // シーンの初期化
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(props.dark ? 0x070a14 : 0xf4f6ff);

    // カメラの設定（視野角50度、アスペクト比はコンテナのサイズに合わせる）
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
    camera.position.set(0, 2.2, 6.0);
    camera.lookAt(0, 0, 0);

    // レンダラーの設定（アンチエイリアス有効）
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    // カメラコントロールの設定
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = true;  // 回転を有効化
    controls.enablePan = false;     // パン（平行移動）を無効化
    controls.enableZoom = true;     // ズームを有効化

    // ダンピング（慣性）を有効化してスムーズな操作感を実現
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    controls.target.set(0, 0, 0);
    controls.update();

    // 傾き固定（カメラの現在の傾きをそのまま固定する）
    // これにより、常に同じ角度から見下ろすような視点を維持します
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    const radius = offset.length();
    const polar = Math.acos(THREE.MathUtils.clamp(offset.y / radius, -1, 1)); // 0..pi

    controls.minPolarAngle = polar;
    controls.maxPolarAngle = polar;

    // 環境光の設定（UIらしい柔らかい光）
    const amb = new THREE.AmbientLight(0xffffff, props.dark ? 0.7 : 0.9);
    scene.add(amb);

    // 軌跡を描く球面の半径
    const R = 2.0;

    // ルートグループ（すべてのオブジェクトをここに追加）
    const root = new THREE.Group();
    scene.add(root);

    // 地平線関連のオブジェクトを追加
    if (props.showHorizon) {
      root.add(buildHorizonDisk(R));      // 地平線の円盤
      root.add(buildAzimuthRing(R));      // 方位角のリング
      root.add(buildAzimuthTicks(R));     // 方位角の目盛り
      root.add(buildCompassLabels(R, props.dark)); // 方位ラベル（N, E, S, W）
    }

    // 各都市の軌跡を追加
    for (const entry of props.data) {
      const c = entry.city.color;
      // 月の色は太陽と同じ色を薄く（白を混ぜる）- 差を大きくするため0.6に変更
      const moonColor = new THREE.Color(c).lerp(new THREE.Color("#ffffff"), 0.6).getStyle();

      if (props.showSun) {
        for (const ln of buildTrajectoryLinesSplitByHorizon(entry.sun, R, c, props.showBelowHorizon)) {
          root.add(ln);
        }
        const sunPts = buildPoints(entry.sun, R, c, 0.09, props.showBelowHorizon);
        sunPts.userData = { 
          kind: "sun", 
          traj: entry.sun, 
          color: c, 
          city: entry.city,
          indexMap: (sunPts as any).userData?.indexMap // indexMapを保持
        };
        root.add(sunPts);
      }
      if (props.showMoon) {
        for (const ln of buildTrajectoryLinesSplitByHorizon(entry.moon, R, moonColor, props.showBelowHorizon)) {
          root.add(ln);
        }
        const moonPts = buildPoints(entry.moon, R, moonColor, 0.11, props.showBelowHorizon);
        moonPts.userData = { 
          kind: "moon", 
          traj: entry.moon, 
          color: moonColor, 
          city: entry.city,
          indexMap: (moonPts as any).userData?.indexMap // indexMapを保持
        };
        root.add(moonPts);
      }
    }

    // カメラをオブジェクトに自動フレーミング
    frameCameraToObject(camera, controls, root);

    // Raycasterとツールチップのセットアップ
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.06 };

    const mouseNdc = new THREE.Vector2();

    // DOMツールチップ
    const tip = document.createElement("div");
    tip.style.position = "absolute";
    tip.style.pointerEvents = "none";
    tip.style.padding = "8px 10px";
    tip.style.borderRadius = "8px";
    tip.style.fontSize = "12px";
    tip.style.lineHeight = "1.35";
    tip.style.background = props.dark ? "rgba(10, 14, 28, 0.88)" : "rgba(255, 255, 255, 0.95)";
    tip.style.border = props.dark ? "1px solid rgba(180, 200, 255, 0.25)" : "1px solid rgba(20, 30, 70, 0.25)";
    tip.style.color = props.dark ? "rgba(235, 245, 255, 0.95)" : "rgba(20, 30, 70, 0.95)";
    tip.style.display = "none";
    tip.style.zIndex = "10";
    tip.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";

    mount.style.position = "relative";
    mount.appendChild(tip);

    // 月齢バッジ
    const moonAgeBadge = document.createElement("div");
    moonAgeBadge.setAttribute("data-moon-age-badge", "true");
    moonAgeBadge.style.position = "absolute";
    moonAgeBadge.style.top = "16px";
    moonAgeBadge.style.right = "16px";
    moonAgeBadge.style.padding = "10px 14px";
    moonAgeBadge.style.borderRadius = "8px";
    moonAgeBadge.style.fontSize = "12px";
    moonAgeBadge.style.lineHeight = "1.6";
    moonAgeBadge.style.background = props.dark ? "rgba(10, 14, 28, 0.88)" : "rgba(255, 255, 255, 0.95)";
    moonAgeBadge.style.border = props.dark ? "1px solid rgba(180, 200, 255, 0.25)" : "1px solid rgba(20, 30, 70, 0.25)";
    moonAgeBadge.style.color = props.dark ? "rgba(235, 245, 255, 0.95)" : "rgba(20, 30, 70, 0.95)";
    moonAgeBadge.style.zIndex = "10";
    moonAgeBadge.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    mount.appendChild(moonAgeBadge);

    // 日の出・日の入り・月の出・月の入り時刻表示（各都市ごと）
    const timesContainer = document.createElement("div");
    timesContainer.style.position = "absolute";
    timesContainer.style.bottom = "16px";
    timesContainer.style.right = "16px";
    timesContainer.style.display = "flex";
    timesContainer.style.flexDirection = "column";
    timesContainer.style.gap = "12px";
    timesContainer.style.zIndex = "10";
    mount.appendChild(timesContainer);

    /**
     * 数値を2桁の文字列に変換（先頭に0を付加）
     * @param n - 数値
     * @returns 2桁の文字列（例: 5 → "05"）
     */
    function pad2(n: number) {
      return n.toString().padStart(2, "0");
    }

    /**
     * 方位角（ラジアン）を16方位の日本語表記に変換
     * @param azRad - 方位角（ラジアン、北=0、時計回り）
     * @returns 16方位の日本語表記（例: "北東"）
     */
    function azToDir16(azRad: number) {
      const azDeg = (azRad * 180) / Math.PI;
      const dirs = [
        "北", "北北東", "北東", "東北東",
        "東", "東南東", "南東", "南南東",
        "南", "南南西", "南西", "西南西",
        "西", "西北西", "北西", "北北西",
      ];
      // 22.5度ごとに16方位に分割（360度 / 16 = 22.5度）
      const i = Math.round((((azDeg % 360) + 360) % 360) / 22.5) % 16;
      return dirs[i];
    }

    /**
     * 軌跡点の時刻を現地時間でフォーマット
     * @param p - 軌跡点
     * @param city - 都市情報（undefinedの場合はブラウザのローカルタイムゾーンを使用）
     * @returns 時刻文字列（HH:MM形式）
     */
    function formatTime(p: TrajPoint, city: City | undefined) {
      if (!city) {
        // フォールバック: ブラウザのローカルタイムゾーンを使用
        const d = p.t;
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      }
      // 都市のタイムゾーンで時刻を表示
      const tz = cityTimezone(city.lat, city.lon);
      return formatTimeLocal(p.t, tz);
    }

    /**
     * Dateオブジェクトを指定されたタイムゾーンの現地時間でフォーマット
     * buildSunTrajectory/buildMoonTrajectoryで生成されたDateオブジェクトは
     * UTCタイムスタンプを保持しているため、UTCとして解釈してから
     * 指定されたタイムゾーンに変換します
     * 
     * @param d - Dateオブジェクト（UTCタイムスタンプを保持）
     * @param tz - IANAタイムゾーン名（例: "Asia/Tokyo"）
     * @returns 時刻文字列（HH:MM形式）
     */
    function formatTimeLocal(d: Date, tz: string) {
      // buildSunTrajectory/buildMoonTrajectoryで現地時間のDateTimeからtoJSDate()で変換されたDateは、
      // UTCタイムスタンプを保持している（例：東京 2025-01-28 04:00 JST → 2025-01-27T19:00:00Z）
      // このDateオブジェクトをUTCとして解釈し、指定されたタイムゾーンに変換する
      const dt = DateTime.fromJSDate(d, { zone: "utc" });
      const dtLocal = dt.setZone(tz);
      return `${pad2(dtLocal.hour)}:${pad2(dtLocal.minute)}`;
    }

    /**
     * 日の出・日の入り・月の出・月の入りの時刻を更新
     * 各都市ごとに時刻情報をバッジとして表示します
     */
    function updateTimes() {
      // 既存のバッジをすべて削除
      while (timesContainer.firstChild) {
        timesContainer.removeChild(timesContainer.firstChild);
      }

      // 日付またはデータがない場合は非表示
      if (!props.dateISO || props.data.length === 0) {
        timesContainer.style.display = "none";
        return;
      }
      timesContainer.style.display = "flex";

      // 各都市ごとに時刻情報を表示
      props.data.forEach((entry) => {
        const city = entry.city;
        const cityName = city.label.split(",")[0]; // 都市名のみ取得（カンマ区切りの最初の部分）
        const tz = cityTimezone(city.lat, city.lon);
        // 日付の正午（UTC）を基準に時刻を計算
        const targetDate = new Date(props.dateISO + "T12:00:00Z");
        
        // 日の出・日の入り時刻を計算（SunCalcはUTC時刻を返す）
        const sunTimes = SunCalc.getTimes(targetDate, city.lat, city.lon);
        
        // 月の出・月の入り時刻を計算（SunCalcはUTC時刻を返す）
        const moonTimes = SunCalc.getMoonTimes(targetDate, city.lat, city.lon);

        // 各都市用のバッジを作成
        const timesBadge = document.createElement("div");
        timesBadge.style.padding = "10px 14px";
        timesBadge.style.borderRadius = "8px";
        timesBadge.style.fontSize = "12px";
        timesBadge.style.lineHeight = "1.6";
        timesBadge.style.background = props.dark ? "rgba(10, 14, 28, 0.88)" : "rgba(255, 255, 255, 0.95)";
        timesBadge.style.border = props.dark ? "1px solid rgba(180, 200, 255, 0.25)" : "1px solid rgba(20, 30, 70, 0.25)";
        timesBadge.style.color = props.dark ? "rgba(235, 245, 255, 0.95)" : "rgba(20, 30, 70, 0.95)";
        timesBadge.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";

        const items: string[] = [];
        items.push(`<div style="font-weight:700; margin-bottom:6px; color:${city.color};">${cityName}</div>`);
        
        if (props.showSun) {
          // SunCalc.getTimesはUTC時刻を返すので、現地時間に変換
          const sunriseLocalStr = formatTimeLocal(sunTimes.sunrise, tz);
          const sunsetLocalStr = formatTimeLocal(sunTimes.sunset, tz);
          items.push(`<div style="margin-bottom:4px; display:flex; align-items:center;"><span style="font-weight:700; min-width:80px;">☀️ 日の出:</span><span style="text-align:left;">${sunriseLocalStr}</span></div>`);
          items.push(`<div style="margin-bottom:4px; display:flex; align-items:center;"><span style="font-weight:700; min-width:80px;">☀️ 日の入り:</span><span style="text-align:left;">${sunsetLocalStr}</span></div>`);
        }
        
        if (props.showMoon) {
          if (moonTimes.rise) {
            // SunCalc.getMoonTimesもUTC時刻を返すので、現地時間に変換
            const moonriseLocalStr = formatTimeLocal(moonTimes.rise, tz);
            items.push(`<div style="margin-bottom:4px; display:flex; align-items:center;"><span style="font-weight:700; min-width:80px;">🌙 月の出:</span><span style="text-align:left;">${moonriseLocalStr}</span></div>`);
          } else if (moonTimes.alwaysUp) {
            items.push(`<div style="margin-bottom:4px; display:flex; align-items:center;"><span style="font-weight:700; min-width:80px;">🌙 月の出:</span><span style="text-align:left;">常に上</span></div>`);
          } else {
            items.push(`<div style="margin-bottom:4px; display:flex; align-items:center;"><span style="font-weight:700; min-width:80px;">🌙 月の出:</span><span style="text-align:left;">なし</span></div>`);
          }
          
          if (moonTimes.set) {
            const moonsetLocalStr = formatTimeLocal(moonTimes.set, tz);
            items.push(`<div style="display:flex; align-items:center;"><span style="font-weight:700; min-width:80px;">🌙 月の入り:</span><span style="text-align:left;">${moonsetLocalStr}</span></div>`);
          } else if (moonTimes.alwaysDown) {
            items.push(`<div style="display:flex; align-items:center;"><span style="font-weight:700; min-width:80px;">🌙 月の入り:</span><span style="text-align:left;">常に下</span></div>`);
          } else {
            items.push(`<div style="display:flex; align-items:center;"><span style="font-weight:700; min-width:80px;">🌙 月の入り:</span><span style="text-align:left;">なし</span></div>`);
          }
        }

        if (items.length > 1) { // 都市名以外に項目がある場合のみ表示
          timesBadge.innerHTML = items.join("");
          timesContainer.appendChild(timesBadge);
        }
      });
    }

    // 月相の描画（球の陰影をピクセルで計算して“現実っぽく”）
    // - 影と輪郭の交点は常に「左右中央の線上（x=centerX）」の上下端に固定される
    // - 満ち欠けで終端線のカーブが急/緩になる（球の光学に従う）
    // - phase: 0=新月, 0.25=上弦, 0.5=満月, 0.75=下弦
    function updateMoonAge() {
      // date が無いときは非表示
      if (!props.dateISO) {
        moonAgeBadge.style.display = "none";
        return;
      }
      moonAgeBadge.style.display = "block";
    
      // --- ここでCanvasを用意する（← missing だったのが原因） ---
      moonAgeBadge.innerHTML = ""; // 毎回作り直す
    
      // タイトル
      const title = document.createElement("div");
      title.textContent = "月齢";
      title.style.fontWeight = "700";
      title.style.marginBottom = "6px";
      moonAgeBadge.appendChild(title);
    
      // 横並び
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      moonAgeBadge.appendChild(row);
    
      // Canvas
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      canvas.style.width = "32px";
      canvas.style.height = "32px";
      canvas.style.borderRadius = "999px";
      row.appendChild(canvas);
    
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
    
      // 数値
      const value = document.createElement("div");
      value.style.fontWeight = "700";
      row.appendChild(value);
    
      // --- 月齢/照度を計算 ---
      // 既存コードの updateTimes() と同じく「正午Z」を基準にする（時差ブレを減らす）
      const targetDate = new Date(props.dateISO + "T12:00:00Z");
       
      const ill = SunCalc.getMoonIllumination(targetDate);
      const moonAge = ill.phase * 29.530588853; // 朔望月（日）
    
      value.textContent = moonAge.toFixed(1);
    
      // --- 描画パラメータ ---
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = canvas.width * 0.45;
    
      // 背景クリア
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    
      // 月相の描画（球の陰影をピクセルで計算して“現実っぽく”）
      {
        const size = canvas.width; // 64
        const img = ctx.createImageData(size, size);
    
        // 月面の色（好みで微調整OK）
        const litRGB = { r: 225, g: 222, b: 210 };
        const darkRGB = props.dark
          ? { r: 20, g: 26, b: 42 }
          : { r: 220, g: 226, b: 242 };
    
        // 光の方向（観測者は +Z 方向から見ている想定）
        // phase: 0=新月, 0.25=上弦, 0.5=満月, 0.75=下弦
        const phase = ill.phase; // 0..1
        const alpha = 2 * Math.PI * phase;
        const lx = Math.sin(alpha);
        const lz = -Math.cos(alpha);
    
        const cx = centerX;
        const cy = centerY;
        const r = radius;
    
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const dx = x + 0.5 - cx;
            const dy = y + 0.5 - cy;
            const rr = dx * dx + dy * dy;
    
            const idx = (y * size + x) * 4;
    
            if (rr > r * r) {
              img.data[idx + 3] = 0;
              continue;
            }
    
            const nx = dx / r;
            const ny = dy / r;
            const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    
            // --- 2Dっぽく境界を“くっきり”させる設定 ---
            const ambient = 0.02;        // 影側を暗く（小さくするほどメリハリ強い）
            const gamma = 0.95;          // 明部の締まり
            const limbDark = 0.10;       // 球感を弱める（小さめ推奨）

            const edgeSoftness = 0.035;  // 境界の“ぼかし幅”(0.0に近いほどカチッと)
            const edgeBoost = 0.85;      // 境界付近の明部を少し持ち上げて輪郭を見やすく

            let ndotl = nx * lx + nz * lz;      // -1..1
            // 終端線の硬さ：smoothstepで「ほぼ2値」に近づける
            const t0 = -edgeSoftness;
            const t1 = +edgeSoftness;
            let lit = (ndotl - t0) / (t1 - t0);
            lit = Math.min(1, Math.max(0, lit)); // clamp 0..1

            // 明部だけ少しブースト（境界が読み取りやすくなる）
            lit = Math.pow(lit, edgeBoost);

            // リム暗化は弱めで（2Dっぽさ優先）
            const rim = 1 - nz;
            const rimFactor = 1 - limbDark * rim;

            // 最終輝度
            let I = ambient + (1 - ambient) * lit;
            I = Math.pow(Math.min(1, Math.max(0, I * rimFactor)), gamma);
    
            img.data[idx + 0] = darkRGB.r + (litRGB.r - darkRGB.r) * I;
            img.data[idx + 1] = darkRGB.g + (litRGB.g - darkRGB.g) * I;
            img.data[idx + 2] = darkRGB.b + (litRGB.b - darkRGB.b) * I;
            img.data[idx + 3] = 255;
          }
        }
    
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.putImageData(img, 0, 0);
        ctx.restore();
    
        // 輪郭を少しだけ強調
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = props.dark ? "rgba(210,230,255,0.18)" : "rgba(40,60,90,0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 初期表示を更新
    updateMoonAge();
    updateTimes();

    /**
     * マウス移動時のイベントハンドラ
     * 軌跡上の点にマウスオーバーしたときにツールチップを表示します
     * 
     * @param ev - マウスイベント
     */
    const onMouseMove = (ev: MouseEvent) => {
      // マウス位置を正規化デバイス座標（NDC: -1..1）に変換
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      mouseNdc.set(x, y);

      // レイキャスティング: カメラからマウス位置に向かうレイを発射
      raycaster.setFromCamera(mouseNdc, camera);

      // レイと交差するオブジェクトを検出（kindプロパティを持つオブジェクトのみ）
      const hits = raycaster.intersectObjects(root.children, true)
        .filter((h: any) => h.object?.userData?.kind);

      // 交差するオブジェクトがない場合はツールチップを非表示
      if (hits.length === 0) {
        tip.style.display = "none";
        return;
      }

      // 最初に交差したオブジェクトを取得
      const hit = hits[0] as any;
      const obj = hit.object;
      const kind = obj.userData.kind as "sun" | "moon";
      const traj = obj.userData.traj as TrajPoint[];
      const city = obj.userData.city as City | undefined;

      // 表示される点のインデックスから元のtraj配列のインデックスを取得
      // showBelowHorizonがfalseの場合、負の高度角の点がスキップされるため、
      // indexMapを使って正しいインデックスを取得する必要があります
      const displayIdx = hit.index;
      const indexMap = obj.userData?.indexMap as number[] | undefined;
      const idx = indexMap && indexMap[displayIdx] !== undefined ? indexMap[displayIdx] : displayIdx;
      
      if (typeof idx !== "number" || !traj?.[idx]) {
        tip.style.display = "none";
        return;
      }

      // 軌跡点の情報を取得してツールチップに表示
      const p = traj[idx];
      const altDeg = (p.alt * 180) / Math.PI; // 高度角を度に変換
      const azDeg = (p.azN * 180) / Math.PI;  // 方位角を度に変換
      const dir = azToDir16(p.azN);           // 16方位の日本語表記
      const t = formatTime(p, city);          // 現地時間でフォーマット

      // デバッグ出力（詳細版、3時付近のみ）
      const cityTz = city ? cityTimezone(city.lat, city.lon) : 'N/A';
      const dtFromDate = DateTime.fromJSDate(p.t, { zone: "utc" });
      const dtLocal = dtFromDate.setZone(cityTz);
      if (dtLocal.hour === 3 || Math.abs(altDeg) < 5) { // 3時付近または地平線付近のみ
        console.log('[onMouseMove]', {
          kind,
          cityName: city ? city.label.split(",")[0] : "Unknown",
          time: t,
          altDeg: altDeg.toFixed(2),
          azDeg: azDeg.toFixed(2),
          dateISO: p.t.toISOString(),
          cityTz,
          dtUTC: dtFromDate.toISO(),
          dtLocalISO: dtLocal.toISO(),
          dtLocalHour: dtLocal.hour,
          dtLocalMinute: dtLocal.minute,
          'formatTimeLocal result': t
        });
      }

      const cityName = city ? city.label.split(",")[0] : "Unknown";
      const kindLabel = kind === "sun" ? "太陽" : "月";

      tip.innerHTML =
        `<div style="font-weight:700; margin-bottom:4px;">${kindLabel} - ${cityName}</div>` +
        `時刻：${t}<br/>` +
        `高度角：${altDeg.toFixed(1)}°<br/>` +
        `方位角：${azDeg.toFixed(1)}°（${dir}）`;

      tip.style.left = `${ev.clientX - rect.left + 12}px`;
      tip.style.top = `${ev.clientY - rect.top + 12}px`;
      tip.style.display = "block";
    };

    renderer.domElement.addEventListener("mousemove", onMouseMove);

    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      if (tip.parentElement) tip.parentElement.removeChild(tip);
      if (moonAgeBadge.parentElement) moonAgeBadge.parentElement.removeChild(moonAgeBadge);
      if (timesContainer.parentElement) timesContainer.parentElement.removeChild(timesContainer);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [props.data, props.showSun, props.showMoon, props.showHorizon, props.showBelowHorizon, props.dark, props.dateISO]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
