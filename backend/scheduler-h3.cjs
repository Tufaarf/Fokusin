/**
 * Fokusin Node-cron Scheduler Pengingat H-3
 * Berjalan setiap hari pukul 07:00 pagi (cron: '0 7 * * *')
 * Menjalankan command artisan 'events:remind-h3'
 */

const { exec } = require("child_process");
const path = require("path");

let cron;
try {
  cron = require("node-cron");
} catch (e) {
  console.log(
    "[Scheduler] node-cron belum terinstall di node root/backend. Menjalankan fallback timer.",
  );
}

function runReminder() {
  console.log(
    `[${new Date().toISOString()}] [Scheduler H-3] Menjalankan pengecekan pengingat H-3, H-2, H-1...`,
  );

  const artisanPath = path.join(__dirname, "artisan");
  exec(`php "${artisanPath}" events:remind-h3`, (error, stdout, stderr) => {
    if (error) {
      console.error(`[Scheduler H-3] Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.warn(`[Scheduler H-3] Stderr: ${stderr}`);
    }
    console.log(`[Scheduler H-3] Output:\n${stdout}`);
  });
}

if (cron) {
  // Jadwal setiap hari pukul 07:00: 0 7 * * *
  console.log(
    "[Scheduler H-3] Scheduler aktif! Terjadwal setiap hari pukul 07:00 pagi (0 7 * * *).",
  );
  cron.schedule("0 7 * * *", () => {
    runReminder();
  });
} else {
  console.log("[Scheduler H-3] Berjalan sekali sekarang (test run):");
  runReminder();
}
