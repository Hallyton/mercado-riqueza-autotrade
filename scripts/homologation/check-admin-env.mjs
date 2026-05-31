import fs from "fs";

const lines = fs.readFileSync(".env.staging.pull", "utf8").split(/\r?\n/);
function get(k) {
  const line = lines.find((l) => l.startsWith(`${k}=`));
  if (!line) return "";
  let v = line.slice(k.length + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

console.log("ADMIN_EMAIL:", get("ADMIN_EMAIL") || "EMPTY");
console.log("ADMIN_PASSWORD:", get("ADMIN_PASSWORD") ? `SET(len=${get("ADMIN_PASSWORD").length})` : "EMPTY");
