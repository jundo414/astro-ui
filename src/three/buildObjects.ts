/**
 * 3Dオブジェクト構築モジュール
 * Three.jsを使用して太陽・月の軌跡を3Dシーンに描画するためのオブジェクトを生成します
 */
import * as THREE from "three";
import type { TrajPoint } from "../lib/astro";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * 地平座標系（高度角・方位角）を3D座標（x, y, z）に変換
 * 座標系: x=東, y=上, z=北
 * 方位角: 北=0, 東=π/2, 南=π, 西=3π/2（時計回り）
 * 
 * @param p - 軌跡点（azN, altは既にラジアン）
 * @param R - 球の半径（軌跡を描く球面の半径）
 * @returns 3D座標ベクトル
 */
export function toXYZ(p: TrajPoint, R: number) {
  const az = p.azN; // 方位角（ラジアン）
  const alt = p.alt; // 高度角（ラジアン）

  // 地平座標 → 3D（Y up）
  // x: East, z: North, y: Up
  // az: 北=0, 東=π/2, 南=π, 西=3π/2
  const r = R * Math.cos(alt); // 水平方向の半径
  const x = r * Math.sin(az);   // 東方向
  const z = r * Math.cos(az);   // 北方向
  const y = R * Math.sin(alt);  // 上方向

  return new THREE.Vector3(x, y, z);
}

/**
 * 軌跡を線分として構築（地平線で分割）
 * 地平線より下の点が含まれる場合、そこで線を分割して別のLineオブジェクトとして生成します
 * 
 * @param points - 軌跡点の配列
 * @param R - 球の半径
 * @param color - 線の色（CSS色文字列）
 * @param showBelowHorizon - 地平線より下の点も表示するか
 * @returns Lineオブジェクトの配列
 */
export function buildTrajectoryLinesSplitByHorizon(
  points: TrajPoint[],
  R: number,
  color: string,
  showBelowHorizon: boolean
) {
  const lines: THREE.Line[] = [];
  let current: number[] = []; // 現在の線分の頂点座標（x, y, zの連続配列）

  /**
   * 現在の線分を確定してLineオブジェクトを生成
   * 2点以上ある場合のみ生成します
   */
  const pushCurrent = () => {
    if (current.length >= 6) { // 2点以上（各点はx, y, zの3要素）
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(current, 3));
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
      lines.push(new THREE.Line(geom, mat));
    }
    current = [];
  };

  for (const p of points) {
    // 表示条件: showBelowHorizonがtrue、または高度角が0以上
    const visible = showBelowHorizon || p.alt >= 0;

    if (!visible) {
      // 地平線下 → ここで線を切る
      pushCurrent();
      continue;
    }

    // 3D座標に変換して現在の線分に追加
    const v = toXYZ(p, R);
    current.push(v.x, v.y, v.z);
  }

  // 最後の線分を確定
  pushCurrent();
  return lines;
}

/**
 * 軌跡を点群として構築
 * 各点はクリック可能で、ツールチップに情報を表示できます
 * 
 * @param points - 軌跡点の配列
 * @param R - 球の半径
 * @param color - 点の色（CSS色文字列）
 * @param size - 点の基本サイズ（デフォルト: 0.06）
 * @param showBelowHorizon - 地平線より下の点も表示するか
 * @returns Pointsオブジェクト（indexMapをuserDataに保存）
 */
export function buildPoints(points: TrajPoint[], R: number, color: string, size = 0.06, showBelowHorizon: boolean) {
  const verts: number[] = []; // 頂点座標（x, y, zの連続配列）
  const sizes: number[] = []; // 各点のサイズ
  /** 表示される点のインデックス → 元のtraj配列のインデックスのマッピング */
  const indexMap: number[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    // 地平線より下の点をスキップ（showBelowHorizonがfalseの場合）
    if (!showBelowHorizon && p.alt < 0) continue;
    
    const v = toXYZ(p, R);
    verts.push(v.x, v.y, v.z);
    indexMap.push(i); // 元のインデックスを保存（ツールチップ表示時に使用）

    // 月の照度に応じて点のサイズを調整（太陽の場合は常に1.0）
    const k = p.illum ?? 1;
    sizes.push(size * (0.6 + 0.8 * k));
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geom.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));

  /**
   * カスタムシェーダーマテリアル
   * - 頂点シェーダー: カメラからの距離に応じて点のサイズを調整（常に同じ見た目のサイズを維持）
   * - フラグメントシェーダー: ソフトな円形の点を描画
   */
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `
      attribute float size;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = dot(c, c);
        float a = smoothstep(0.25, 0.0, d); // soft circle
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });

  const pointsObj = new THREE.Points(geom, mat);
  (pointsObj as any).userData.indexMap = indexMap; // インデックスマッピングを保存
  return pointsObj;
}

/**
 * 地平線の円盤を構築
 * 軌跡を表示する球面の基準となる水平面を表します
 * 
 * @param R - 球の半径
 * @returns 地平線の円盤メッシュ
 */
export function buildHorizonDisk(R: number) {
  const geom = new THREE.CircleGeometry(R * 1.02, 128); // 半径を少し大きくして軌跡と重ならないように
  const mat = new THREE.MeshBasicMaterial({
    color: 0x101a38,        // 背景より明るい色
    transparent: true,
    opacity: 0.70,          // しっかり見える透明度
    side: THREE.DoubleSide, // 両面表示
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2; // XZ平面に配置（Y軸を上向きに）
  mesh.position.y = 0; // 原点の高さ
  return mesh;
}

/**
 * 方位角のリング（円周線）を構築
 * 地平線の円周に沿った線を描画します
 * 
 * @param R - 球の半径
 * @returns 方位角リングのLineオブジェクト
 */
export function buildAzimuthRing(R: number) {
  const curve = new THREE.EllipseCurve(0, 0, R * 1.02, R * 1.02, 0, Math.PI * 2, false, 0);
  const pts2 = curve.getPoints(256); // 256点で滑らかな円を描画
  // z-fighting対策: Y座標を0.001に設定して地平線ディスクより少し上に配置
  const pts3 = pts2.map(p => new THREE.Vector3(p.x, 0.001, p.y));
  const geom = new THREE.BufferGeometry().setFromPoints(pts3);
  const mat = new THREE.LineBasicMaterial({ color: 0xa9bbff, transparent: true, opacity: 0.85 });
  return new THREE.Line(geom, mat);
}

/**
 * 方位角の目盛りを構築
 * 5度ごとに目盛りを描画し、10度ごとに長め、30度ごとにさらに長くします
 * 
 * @param R - 球の半径
 * @returns 方位角目盛りのGroupオブジェクト
 */
export function buildAzimuthTicks(R: number) {
  const group = new THREE.Group();

  // 主要目盛り（10度ごと）と通常目盛り（5度ごと）のマテリアル
  const major = new THREE.LineBasicMaterial({ color: 0xa9bbff, transparent: true, opacity: 0.95 });
  const minor = new THREE.LineBasicMaterial({ color: 0xa9bbff, transparent: true, opacity: 0.55 });

  // 5度ごとに目盛りを生成
  for (let deg = 0; deg < 360; deg += 5) {
    const a = (deg * Math.PI) / 180; // 度をラジアンに変換（北=0、時計回り）
    // 目盛りの長さ: 30度ごと→0.10、10度ごと→0.07、その他→0.04
    const len = (deg % 30 === 0) ? 0.10 : (deg % 10 === 0) ? 0.07 : 0.04;

    const r1 = R * 1.02; // 外側の半径
    const r2 = r1 - len; // 内側の半径

    // 目盛りの両端の座標を計算
    const x1 = r1 * Math.sin(a);
    const z1 = r1 * Math.cos(a);
    const x2 = r2 * Math.sin(a);
    const z2 = r2 * Math.cos(a);

    const y = 0.002; // z-fighting対策: 地平線ディスクより少し上に配置

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute([x1,y,z1, x2,y,z2], 3));
    // 10度ごとの目盛りはmajor、それ以外はminorを使用
    const line = new THREE.Line(geom, (deg % 10 === 0) ? major : minor);
    group.add(line);
  }

  return group;
}

/**
 * カメラをオブジェクトに自動フレーミング
 * オブジェクト全体が画面に収まるようにカメラの位置とパラメータを調整します
 * 
 * @param camera - パースペクティブカメラ
 * @param controls - OrbitControls
 * @param object - フレーミング対象のオブジェクト
 */
export function frameCameraToObject(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D
) {
  // オブジェクトのバウンディングボックスとバウンディングスフィアを計算
  const box = new THREE.Box3().setFromObject(object);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  // 視野角から適切な距離を計算
  const fov = (camera.fov * Math.PI) / 180;
  const dist = sphere.radius / Math.sin(fov / 2);

  // 見下ろし固定の方向を維持（添付イメージの角度）
  // 方向ベクトル (0, 0.75, 1.0) を正規化して使用
  const dir = new THREE.Vector3(0, 0.75, 1.0).normalize();
  camera.position.copy(sphere.center.clone().add(dir.multiplyScalar(dist * 0.8)));
  
  // カメラのニア・ファープレーンを調整
  camera.near = dist / 100;
  camera.far = dist * 100;
  camera.updateProjectionMatrix();

  // コントロールのターゲットをオブジェクトの中心に設定
  controls.target.copy(sphere.center);
  controls.update();
}

/**
 * 方位ラベル（N, E, S, W）を構築
 * Canvasを使用してテキストを描画し、スプライトとして3Dシーンに配置します
 * 
 * @param R - 球の半径
 * @param dark - ダークモードかどうか（色を変更）
 * @returns 方位ラベルのGroupオブジェクト
 */
export function buildCompassLabels(R: number, dark: boolean) {
  const group = new THREE.Group();
  // 方位ラベルのテキストと位置（x, y, z）
  const labels = [
    { text: "N", pos: [0, 0, -R * 1.15] }, // 北（Z軸負の方向）
    { text: "E", pos: [R * 1.15, 0, 0] }, // 東（X軸正の方向）
    { text: "S", pos: [0, 0, R * 1.15] }, // 南（Z軸正の方向）
    { text: "W", pos: [-R * 1.15, 0, 0] }, // 西（X軸負の方向）
  ];

  labels.forEach(({ text, pos }) => {
    // Canvasでテキストを描画
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = dark ? "rgba(235, 245, 255, 0.95)" : "rgba(20, 30, 70, 0.9)";
    ctx.font = "bold 96px sans-serif"; // 大きなフォントサイズ
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 150, 150); // キャンバスの中心に描画

    // Canvasをテクスチャとして使用してスプライトを作成
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(pos[0], 0.01, pos[2]); // pos[2]をZ座標として使用（z-fighting対策で少し浮かす）
    sprite.scale.set(0.45, 0.45, 1); // スプライトのサイズ
    group.add(sprite);
  });

  return group;
}
