export const RECEIPT_DESIGN = {
  canvas: {
    width: 1080,
    margin: 54,
    radius: 16,
  },
  colors: {
    background: "#f8fafc",
    white: "#ffffff",
    strong: "#172033",
    primary: "#2563c7",
    muted: "#667085",
    border: "#dbe3ee",
    secondary: "#eef4fb",
    mutedBg: "#f3f6fa",
    collect: "#24724d",
    collectSoft: "#edf8f1",
    collectBorder: "#cce6d6",
    collectIcon: "#dff1e6",
    pay: "#b54747",
    paySoft: "#fdf0f0",
    payBorder: "#efcece",
    payIcon: "#f6dddd",
    live: "#2f7555",
    liveSoft: "#eef8f2",
    liveIcon: "#dff1e6",
    dead: "#985555",
    deadSoft: "#fbf0f0",
    deadIcon: "#f6e2e2",
  },
  typography: {
    title: 47,
    member: 38,
    section: 35,
    body: 29,
    meta: 23,
    money: 50,
  },
} as const

export const RECEIPT_WEB = {
  action: {
    collect: "border-success/25 bg-success-soft text-success-foreground",
    pay: "border-danger/25 bg-danger-soft text-danger-foreground",
    neutral: "border-border bg-muted text-muted-foreground",
  },
  icon: {
    collect: "bg-success/10 text-success-foreground",
    pay: "bg-danger/10 text-danger-foreground",
    neutral: "bg-secondary text-muted-foreground",
  },
} as const

export async function getReceiptCanvasFontFamily() {
  await document.fonts.ready

  const rootStyle = getComputedStyle(document.documentElement)
  const bodyStyle = getComputedStyle(document.body)
  const loadedFamily = rootStyle
    .getPropertyValue("--font-be-vietnam-pro")
    .trim()

  return loadedFamily || bodyStyle.fontFamily || "system-ui, sans-serif"
}
