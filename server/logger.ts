import "winston-daily-rotate-file";
import config from "@server/lib/config";
import * as winston from "winston";

// helper to get ISO8601 string in the TZ from process.env.TZ
// This replaces the default Z (UTC) with the local offset from process.env.TZ
const isoLocal = () => {
    const tz = process.env.TZ || "UTC";
    const d = new Date();
    const s = d.toLocaleString("sv-SE", { timeZone: tz, hour12: false });
    const tzOffsetMin = d.getTimezoneOffset();
    const sign = tzOffsetMin <= 0 ? "+" : "-";
    const pad = (n: number) => String(n).padStart(2, "0");
    const hours = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
    const mins = pad(Math.abs(tzOffsetMin) % 60);

    // Replace Z in ISO string with local offset
    return s.replace(" ", "T") + `${sign}${hours}:${mins}`;
};

const hformat = winston.format.printf(
    ({ level, label, message, timestamp, stack, ...metadata }) => {
        let msg = `${timestamp} [${level}]${label ? `[${label}]` : ""}: ${message}`;
        if (stack) {
            msg += `\nStack: ${stack}`;
        }
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
    }
);

const transports: any = [new winston.transports.Console({})];

const logger = winston.createLogger({
    level: config.getRawConfig().app.log_level.toLowerCase(),
    format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.splat(),

        // Use isoLocal so timestamps respect TZ env, not just UTC
        winston.format.timestamp({ format: isoLocal }),
        hformat
    ),
    transports
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", { error, stack: error.stack });
    process.exit(1);
});

process.on("unhandledRejection", (reason, _) => {
    logger.error("Unhandled Rejection:", { reason });
});

export default logger;
