import { useEffect, useRef } from "react";

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenModal: (type: "preferences" | "api" | "about") => void;
}

export default function SettingsMenu({
  isOpen,
  onClose,
  onOpenModal,
}: SettingsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-12 left-2 w-48 bg-[#252535]/95 backdrop-blur-xl border border-gray-700/50 rounded-lg shadow-xl z-50 flex flex-col py-1 animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <button
        onClick={() => {
          onOpenModal("preferences");
          onClose();
        }}
        className="text-left px-4 py-2 text-sm text-gray-300 hover:bg-[var(--accent-color)]/20 hover:text-white transition-colors flex items-center gap-2"
      >
        <span>⚙️</span> 偏好设置
      </button>
      <button
        onClick={() => {
          onOpenModal("api");
          onClose();
        }}
        className="text-left px-4 py-2 text-sm text-gray-300 hover:bg-[var(--accent-color)]/20 hover:text-white transition-colors flex items-center gap-2"
      >
        <span>🔑</span> API 管理
      </button>
      <div className="h-px bg-gray-700/50 my-1 mx-2"></div>
      <button
        onClick={() => {
          onOpenModal("about");
          onClose();
        }}
        className="text-left px-4 py-2 text-sm text-gray-300 hover:bg-[var(--accent-color)]/20 hover:text-white transition-colors flex items-center gap-2"
      >
        <span>ℹ️</span> 关于终端
      </button>
    </div>
  );
}
