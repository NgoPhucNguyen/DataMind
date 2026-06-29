import { TEXT } from '../../constants/ui';

export function LoadingOverlay() {
  return (
    <div className="mt-10 space-y-3">
      <div className={`flex items-center gap-3 ${TEXT.secondary}`}>
        <svg
          className="animate-spin h-5 w-5 text-[#1B4324] shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span>Đang phân tích dữ liệu...</span>
      </div>
      {/* Animated progress bar */}
      <div className="h-1 w-full bg-[#EAEAEA] rounded-full overflow-hidden">
        <div className="h-full bg-[#1B4324] rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
      </div>
      <p className={TEXT.caption}>AI đang đọc cấu trúc dataset và nhận diện lĩnh vực...</p>
    </div>
  );
}
