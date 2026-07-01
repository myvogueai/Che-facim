const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const imgDir = path.join(root, "public", "assets", "img");
fs.mkdirSync(imgDir, { recursive: true });

const html = fs.readFileSync(path.join(root, "public", "anteprima-stile.html"), "utf8");
const m = html.match(/src="data:image\/png;base64,([^"]+)"/);
if (!m) {
  console.error("logo base64 not found");
  process.exit(1);
}
const logoPath = path.join(imgDir, "logo-header.png");
fs.writeFileSync(logoPath, Buffer.from(m[1], "base64"));
console.log("logo-header.png:", fs.statSync(logoPath).size, "bytes");

// Placeholder: copiare da assets generati o lasciare invariato se già presente
const placeholderPath = path.join(root, "public", "assets", "placeholder-evento.jpg");
if (!fs.existsSync(placeholderPath)) {
  console.error("placeholder-evento.jpg mancante: aggiungerlo in public/assets/");
  process.exit(1);
}
console.log("placeholder-evento.jpg:", fs.statSync(placeholderPath).size, "bytes");
