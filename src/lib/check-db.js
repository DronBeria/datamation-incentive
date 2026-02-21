const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "../../data/incentives.db");
const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("TABLES:", tables.map(t => t.name).join(", "));

const schemes = db.prepare("SELECT name, calculation_type FROM incentive_schemes").all();
console.log("SCHEMES:", JSON.stringify(schemes));

const sales = db.prepare("SELECT client_name, calculated_commission, status FROM sales_logs").all();
console.log("SALES:", JSON.stringify(sales));
