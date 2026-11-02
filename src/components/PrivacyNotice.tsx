import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { ackPrivacy } from "../lib/settings";

/**
 * 首次启动的隐私说明。
 * 目标是让用户在第一屏就知道两件事：终端内容会去哪、key 存在哪。
 * 勾选"不再提示"后写 localStorage（带版本号，见 lib/settings.ts）。
 */
export default function PrivacyNotice({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [remember, setRemember] = useState(true);

  const handleClose = () => {
    if (remember) ackPrivacy();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[520px] border border-white/10 rounded-xl shadow-2xl bg-[#1e1e2e] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 pt-6 pb-4">
          <div className="text-base font-semibold text-gray-100">
            {t("privacyTitle")}
          </div>
          <div className="mt-3 text-[13px] leading-relaxed text-gray-400 flex flex-col gap-2.5">
            <p>{t("privacyAiLine")}</p>
            <p>{t("privacyKeyLine")}</p>
            <p className="text-gray-500">{t("privacyTelemetryLine")}</p>
          </div>
        </div>

        <div className="px-6 pb-5 pt-1 flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-3.5 h-3.5 cursor-pointer accent-[var(--accent-color)]"
            />
            <span className="text-[11px] text-gray-500">
              {t("privacyDontShow")}
            </span>
          </label>

          <button
            onClick={handleClose}
            className="px-4 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              backgroundColor: "var(--accent-color)",
              color: "#101018",
            }}
          >
            {t("privacyOk")}
          </button>
        </div>
      </div>
    </div>
  );
}
