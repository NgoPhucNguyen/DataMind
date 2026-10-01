import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFileSession } from "../contexts/FileSessionContext";
import Profiler from "./Profiler";
import Cleaner from "./Cleaner";
import Visualize from "./Visualize";
import Report from "./Report";
import { Check, AlertTriangle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { TEXT, PAGE, BTN, CARD } from "../constants/ui";

const STEPS = ["profiler", "cleaner", "visualize", "report"];
const STEP_LABELS = {
  profiler: "Phân tích",
  cleaner: "Làm sạch",
  visualize: "Trực quan",
  report: "Báo cáo"
};

export default function Pipeline() {
  const { step } = useParams();
  const navigate = useNavigate();
  const { fileSession } = useFileSession();

  const [currentStep, setCurrentStep] = useState("profiler");
  const [pipelineError, setPipelineError] = useState(null);

  const [stepStatus, setStepStatus] = useState(() => {
    return STEPS.reduce((acc, s) => ({ ...acc, [s]: "pending" }), {});
  });

  useEffect(() => {
    if (step && STEPS.includes(step)) {
      if (step !== "profiler" && !fileSession.fileHash) {
        navigate("/dashboard/pipeline/profiler", { replace: true });
      } else {
        setCurrentStep(step);
        setStepStatus(prev => {
          const newStatus = { ...prev };
          const currentIndex = STEPS.indexOf(step);
          STEPS.forEach((s, idx) => {
            if (idx < currentIndex && newStatus[s] === "pending") {
              newStatus[s] = "done";
            }
          });
          return newStatus;
        });
      }
    } else {
      navigate("/dashboard/pipeline/profiler", { replace: true });
    }
  }, [step, fileSession.fileHash, navigate]);

  useEffect(() => {
    const handleReset = () => {
      setPipelineError(null);
      setStepStatus(STEPS.reduce((acc, s) => ({ ...acc, [s]: "pending" }), {}));
      navigate("/dashboard/pipeline/profiler", { replace: true });
    };
    window.addEventListener("datamind:session-cleared", handleReset);
    return () => window.removeEventListener("datamind:session-cleared", handleReset);
  }, [navigate]);

  const handleNext = (nextStep) => {
    setPipelineError(null);
    setStepStatus(prev => ({ ...prev, [currentStep]: "done" }));
    navigate(`/dashboard/pipeline/${nextStep}`);
  };

  const handleError = (msg) => {
    setPipelineError(msg);
  };

  const handleSkipWarning = () => {
    setStepStatus(prev => ({ ...prev, [currentStep]: "warning" }));
    setPipelineError(null);
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      navigate(`/dashboard/pipeline/${STEPS[currentIndex + 1]}`);
    }
  };

  const STEP_COMPONENTS = {
    profiler: <Profiler pipelineMode onComplete={() => handleNext("cleaner")} onError={handleError} />,
    cleaner: <Cleaner pipelineMode onComplete={() => handleNext("visualize")} onError={handleError} />,
    visualize: <Visualize pipelineMode onComplete={() => handleNext("report")} onError={handleError} />,
    report: <Report pipelineMode onComplete={() => navigate("/dashboard/profiler")} />
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col relative pb-10">
      {/* Stepper Header */}
      <header className="border-b border-border bg-white px-6 py-4 sticky top-0 z-20 flex justify-center overflow-x-auto">
        <div className="flex items-center gap-2 sm:gap-4 text-sm font-medium whitespace-nowrap">
          {STEPS.map((s, idx) => {
            const isActive = currentStep === s;
            const status = stepStatus[s];

            let statusIcon = null;
            if (status === "done") statusIcon = <Check className="w-4 h-4 text-forest" />;
            if (status === "warning") statusIcon = <AlertTriangle className="w-4 h-4 text-[#d97706]" />;

            return (
              <div key={s} className="flex items-center gap-2 sm:gap-4">
                <div
                  onClick={() => {
                    if (status === "done" || status === "warning" || isActive) {
                      navigate(`/dashboard/pipeline/${s}`);
                    }
                  }}
                  className={`flex items-center gap-1.5 transition-colors ${status === "done" || status === "warning" || isActive ? "cursor-pointer" : "cursor-default"} ${isActive ? 'text-[#1B4324] border-b-2 border-[#1B4324] pb-0.5 font-semibold' : (status === 'done' ? 'text-forest font-medium hover:text-[#1B4324]' : (status === 'warning' ? 'text-[#d97706] font-medium hover:text-[#b45309]' : 'text-muted'))}`}
                >
                  <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${isActive ? 'bg-[#1B4324] text-white' : (status === 'done' ? 'bg-forest text-white' : 'bg-[#EAEAEA] text-muted')}`}>
                    {idx + 1}
                  </span>
                  <span>{STEP_LABELS[s]}</span>
                  {statusIcon}
                </div>
                {idx < STEPS.length - 1 && <div className="w-8 sm:w-12 h-[1px] bg-border"></div>}
              </div>
            );
          })}
        </div>
      </header>

      {/* Error Panel (Inline, not overlay) */}
      {pipelineError && (
        <div className="bg-[#FDEBEC] border-b border-[#f5c6cb] px-6 py-3 flex flex-col sm:flex-row items-center justify-between shadow-sm z-10 gap-3">
          <div className="flex items-center gap-2 text-[#9F2F2D] font-medium">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm sm:text-base">{pipelineError}</span>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => setPipelineError(null)}
              className="bg-white border border-[#f5c6cb] text-[#9F2F2D] px-4 py-1.5 rounded text-sm font-medium hover:bg-[#f8d7da] transition-all shadow-sm"
            >
              Sửa lại ở bước này
            </button>
            <button
              onClick={handleSkipWarning}
              className="bg-[#9F2F2D] text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-[#7a2322] transition-all shadow-sm"
            >
              Bỏ qua, tiếp tục →
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-auto pipeline-content">
        {STEP_COMPONENTS[currentStep]}
      </div>

      {/* Debug Helper (DEV only) */}
      {import.meta.env.DEV && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#1a1a2e", color: "#00ff88", fontSize: 11,
          padding: "4px 12px", fontFamily: "monospace", zIndex: 9999,
          display: "flex", gap: "12px", overflowX: "auto"
        }}>
          <span className="whitespace-nowrap">step: {currentStep}</span> |
          <span className="whitespace-nowrap">session: {fileSession.sessionId ? fileSession.sessionId.slice(0, 8) + '...' : 'null'}</span> |
          <span className="whitespace-nowrap">status: {JSON.stringify(stepStatus)}</span> |
          <span className="whitespace-nowrap">warnings: {fileSession.warnings?.length || 0}</span>
        </div>
      )}
    </div>
  );
}
