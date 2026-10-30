import { useState, useRef } from "react";

export function useResizableSidebar() {
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);
  const startWidth = useRef(0);
  const isClick = useRef(true);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = isSidebarOpen ? sidebarWidth : 0;
    isClick.current = true;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX.current;

    if (Math.abs(deltaX) > 3) {
      isClick.current = false;
    }

    let newWidth = startWidth.current + deltaX;
    if (newWidth < 100) {
      setIsSidebarOpen(false);
      setSidebarWidth(0);
    } else {
      setIsSidebarOpen(true);
      setSidebarWidth(Math.min(newWidth, 500));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (isClick.current) {
      setIsSidebarOpen((prev) => {
        const nextState = !prev;
        if (nextState) setSidebarWidth(256);
        return nextState;
      });
    } else {
      if (sidebarWidth < 180 && sidebarWidth > 0) {
        setSidebarWidth(180);
      }
    }
  };

  return {
    sidebarWidth,
    isSidebarOpen,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
