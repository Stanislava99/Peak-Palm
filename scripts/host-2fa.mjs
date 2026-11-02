// Creates a secret for the host page's 6-digit login code.
// Run:  npm run host:2fa
// Then: 1) add the secret to your authenticator app (Google Authenticator, 1Password, Authy…)
//       2) set HOST_TOTP_SECRET to the same value in .env.local and in Vercel.
import { randomBytes } from "crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const bytes = randomBytes(20);
let bits = "";
for (const b of bytes) bits += b.toString(2).padStart(8, "0");
let secret = "";
for (let i = 0; i + 5 <= bits.length; i += 5) secret += alphabet[parseInt(bits.slice(i, i + 5), 2)];

const label = encodeURIComponent("Peak & Palm Villas:host");
console.log("\nHOST_TOTP_SECRET=" + secret);
console.log("\nIn your authenticator app choose “Enter a setup key” and paste the secret above,");
console.log("or open this link on your phone:\n");
console.log(`otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Peak & Palm Villas")}&digits=6&period=30\n`);
console.log("Keep the secret private. Anyone with it can generate login codes.\n");
