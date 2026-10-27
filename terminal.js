// Interactive terminal, CTF, and the dev tools greeting.
// Loaded after script.js and uses its toggleWizardMode(), spark(), say(), and canvas.

const out = document.getElementById("term-out");
const form = document.getElementById("term-form");
const input = document.getElementById("term-input");
const cmdHistory = [];
let historyPos = 0;
let busy = false;

// ---------- Output helpers ----------

// Each part is a string, or { text, cls } / { text, href } for styled spans and links.
function print(...parts) {
    const line = document.createElement("div");
    for (const part of parts) {
        if (typeof part === "string") {
            line.append(part);
        } else if (part.href) {
            const a = document.createElement("a");
            a.href = part.href;
            a.textContent = part.text;
            if (part.href.startsWith("http")) {
                a.target = "_blank";
                a.rel = "noopener";
            }
            line.append(a);
        } else {
            const span = document.createElement("span");
            span.className = part.cls;
            span.textContent = part.text;
            line.append(span);
        }
    }
    out.append(line);
    out.scrollTop = out.scrollHeight;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- CTF ----------

// SHA-256 hashes, so reading this file doesn't give the flags away
const FLAGS = [
    { name: "the source", hash: "4ea00c3239fd336646d0bb339396c672396ae20fba65f4e6394fa5732534206b", hint: "Every page has a version only browsers are meant to read. Try Ctrl+U." },
    { name: "the robots", hash: "ae789a7e7363ea76c82e9e21b06e0b1d60dc5e2fa22c1446db9e8be265b7ce32", hint: "Search engines get their own instructions. What does /robots.txt tell them to stay out of?" },
    { name: "the console", hash: "d7ba614676b457e3e6c432df3d5965368400fd07723d23b85ddbbba4e8e781c3", hint: "Press F12 and read what the wizard left in the console. Encoded isn't the same as encrypted." },
    { name: "the cipher", hash: "b65e0fce9a5213970378409f56d47fccbed8a965cba92fa0dce33460d82bbf79", hint: "Not every file shows up in a plain `ls`. Some people's salads are older than others." }
];

function loadFound() {
    try {
        return JSON.parse(localStorage.getItem("ctf-found")) || [];
    } catch (e) {
        return [];
    }
}

let found = loadFound();

function saveFound() {
    try {
        localStorage.setItem("ctf-found", JSON.stringify(found));
    } catch (e) {
        // Progress just won't persist
    }
}

async function sha256(text) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

function showCtfBadge() {
    const badge = document.querySelector(".ctf-badge");
    if (badge && found.length === FLAGS.length) {
        badge.hidden = false;
    }
}

const ps1 = () => `${found.length === FLAGS.length ? "archmage" : "guest"}@benpolston:~$`;

// Gold theme, coin rain, and archmage@ prompt. The class is restored on later visits by the inline script in <head>.
function setArchmage(on) {
    root.classList.toggle("archmage", on);
    readAccent();
    document.querySelector(".term-ps1").textContent = ps1();
    if (reduceMotion) {
        draw(false);
    }
}

function burst(count, speed) {
    if (!reduceMotion) {
        const rect = input.getBoundingClientRect();
        for (let i = 0; i < count; i++) {
            spark(rect.left + 120, rect.top, speed, 3);
        }
    }
}

async function submitFlag(guess) {
    if (!guess) {
        print({ text: "usage: flag <answer>   e.g. flag flag{...}", cls: "dim" });
        return;
    }
    if (!window.crypto?.subtle) {
        print({ text: "flag checking needs HTTPS. Try https://www.benpolston.com", cls: "err" });
        return;
    }
    const hash = await sha256(guess.trim());
    const index = FLAGS.findIndex((f) => f.hash === hash);
    if (index === -1) {
        print({ text: "✗ Not a valid flag. Keep digging. (`hint` if you're stuck)", cls: "err" });
        return;
    }
    if (found.includes(index)) {
        print({ text: `You already captured flag ${index + 1} (${FLAGS[index].name}).`, cls: "dim" });
        return;
    }
    found.push(index);
    saveFound();
    print({ text: `✓ Flag ${index + 1} captured: ${FLAGS[index].name}  [${found.length}/${FLAGS.length}]`, cls: "ok" });
    burst(40, 5);
    if (found.length === FLAGS.length) {
        await sleep(400);
        print("");
        print({ text: "★ ALL FLAGS CAPTURED ★", cls: "gold" });
        print("You've earned the title of Archmage. The site is now gilded in your honor,");
        print("and a new badge has appeared in the footer.");
        setArchmage(true);
        burst(200, 11);
        say("★ CTF cleared: Archmage unlocked");
        showCtfBadge();
    }
}

function showFlags() {
    print(`CTF progress: ${found.length}/${FLAGS.length}`);
    FLAGS.forEach((f, i) => {
        print(found.includes(i) ? { text: `  [✓] ${i + 1}. ${f.name}`, cls: "ok" } : { text: `  [ ] ${i + 1}. ${f.name}`, cls: "dim" });
    });
    if (found.length < FLAGS.length) {
        print({ text: "Submit with `flag <answer>`. Stuck? Try `hint`.", cls: "dim" });
    }
}

function showHint(n) {
    let index = Number(n) - 1;
    if (!(index >= 0 && index < FLAGS.length)) {
        index = FLAGS.findIndex((_, i) => !found.includes(i));
    }
    if (index === -1) {
        print({ text: "You've found every flag. No hints left to give, Archmage.", cls: "gold" });
        return;
    }
    print({ text: `hint ${index + 1} (${FLAGS[index].name}): `, cls: "gold" }, FLAGS[index].hint);
}

// ---------- Commands ----------

const FILES = {
    "resume.pdf": () => print({ text: "%PDF-1.7 ����� binary soup. Try `resume` instead.", cls: "dim" }),
    "contact.txt": () => commands.contact.run(),
    ".secret": () => {
        print("synt{ebg13_vf_n_pnrfne_fnynq}");
        print({ text: "(Looks scrambled. Julius would know what to do.)", cls: "dim" });
    }
};

// A command shows in help and tab completion if it has a desc and, when it has a `when` check, that check passes
const listed = (cmd) => cmd.desc && (!cmd.when || cmd.when());
const ctfComplete = () => found.length === FLAGS.length;

const commands = {
    help: {
        desc: "list commands",
        run() {
            print("Available commands:");
            for (const [name, cmd] of Object.entries(commands)) {
                if (listed(cmd)) {
                    print({ text: `  ${name.padEnd(10)}`, cls: "gold" }, cmd.desc);
                }
            }
            print({ text: "There are a few hidden ones too. And 4 flags hidden around the site. Type `flags`.", cls: "dim" });
        }
    },
    whoami: {
        desc: "who's this guy?",
        run() {
            print("You're guest. But if you mean me:");
            print("Benjamin M. Lee-Polston: cybersecurity student at WGU (B.S., expected 2027) with 8+ years");
            print("in IT: endpoint security, identity, and infrastructure. Security+ certified. Charleston, WV.");
        }
    },
    resume: {
        desc: "open my resume (PDF)",
        run() {
            print("Opening ", { text: "resume.pdf", href: "/resume.pdf" }, "...");
            window.open("/resume.pdf", "_blank", "noopener");
        }
    },
    projects: {
        desc: "things I've built",
        run() {
            print({ text: "vox-reader      ", cls: "gold" }, "EPUB reader with natural AI voices, in the browser  ", { text: "vox.benpolston.com", href: "https://vox.benpolston.com/" });
            print({ text: "benpolston.com  ", cls: "gold" }, "this site, hand-coded, hidden CTF included  ", { text: "source", href: "https://github.com/benpolston/benpolston111.github.io" });
        }
    },
    skills: {
        desc: "what I work with",
        run() {
            print({ text: "security   ", cls: "gold" }, "Sophos EDR, Defender, Entra ID, MFA, Wireshark, Nmap, Burp Suite");
            print({ text: "network    ", cls: "gold" }, "Sophos XG, SonicWall, UniFi, TCP/IP, DNS, DHCP, VPN, Active Directory");
            print({ text: "ops        ", cls: "gold" }, "ConnectWise, Syncro, Lansweeper, MDM, PowerShell, Bash, Python");
            print({ text: "certs      ", cls: "gold" }, "Security+, Network+, A+, Project+, Linux Essentials, ITIL v4, SSCP (in progress)");
        }
    },
    contact: {
        desc: "how to reach me",
        run() {
            print({ text: "email      ", cls: "gold" }, { text: "ben@benpolston.com", href: "mailto:ben@benpolston.com" });
            print({ text: "linkedin   ", cls: "gold" }, { text: "in/benjamin-lee-polston-84644816a", href: "https://www.linkedin.com/in/benjamin-lee-polston-84644816a" });
            print({ text: "github     ", cls: "gold" }, { text: "github.com/benpolston", href: "https://github.com/benpolston" });
        }
    },
    ls: {
        desc: "list files",
        run(args) {
            const all = args.some((a) => a.startsWith("-") && a.includes("a"));
            if (args.includes("projects") || args.includes("projects/")) {
                print("vox-reader/  benpolston.com/");
                return;
            }
            print(all ? ".  ..  .secret  contact.txt  projects/  resume.pdf" : "contact.txt  projects/  resume.pdf");
        }
    },
    cat: {
        desc: "read a file",
        run(args) {
            const name = (args[0] || "").replace(/^\.\//, "");
            if (!name) {
                print({ text: "usage: cat <file>", cls: "dim" });
            } else if (FILES[name]) {
                FILES[name]();
            } else if (name.startsWith("projects")) {
                print({ text: `cat: ${name}: Is a directory`, cls: "err" });
            } else {
                print({ text: `cat: ${name}: No such file or directory`, cls: "err" });
            }
        }
    },
    flags: { desc: "CTF progress", run: showFlags },
    flag: { desc: "submit a flag: flag <answer>", run: (args) => submitFlag(args.join(" ")) },
    hint: { desc: "get a CTF hint", run: (args) => showHint(args[0]) },
    reset: {
        desc: "wipe CTF progress and play again",
        when: ctfComplete,
        run() {
            found = [];
            saveFound();
            setArchmage(false);
            document.querySelector(".ctf-badge").hidden = true;
            print({ text: "CTF progress wiped. The gold fades... 4 flags are hidden once more.", cls: "dim" });
            say("CTF reset: good luck, apprentice");
        }
    },
    cast: { desc: "toggle wizard mode", run: () => toggleWizardMode() },
    clear: { desc: "clear the screen", run: () => out.replaceChildren() },
    history: {
        desc: "command history",
        run() {
            cmdHistory.forEach((h, i) => print({ text: `  ${String(i + 1).padStart(3)}  `, cls: "dim" }, h));
        }
    },

    // Hidden commands (no desc, so they don't show in help)
    wizard: { run: () => toggleWizardMode() },
    sudo: {
        run(args) {
            if (args.join(" ").includes("sandwich")) {
                print("Okay.");
            } else {
                print({ text: "guest is not in the sudoers file. This incident will be reported.", cls: "err" });
            }
        }
    },
    rm: {
        run(args) {
            if (args.includes("-rf") || args.includes("-fr")) {
                print({ text: "rm: Permission denied. Also, rude.", cls: "err" });
            } else {
                print({ text: "rm: nothing here you're allowed to delete.", cls: "err" });
            }
        }
    },
    cd: { run: () => print({ text: "There's nowhere to go. It's a one-page site.", cls: "dim" }) },
    exit: { run: () => print({ text: "There is no escape. (Closing the tab works, though.)", cls: "dim" }) },
    echo: { run: (args) => print(args.join(" ")) },
    date: { run: () => print(new Date().toString()) },
    ping: {
        async run() {
            for (let i = 0; i < 3; i++) {
                print(`64 bytes from benpolston.com: icmp_seq=${i + 1} ttl=64 time=${(Math.random() * 20 + 8).toFixed(1)} ms`);
                await sleep(350);
            }
            print({ text: "Host is up. For a reply from a human, try `contact`.", cls: "dim" });
        }
    },
    nmap: {
        async run() {
            print("Starting Nmap 7.95 ( https://nmap.org )");
            await sleep(600);
            print("PORT     STATE     SERVICE");
            print("22/tcp   filtered  ssh");
            print("80/tcp   open      http   → redirects to 443");
            print("443/tcp  open      https");
            await sleep(300);
            print({ text: "Scanning this site is fine. Scanning anyone else's needs permission.", cls: "dim" });
        }
    },
    ssh: { run: () => print({ text: "ssh: connect to host benpolston.com port 22: Connection refused. Good.", cls: "err" }) },
    coffee: { run: () => print("☕ Brewing... energy drink detected instead. +10 INT.") },
    hack: {
        async run() {
            const steps = [
                "[*] Initializing totally-real exploit framework...",
                "[*] Bypassing firewall (it's a CSS file)...",
                "[*] Decrypting mainframe...",
                "[*] Enhancing... enhancing...",
                "[*] Downloading more RAM..."
            ];
            for (const step of steps) {
                print({ text: step, cls: "ok" });
                await sleep(450);
            }
            print("");
            const progress = out.lastChild;
            for (let i = 0; i <= 20; i++) {
                progress.textContent = `[${"█".repeat(i)}${"░".repeat(20 - i)}] ${i * 5}%`;
                await sleep(60);
            }
            print({ text: "[+] ACCESS GRANTED", cls: "gold" });
            await sleep(400);
            print({ text: "...to a public website you could already read. Want the real thing? Try `flags`.", cls: "dim" });
        }
    },
    man: { run: () => print({ text: "No manual entry. Try `help`.", cls: "dim" }) }
};
commands.sl = { run: () => print("🚂 choo choo. (You meant `ls`.)") };
commands["?"] = commands.help;

async function execute(raw) {
    const line = raw.trim();
    // The prompt is baked into each line, so scrollback shows guest@ before the CTF and archmage@ after
    print({ text: `${ps1()} `, cls: "ps1" }, { text: line, cls: "cmd" });
    if (!line) {
        return;
    }
    cmdHistory.push(line);
    historyPos = cmdHistory.length;
    const [name, ...args] = line.split(/\s+/);
    const cmd = commands[name.toLowerCase()];
    if (!cmd) {
        print({ text: `command not found: ${name}. Type \`help\` for a list.`, cls: "err" });
        return;
    }
    busy = true;
    input.disabled = true;
    try {
        await cmd.run(args);
    } finally {
        busy = false;
        input.disabled = false;
        input.focus();
    }
}

form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) {
        return;
    }
    const value = input.value;
    input.value = "";
    execute(value);
});

input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && cmdHistory.length) {
        e.preventDefault();
        historyPos = Math.max(0, historyPos - 1);
        input.value = cmdHistory[historyPos];
    } else if (e.key === "ArrowDown" && cmdHistory.length) {
        e.preventDefault();
        historyPos = Math.min(cmdHistory.length, historyPos + 1);
        input.value = cmdHistory[historyPos] ?? "";
    } else if (e.key === "Tab" && input.value && !input.value.includes(" ")) {
        // Complete visible command names only, so hidden ones stay hidden
        const matches = Object.keys(commands).filter((c) => listed(commands[c]) && c.startsWith(input.value));
        if (matches.length === 1) {
            e.preventDefault();
            input.value = matches[0] + " ";
        }
    } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        out.replaceChildren();
    }
});

// Clicking anywhere in the terminal area focuses the prompt
document.querySelector(".term-io").addEventListener("click", (e) => {
    if (!e.target.closest("a") && !window.getSelection().toString()) {
        input.focus();
    }
});

showCtfBadge();
document.querySelector(".term-ps1").textContent = ps1();

// ---------- Dev tools greeting (and flag 3) ----------

console.log(
    "%c" +
        "        /\\\n" +
        "       /  \\\n" +
        "      / ✦  \\\n" +
        "     /______\\\n" +
        "     ( o  o )\n" +
        "      \\ ~~ /\n" +
        "    ___\\__/___",
    "color:#a77bf3;font-family:monospace;font-size:14px;line-height:1.2"
);
console.log("%cWell met, fellow tinkerer.", "color:#fde68a;font-size:16px;font-weight:bold");
console.log("%cHiring for security or networking? ben@benpolston.com", "color:#d7dbe4;font-size:13px");
console.log(
    "%cThere are 4 flags hidden on this site. Here's one, encoded:\n%cZmxhZ3tiYXNlNjRfaXNfbm90X2VuY3J5cHRpb259\n%c(atob() is right there.)",
    "color:#8a91a3",
    "color:#6ee7b7;font-family:monospace;font-size:13px",
    "color:#8a91a3"
);
