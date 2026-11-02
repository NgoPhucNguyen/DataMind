import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  X, BookOpen, CheckCircle2, PlayCircle, BarChart2, ShieldAlert,
  Sparkles, Info, HelpCircle
} from "lucide-react";

export default function PageHelpDocs({ pageId }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const DOCS_DATA = {
    profiler: {
      title: t("profiler.help_docs_title"),
      description: t("profiler.help_docs_desc"),
      steps: [
        { icon: PlayCircle, title: t("profiler.help_docs_step1_title"), text: t("profiler.help_docs_step1_text") },
        { icon: BarChart2, title: t("profiler.help_docs_step2_title"), text: t("profiler.help_docs_step2_text") },
        { icon: ShieldAlert, title: t("profiler.help_docs_step3_title"), text: t("profiler.help_docs_step3_text") }
      ]
    },
    cleaner: {
      title: t("cleaner.help_docs_title"),
      description: t("cleaner.help_docs_desc"),
      steps: [
        { icon: PlayCircle, title: t("cleaner.help_docs_step1_title"), text: t("cleaner.help_docs_step1_text") },
        { icon: ShieldAlert, title: t("cleaner.help_docs_step2_title"), text: t("cleaner.help_docs_step2_text") },
        { icon: Info, title: t("cleaner.help_docs_step3_title"), text: t("cleaner.help_docs_step3_text") },
        { icon: Sparkles, title: t("cleaner.help_docs_step4_title"), text: t("cleaner.help_docs_step4_text") },
        { icon: BarChart2, title: t("cleaner.help_docs_step5_title"), text: t("cleaner.help_docs_step5_text") },
        { icon: HelpCircle, title: t("cleaner.help_docs_step6_title"), text: t("cleaner.help_docs_step6_text") },
        { icon: CheckCircle2, title: t("cleaner.help_docs_step7_title"), text: t("cleaner.help_docs_step7_text") }
      ]
    },
    visualize: {
      title: t("visualize.help_docs_title"),
      description: t("visualize.help_docs_desc"),
      steps: [
        { icon: PlayCircle, title: t("visualize.help_docs_step1_title"), text: t("visualize.help_docs_step1_text") },
        { icon: BarChart2, title: t("visualize.help_docs_step2_title"), text: t("visualize.help_docs_step2_text") },
        { icon: Info, title: t("visualize.help_docs_step3_title"), text: t("visualize.help_docs_step3_text") },
        { icon: HelpCircle, title: t("visualize.help_docs_step4_title"), text: t("visualize.help_docs_step4_text") },
        { icon: Sparkles, title: t("visualize.help_docs_step5_title"), text: t("visualize.help_docs_step5_text") },
        { icon: CheckCircle2, title: t("visualize.help_docs_step6_title"), text: t("visualize.help_docs_step6_text") },
        { icon: ShieldAlert, title: t("visualize.help_docs_step7_title"), text: t("visualize.help_docs_step7_text") }
      ]
    }
  };

  const data = DOCS_DATA[pageId];

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!data) return null;

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-forest bg-sage/20 hover:bg-sage/40 rounded-md transition-colors border border-forest/20 shadow-sm"
      >
        <BookOpen className="w-4 h-4" /> {t("common.help_btn", { defaultValue: pageId === "profiler" ? t("profiler.help_docs_btn") : "Hướng dẫn" })}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border bg-sand/30 shrink-0">
              <div className="flex items-center gap-2 text-forest">
                <BookOpen className="w-5 h-5" />
                <h3 className="font-semibold text-lg">{data.title}</h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-muted hover:text-ink hover:bg-gray-200/50 rounded-md transition-colors"
                aria-label={t("common.close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-ink/80 text-sm mb-6 leading-relaxed">
                {data.description}
              </p>
              
              <div className="space-y-5">
                {data.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage/40 flex items-center justify-center text-forest mt-0.5">
                      <step.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-ink text-sm mb-1">{step.title}</h4>
                      <p className="text-muted text-sm leading-relaxed">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-5 border-t border-border bg-gray-50 flex justify-end shrink-0">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-5 py-2 bg-forest text-white text-sm font-medium rounded-lg hover:bg-forest/90 transition-colors shadow-sm"
              >
                {t("common.help_docs_dismiss", { defaultValue: pageId === "profiler" ? t("profiler.help_docs_dismiss") : "Đã hiểu" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
