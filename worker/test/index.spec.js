import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

// These tests only check the Worker's own answers, so they don't need TheMealDB.
// Run them with: npm test
describe("Leftovers API", () => {
	it("explains itself at /", async () => {
		const response = await SELF.fetch("http://example.com/");
		const body = await response.json();
		expect(body.name).toBe("Leftovers API");
	});

	it("asks for items when ?items= is missing", async () => {
		const response = await SELF.fetch("http://example.com/recipes");
		expect(response.status).toBe(400);
	});

	it("answers 404 for unknown paths", async () => {
		const response = await SELF.fetch("http://example.com/nope");
		expect(response.status).toBe(404);
	});
});
