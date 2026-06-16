import request from "supertest";
import { createApp } from "../../src/app";

describe("health routes", () => {
  it("returns the API health status", async () => {
    const response = await request(createApp()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        status: "ok"
      },
      meta: null,
      error: null
    });
  });
});
