/**
 * アプリケーションのエントリーポイント
 * ReactアプリケーションをDOMにマウントします
 */
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// React StrictModeでアプリケーションをレンダリング
// StrictModeは開発時に潜在的な問題を検出するためのツールです
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
