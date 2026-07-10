// Typography classes — dùng thống nhất toàn app
export const TEXT = {
  pageTitle: "text-2xl font-semibold tracking-tight text-[#121A14]",
  sectionTitle: "text-base font-semibold text-[#121A14]",
  body: "text-sm text-[#121A14] leading-relaxed",
  secondary: "text-sm text-[#626C65]",
  caption: "text-xs text-[#626C65] tracking-wide",
  mono: "font-mono text-sm text-[#121A14]",
}

// Button classes
export const BTN = {
  primary: "rounded-md px-4 py-2 text-sm font-medium bg-[#121A14] text-white hover:bg-[#1B4324] transition-all duration-150 disabled:bg-[#EAEAEA] disabled:text-[#626C65] disabled:cursor-not-allowed",
  secondary: "rounded-md px-4 py-2 text-sm font-medium border border-[#EAEAEA] bg-white text-[#121A14] hover:bg-[#EAF2EB] transition-all duration-150",
  danger: "rounded-md px-4 py-2 text-sm font-medium bg-[#FDEBEC] text-[#9F2F2D] border border-[#9F2F2D]/20 hover:bg-[#9F2F2D]/10 transition-all duration-150",
}

// Badge classes
export const BADGE = {
  success: "rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase bg-[#EAF2EB] text-[#1B4324]",
  warning: "rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase bg-[#FBF3DB] text-[#956400]",
  error: "rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase bg-[#FDEBEC] text-[#9F2F2D]",
  info: "rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase bg-[#E1F3FE] text-[#1F6C9F]",
  neutral: "rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase bg-[#F3F4F6] text-[#626C65]",
}

// Card
export const CARD = "border border-[#EAEAEA] rounded-xl p-6 bg-white"

// Page layout
export const PAGE = {
  wrapper: "w-full max-w-[1400px] mx-auto px-6 sm:px-8 py-8 transition-all duration-300",
  header: "pb-6 border-b border-[#EAEAEA] mb-6",
}
