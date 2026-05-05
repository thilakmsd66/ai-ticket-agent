"""Generate a clean technical architecture diagram (PNG + SVG) for IntelliTriage."""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT_PNG = Path(__file__).parent / "docs" / "architecture-diagram.png"
OUT_SVG = Path(__file__).parent / "docs" / "architecture-diagram.svg"
OUT_PNG.parent.mkdir(parents=True, exist_ok=True)

BG = "#0E1230"
PANEL = "#1A1F55"
PANEL_LITE = "#262D73"
TEXT = "#F4F7FF"
TEXT_DIM = "#B7C0E8"
ACCENTS = {
    "user":     "#5EC8FF",
    "frontend": "#A87BFF",
    "backend":  "#35E0C1",
    "ai":       "#FFB14A",
    "data":     "#FF6FA8",
    "infra":    "#7CE38B",
}
EMOJI_FONT = "Segoe UI Emoji"

fig, ax = plt.subplots(figsize=(20, 13))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.set_axis_off()

ax.text(50, 97.5, "IntelliTriage — Technical Architecture",
        ha="center", va="center", color=TEXT, fontsize=22, fontweight="bold")
ax.text(50, 94.5, "Layered view of the AI-powered internal ticketing platform",
        ha="center", va="center", color=TEXT_DIM, fontsize=12)

LAYER_GAP = 1.6
BAND_PAD_TOP = 3.4
CARD_BOTTOM_PAD = 1.0
CARD_H = 7.5
BAND_H = BAND_PAD_TOP + CARD_H + CARD_BOTTOM_PAD

TOP_Y = 90
def band_y(index):
    return TOP_Y - (index + 1) * BAND_H - index * LAYER_GAP


def layer_band(index, label, accent):
    y = band_y(index)
    band = FancyBboxPatch((1.5, y), 97, BAND_H,
                          boxstyle="round,pad=0.3,rounding_size=1.0",
                          linewidth=1.2, edgecolor=accent,
                          facecolor=PANEL, alpha=0.55)
    ax.add_patch(band)
    chip_w = max(len(label) * 0.85 + 3.2, 18)
    tag = FancyBboxPatch((3.0, y + BAND_H - 2.6), chip_w, 1.9,
                         boxstyle="round,pad=0.2,rounding_size=0.6",
                         linewidth=0, facecolor=accent, alpha=0.95)
    ax.add_patch(tag)
    ax.text(3.0 + chip_w / 2, y + BAND_H - 1.65, label, color="#0E1230",
            fontsize=10, fontweight="bold", ha="center", va="center")
    return y


def card(band_y_value, x, w, icon, title, lines, accent):
    y = band_y_value + CARD_BOTTOM_PAD
    box = FancyBboxPatch((x, y), w, CARD_H,
                         boxstyle="round,pad=0.3,rounding_size=0.8",
                         linewidth=1.4, edgecolor=accent,
                         facecolor=PANEL_LITE)
    ax.add_patch(box)
    chip_r = 1.3
    cx, cy = x + 1.9, y + CARD_H - 1.8
    chip = mpatches.Circle((cx, cy), chip_r, facecolor=accent,
                           edgecolor=accent, zorder=3)
    ax.add_patch(chip)
    ax.text(cx, cy, icon, ha="center", va="center", color="#0E1230",
            fontsize=11, fontweight="bold", fontfamily=EMOJI_FONT)
    ax.text(x + 4.0, y + CARD_H - 1.6, title, color=TEXT,
            fontsize=11, fontweight="bold", va="top")
    for i, line in enumerate(lines):
        ax.text(x + 1.2, y + CARD_H - 3.6 - i * 1.5, f"• {line}",
                color=TEXT_DIM, fontsize=9, va="top")
    return {"top": (x + w / 2, y + CARD_H), "bottom": (x + w / 2, y),
            "left": (x, y + CARD_H / 2), "right": (x + w, y + CARD_H / 2)}


def arrow(p1, p2, color=TEXT_DIM, lw=1.3, alpha=0.95):
    arr = FancyArrowPatch(p1, p2, arrowstyle="-|>", mutation_scale=14,
                          color=color, linewidth=lw, alpha=alpha,
                          shrinkA=4, shrinkB=4)
    ax.add_patch(arr)


def slots(n, margin=4.5):
    width = (100 - 2 * margin)
    gap = 1.5
    w = (width - gap * (n - 1)) / n
    return [(margin + i * (w + gap), w) for i in range(n)]


LAYERS = [
    ("USER LAYER",              ACCENTS["user"]),
    ("PRESENTATION LAYER",      ACCENTS["frontend"]),
    ("APPLICATION / API LAYER", ACCENTS["backend"]),
    ("AI / INTELLIGENCE LAYER", ACCENTS["ai"]),
    ("DATA LAYER",              ACCENTS["data"]),
    ("INFRASTRUCTURE LAYER",    ACCENTS["infra"]),
]
band_ys = [layer_band(i, name, color) for i, (name, color) in enumerate(LAYERS)]

# 0 USER LAYER
positions = slots(3)
user_b = card(band_ys[0], *positions[0], "👤", "Business User",
              ["Web browser (Chrome/Edge)", "Voice + text input"], ACCENTS["user"])
admin_b = card(band_ys[0], *positions[1], "🛡", "Admin User",
               ["Reviews tickets & feedback", "Role-based access"], ACCENTS["user"])
voice_b = card(band_ys[0], *positions[2], "🎙", "Voice Channel",
               ["Web Speech API", "Hands-free clarification"], ACCENTS["user"])

# 1 PRESENTATION LAYER
positions = slots(4)
spa_b = card(band_ys[1], *positions[0], "⚛", "React + Vite SPA",
             ["TicketAgentPage", "Dashboard, History, Auth"], ACCENTS["frontend"])
ux_b = card(band_ys[1], *positions[1], "🎨", "UI / UX",
            ["Material Symbols", "Animated clarification UI"], ACCENTS["frontend"])
nginx_b = card(band_ys[1], *positions[2], "🌐", "Nginx Static",
               ["Serves built assets", "Port 3000"], ACCENTS["frontend"])
client_b = card(band_ys[1], *positions[3], "🔌", "API Client",
                ["fetch + JWT", "Trimmed history payload"], ACCENTS["frontend"])

# 2 APPLICATION / API LAYER
positions = slots(4)
fastapi_b = card(band_ys[2], *positions[0], "⚙", "FastAPI App",
                 ["Uvicorn :8080", "CORS allow-list"], ACCENTS["backend"])
chat_b = card(band_ys[2], *positions[1], "💬", "/chat Orchestrator",
              ["Clarification + classification", "Token-optimized flow"], ACCENTS["backend"])
ticket_b = card(band_ys[2], *positions[2], "🎫", "Ticket Service",
                ["CRUD + cancel", "Feedback capture"], ACCENTS["backend"])
auth_b = card(band_ys[2], *positions[3], "🔐", "Auth Service",
              ["JWT + bcrypt", "Register / verify / reset"], ACCENTS["backend"])

# 3 AI / INTELLIGENCE LAYER
positions = slots(4)
clar_b = card(band_ys[3], *positions[0], "🧠", "Clarification Agent",
              ["4-item clarity checklist", "Targeted single question"], ACCENTS["ai"])
class_b = card(band_ys[3], *positions[1], "🎯", "Classification Agent",
               ["Team routing + P1–P4", "Strict JSON output"], ACCENTS["ai"])
guard_b = card(band_ys[3], *positions[2], "🛟", "Guardrails",
               ["Word-boundary signals", "Bidirectional override"], ACCENTS["ai"])
aicafe_b = card(band_ys[3], *positions[3], "☁", "HCL AICafe",
                ["gpt-4.1 deployment", "Retry + token caps"], ACCENTS["ai"])

# 4 DATA LAYER
positions = slots(4)
db_b = card(band_ys[4], *positions[0], "🗄", "SQLite (tickets.db)",
            ["Users · Tickets · Feedback", "SQLAlchemy ORM"], ACCENTS["data"])
analytics_b = card(band_ys[4], *positions[1], "📊", "Analytics Read-Model",
                   ["Volume · priority trends", "Powers dashboard"], ACCENTS["data"])
smtp_b = card(band_ys[4], *positions[2], "📨", "SMTP (Brevo)",
              ["Verify + reset emails", "FROM_EMAIL config"], ACCENTS["data"])
health_b = card(band_ys[4], *positions[3], "🩺", "Health Telemetry",
                ["/health/aicafe", "Live AI reachability"], ACCENTS["data"])

# 5 INFRASTRUCTURE LAYER
positions = slots(4)
podman_b = card(band_ys[5], *positions[0], "🐳", "Podman Containers",
                ["ai-ticket-backend", "ai-ticket-frontend"], ACCENTS["infra"])
net_b = card(band_ys[5], *positions[1], "🕸", "Bridge Network",
             ["ai-ticket-net", "Internal service DNS"], ACCENTS["infra"])
secret_b = card(band_ys[5], *positions[2], "🔧", "Config & Secrets",
                [".env (excluded from git)", "FRONTEND_ORIGINS, JWT_SECRET"], ACCENTS["infra"])
build_b = card(band_ys[5], *positions[3], "📦", "Build Pipeline",
               ["podman build (BE/FE)", "Vite production bundle"], ACCENTS["infra"])

# Cross-layer flow arrows
arrow(user_b["bottom"], spa_b["top"], ACCENTS["user"])
arrow(admin_b["bottom"], ux_b["top"], ACCENTS["user"])
arrow(voice_b["bottom"], client_b["top"], ACCENTS["user"])
arrow(client_b["bottom"], chat_b["top"], ACCENTS["frontend"])
arrow(spa_b["bottom"], fastapi_b["top"], ACCENTS["frontend"])
arrow(chat_b["bottom"], clar_b["top"], ACCENTS["backend"])
arrow(chat_b["bottom"], class_b["top"], ACCENTS["backend"])
arrow(clar_b["right"], aicafe_b["left"], ACCENTS["ai"], alpha=0.7)
arrow(class_b["right"], aicafe_b["left"], ACCENTS["ai"], alpha=0.7)
arrow(ticket_b["bottom"], db_b["top"], ACCENTS["backend"])
arrow(auth_b["bottom"], smtp_b["top"], ACCENTS["backend"])
arrow(db_b["bottom"], podman_b["top"], ACCENTS["data"], alpha=0.55)
arrow(health_b["bottom"], build_b["top"], ACCENTS["data"], alpha=0.55)

ax.text(50, 3.5, "Flow:  User  →  Frontend  →  API  →  AI / Data  →  Response",
        ha="center", va="center", color=TEXT_DIM, fontsize=11)
ax.text(50, 1.6,
        "AI: HCL AICafe (gpt-4.1)   •   API: FastAPI/Uvicorn :8080   •   UI: React + Vite via Nginx :3000   •   Storage: SQLite   •   Runtime: Podman",
        ha="center", va="center", color=TEXT_DIM, fontsize=9)

plt.tight_layout(pad=0.5)
fig.savefig(OUT_PNG, dpi=180, facecolor=BG, bbox_inches="tight")
fig.savefig(OUT_SVG, facecolor=BG, bbox_inches="tight")
print(f"Created: {OUT_PNG}")
print(f"Created: {OUT_SVG}")
