interface AiPanelProps {
  isAiOpen: boolean;
  closeAi: () => void;
  themeColor: string;
}

export default function AiPanel({
  isAiOpen,
  closeAi,
  themeColor,
}: AiPanelProps) {
  return (
    <div
      className={`w-80 bg-black/50 backdrop-blur-xl border-l transition-transform duration-300 ease-in-out ${
        isAiOpen ? "translate-x-0" : "translate-x-full hidden"
      }`}
      style={{
        borderColor: `${themeColor}4D`,
        boxShadow: `0 0 20px ${themeColor}26`,
      }}
    >
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2
          className="font-bold text-sm tracking-wider transition-colors"
          style={{ color: "var(--accent-color)" }}
        >
          DEEPSEEK COPILOT
        </h2>
        <button
          onClick={closeAi}
          className="text-gray-500 hover:text-white text-lg"
        >
          &times;
        </button>
      </div>
      <div className="p-4 text-sm leading-relaxed">
        <p className="text-gray-300 mb-2">你的 5173 端口被占用了。</p>
        <div className="bg-gray-900/80 p-3 rounded border border-gray-700 font-mono text-xs text-green-400 mb-2">
          netstat -ano | findstr 5173
          <br />
          taskkill /PID 1234 /F
        </div>
        <p className="text-gray-400 text-xs">点击上方代码可直接复制。</p>
      </div>
    </div>
  );
}
