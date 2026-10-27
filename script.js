const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const isWizard = () => root.classList.contains("wizard-mode");

// ---------- Spellbook text swaps ----------

function applyWizardText() {
    document.querySelectorAll("[data-wizard]").forEach((el) => {
        el.dataset.normal ??= el.textContent;
        el.textContent = isWizard() ? el.dataset.wizard : el.dataset.normal;
    });
}

applyWizardText();

// ---------- Rain (a nod to the old rainy-bg.gif) that turns to falling stars in wizard mode ----------

const canvas = document.getElementById("rain");
const ctx = canvas.getContext("2d");
// Sparks (burst + wand trail) draw on their own layer above the content
const sparkCanvas = document.createElement("canvas");
sparkCanvas.id = "sparks";
sparkCanvas.setAttribute("aria-hidden", "true");
document.body.appendChild(sparkCanvas);
const sctx = sparkCanvas.getContext("2d");
const GOLD = "253, 230, 138";
let drops = [];
let sparks = [];
let rainRgb = "";

function readAccent() {
    rainRgb = getComputedStyle(root).getPropertyValue("--accent-rgb").trim();
}

function resize() {
    canvas.width = sparkCanvas.width = window.innerWidth;
    canvas.height = sparkCanvas.height = window.innerHeight;
    const count = Math.round(canvas.width / 9);
    drops = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        len: 8 + Math.random() * 18,
        speed: 4 + Math.random() * 7,
        alpha: 0.05 + Math.random() * 0.15,
        gold: Math.random() < 0.35,
        phase: Math.random() * Math.PI * 2
    }));
    if (reduceMotion) {
        draw(false);
    }
}

function star(c, x, y, r, rgb, alpha) {
    c.fillStyle = `rgba(${rgb}, ${alpha})`;
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
    c.fill();
}

// A spinning coin: squash its width with cos() so it looks like it's flipping
function coin(x, y, r, spin, alpha) {
    const w = Math.max(0.12, Math.abs(Math.cos(spin))) * r;
    ctx.fillStyle = `rgba(245, 197, 66, ${alpha})`;
    ctx.strokeStyle = `rgba(150, 105, 20, ${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y, w, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (w > r * 0.45) {
        ctx.strokeStyle = `rgba(${GOLD}, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.ellipse(x, y, w * 0.62, r * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function draw(move) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const wizard = isWizard();
    const archmage = root.classList.contains("archmage");
    const t = performance.now() / 1000;

    for (const d of drops) {
        if (archmage) {
            // Only about a third of the drops become coins, so it doesn't get cluttered
            if (d.gold) {
                coin(d.x, d.y, 4 + d.len / 5, t * (1.5 + d.speed / 4) + d.phase, 0.3 + d.alpha * 2.5);
            }
        } else if (wizard) {
            const twinkle = 0.5 + 0.5 * Math.sin(t * 3 + d.phase);
            star(ctx, d.x, d.y, 1.5 + d.len / 8, d.gold ? GOLD : rainRgb, (d.alpha * 2.5) * (0.4 + 0.6 * twinkle));
        } else {
            ctx.strokeStyle = `rgba(${rainRgb}, ${d.alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - 1, d.y + d.len);
            ctx.stroke();
        }
        if (move) {
            // In wizard mode the stars (or coins) float upward instead of falling
            d.y += wizard ? -d.speed / 6 : archmage ? d.speed / 3 : d.speed;
            d.x += wizard ? Math.sin(t + d.phase) * 0.3 : 0;
            if (d.y > canvas.height) {
                d.y = -d.len;
                d.x = Math.random() * canvas.width;
            } else if (d.y < -d.len) {
                d.y = canvas.height + d.len;
                d.x = Math.random() * canvas.width;
            }
        }
    }

    sctx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
    for (const s of sparks) {
        star(sctx, s.x, s.y, s.size * s.life, s.rgb, Math.min(1, s.life * 1.5));
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.04;
        s.vx *= 0.98;
        s.life -= s.decay;
    }
    sparks = sparks.filter((s) => s.life > 0);
}

function loop() {
    draw(true);
    requestAnimationFrame(loop);
}

function spark(x, y, speed, linger = 1) {
    const angle = Math.random() * Math.PI * 2;
    const v = Math.random() * speed;
    sparks.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - speed * 0.2,
        size: 2 + Math.random() * 4,
        life: 1,
        decay: (0.012 + Math.random() * 0.02) / linger,
        rgb: Math.random() < 0.5 ? GOLD : rainRgb
    });
}

readAccent();
resize();
window.addEventListener("resize", resize);

if (!reduceMotion) {
    loop();
    // Sparkle trail behind the wand cursor
    window.addEventListener("pointermove", (e) => {
        if (isWizard() && e.pointerType === "mouse" && sparks.length < 400) {
            spark(e.clientX, e.clientY, 1.5);
        }
    });
}

// ---------- Type out the prompt ----------

const prompt = document.querySelector(".prompt");
if (prompt && !reduceMotion) {
    prompt.textContent = "";
    let i = 0;
    const type = () => {
        // Re-read each tick so toggling wizard mode mid-type types the right text
        const text = isWizard() ? prompt.dataset.wizard : prompt.dataset.normal;
        prompt.textContent = text.slice(0, ++i);
        if (i < text.length) {
            setTimeout(type, 90 + Math.random() * 60);
        }
    };
    setTimeout(type, 400);
}

// ---------- Easter egg: ↑↑↓↓←→←→BA toggles wizard mode ----------

const toast = document.createElement("div");
toast.className = "toast";
toast.setAttribute("role", "status");
document.body.appendChild(toast);

function say(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(say.timer);
    say.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// The class is restored from localStorage by an inline script in <head>, before first paint.
function toggleWizardMode() {
    const on = root.classList.toggle("wizard-mode");
    try {
        if (on) {
            localStorage.setItem("wizard-mode", "on");
        } else {
            localStorage.removeItem("wizard-mode");
        }
    } catch (e) {
        // Storage blocked (private mode, etc.): the toggle still works for this visit.
    }
    readAccent();
    applyWizardText();
    if (on && !reduceMotion) {
        for (let i = 0; i < 220; i++) {
            spark(canvas.width / 2, canvas.height / 2, 11, 3);
        }
    }
    if (reduceMotion) {
        draw(false);
    }
    say(on ? "🧙 wizard mode: enabled" : "wizard mode: disabled");
}

const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let progress = 0;

document.addEventListener("keydown", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    progress = key === konami[progress] ? progress + 1 : (key === konami[0] ? 1 : 0);
    if (progress === konami.length) {
        progress = 0;
        toggleWizardMode();
    }
});

const spells = [
    "casting: sudo make-me-a-sandwich",
    "casting: nmap -sV localhost (just checking)",
    "casting: energy drink +10 INT",
    "casting: have you tried the power button?",
    "casting: chmod 777 nothing, ever"
];
let spell = 0;

document.querySelector(".wizard")?.addEventListener("click", (e) => {
    say(spells[spell++ % spells.length]);
    if (isWizard() && !reduceMotion) {
        for (let i = 0; i < 40; i++) {
            spark(e.clientX, e.clientY, 5);
        }
    }
});

// ---------- Section headings "decrypt" as they scroll into view ----------

const GLYPHS = "!<>-_\/[]{}=+*^?#01ABCDEF";

function decrypt(el) {
    const text = el.dataset.plain ??= el.textContent;
    const start = performance.now();
    const duration = 700;
    const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const solved = Math.floor(progress * text.length);
        el.textContent = text
            .split("")
            .map((ch, i) => (i < solved || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
            .join("");
        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    };
    requestAnimationFrame(tick);
}

if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                observer.unobserve(entry.target);
                decrypt(entry.target);
            }
        }
    }, { threshold: 1 });
    document.querySelectorAll(".section-title").forEach((el) => observer.observe(el));
}
