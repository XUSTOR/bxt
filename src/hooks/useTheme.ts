import { useState, useEffect, useRef } from "react";

export function useTheme() {
  const [fontSize, setFontSize] = useState(14);
  const [themeColor, setThemeColor] = useState(
    () => localStorage.getItem("themeColor") || "#22d3ee",
  );
  const [bgColor, setBgColor] = useState(
    () => localStorage.getItem("bgColor") || "#1e1e2e",
  );

  const lastTime = useRef(0);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent-color", themeColor);
    document.documentElement.style.setProperty("--bg-main", bgColor);
    localStorage.setItem("themeColor", themeColor);
    localStorage.setItem("bgColor", bgColor);
  }, [themeColor, bgColor]);

  const handleThemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (now - lastTime.current > 16) {
      setThemeColor(e.target.value);
      lastTime.current = now;
    }
  };

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (now - lastTime.current > 16) {
      setBgColor(e.target.value);
      lastTime.current = now;
    }
  };

  return {
    themeColor,
    bgColor,
    fontSize,
    setFontSize,
    handleThemeChange,
    handleBgChange,
  };
}
