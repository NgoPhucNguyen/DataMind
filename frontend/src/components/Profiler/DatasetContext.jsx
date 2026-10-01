import { CARD, TEXT } from "../../constants/ui";

export const DatasetContext = ({
  contextDescription,
  setContextDescription,
  contextPurpose,
  setContextPurpose
}) => {
  return (
    <div className={CARD}>
      <h3 className={TEXT.sectionTitle}>Mô tả dataset (không bắt buộc)</h3>
      <p className={`${TEXT.secondary} mb-4 mt-1`}>
        Thêm mô tả giúp AI viết báo cáo chính xác hơn ở bước cuối
      </p>
      <textarea
        className="w-full border border-border rounded-lg p-3 text-sm focus:ring-1 focus:ring-[#1B4324] outline-none mb-4"
        placeholder='Ví dụ: "Khảo sát 500 sinh viên, đánh giá chất lượng giảng dạy"'
        value={contextDescription}
        onChange={e => setContextDescription(e.target.value)}
        rows={3}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        {["Tìm xu hướng chung", "So sánh các nhóm",
          "Phát hiện vấn đề", "Báo cáo định kỳ"].map(opt => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer border border-border px-3 py-1.5 rounded-lg hover:bg-sage/10 transition-colors">
              <input type="radio" name="purpose" value={opt}
                checked={contextPurpose === opt}
                onChange={() => setContextPurpose(opt)}
                className="accent-[#1B4324]"
              />
              {opt}
            </label>
          ))}
      </div>
    </div>
  );
};
