import { Elysia } from "elysia";

export const health = new Elysia({ prefix: "/health" }).get("/", () => ({
	status: "ok",
	uptime: process.uptime(),
	timestamp: new Date().toISOString(),
	backend: "sqlite",
}));
