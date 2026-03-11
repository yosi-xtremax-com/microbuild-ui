/**
 * ItemsService Unit Tests
 *
 * Tests the CRUD operations provided by ItemsService.
 * Mocks the api-request module that ItemsService imports internally.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so the mock fn is available when vi.mock factory runs
const { mockApiRequest } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
}));

// Mock the internal api-request module that items.ts imports
vi.mock("@buildpad/services", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  // Override apiRequest — ItemsService constructor calls this internally
  return {
    ...actual,
    apiRequest: mockApiRequest,
  };
});

// Also mock the relative import path that items.ts uses
vi.mock("../../services/src/api-request", () => ({
  apiRequest: mockApiRequest,
}));

import { ItemsService } from "../../services/src/items";

describe("ItemsService", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  // =========================================================================
  // readByQuery
  // =========================================================================
  describe("readByQuery", () => {
    it("should fetch items with default params", async () => {
      const mockData = {
        data: [{ id: 1, title: "Test" }],
        meta: { total_count: 1 },
      };
      mockApiRequest.mockResolvedValueOnce(mockData);

      const service = new ItemsService("posts");
      const result = await service.readByQuery();

      expect(mockApiRequest).toHaveBeenCalledOnce();
      expect(mockApiRequest.mock.calls[0][0]).toBe("/api/items/posts");
      expect(result.data).toEqual([{ id: 1, title: "Test" }]);
      expect(result.meta?.total_count).toBe(1);
    });

    it("should build query string with all params", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: [], meta: { total_count: 0 } });

      const service = new ItemsService("posts");
      await service.readByQuery({
        fields: ["id", "title"],
        filter: { status: { _eq: "published" } },
        search: "hello",
        sort: "-date_created",
        limit: 10,
        page: 2,
        meta: "total_count,filter_count",
      });

      const callUrl = mockApiRequest.mock.calls[0][0] as string;
      expect(callUrl).toContain("fields=id%2Ctitle");
      expect(callUrl).toContain("search=hello");
      expect(callUrl).toContain("sort=-date_created");
      expect(callUrl).toContain("limit=10");
      expect(callUrl).toContain("page=2");
      expect(callUrl).toContain("meta=total_count%2Cfilter_count");
    });

    it("should handle flat array response", async () => {
      mockApiRequest.mockResolvedValueOnce([
        { id: 1, title: "Test" },
        { id: 2, title: "Test 2" },
      ]);

      const service = new ItemsService("posts");
      const result = await service.readByQuery();

      expect(result.data).toHaveLength(2);
      expect(result.meta?.total_count).toBe(2);
    });
  });

  // =========================================================================
  // readOne
  // =========================================================================
  describe("readOne", () => {
    it("should fetch a single item by id", async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: { id: 1, title: "Test", status: "draft" },
      });

      const service = new ItemsService("posts");
      const result = await service.readOne(1);

      expect(mockApiRequest).toHaveBeenCalledOnce();
      expect(mockApiRequest.mock.calls[0][0]).toBe("/api/items/posts/1");
      expect(result).toEqual({ id: 1, title: "Test", status: "draft" });
    });

    it("should include fields parameter when specified", async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: { id: 1, title: "Test" },
      });

      const service = new ItemsService("posts");
      await service.readOne(1, ["id", "title"]);

      expect(mockApiRequest.mock.calls[0][0]).toContain("fields=id,title");
    });

    it("should handle flat item response (no data wrapper)", async () => {
      mockApiRequest.mockResolvedValueOnce({ id: 5, title: "Flat" });

      const service = new ItemsService("posts");
      const result = await service.readOne(5);

      expect(result).toEqual({ id: 5, title: "Flat" });
    });
  });

  // =========================================================================
  // createOne
  // =========================================================================
  describe("createOne", () => {
    it("should create an item via POST", async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: { id: 10, title: "New Post", status: "draft" },
      });

      const service = new ItemsService("posts");
      const result = await service.createOne({
        title: "New Post",
        status: "draft",
      });

      expect(mockApiRequest).toHaveBeenCalledOnce();
      const [callUrl, callOpts] = mockApiRequest.mock.calls[0];
      expect(callUrl).toBe("/api/items/posts");
      expect(callOpts.method).toBe("POST");
      expect(JSON.parse(callOpts.body)).toEqual({
        title: "New Post",
        status: "draft",
      });
      expect(result).toEqual({ id: 10, title: "New Post", status: "draft" });
    });
  });

  // =========================================================================
  // updateOne
  // =========================================================================
  describe("updateOne", () => {
    it("should update an item via PATCH", async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: { id: 1, title: "Updated", status: "published" },
      });

      const service = new ItemsService("posts");
      const result = await service.updateOne(1, { title: "Updated" });

      const [callUrl, callOpts] = mockApiRequest.mock.calls[0];
      expect(callUrl).toBe("/api/items/posts/1");
      expect(callOpts.method).toBe("PATCH");
      expect(result.title).toBe("Updated");
    });
  });

  // =========================================================================
  // deleteOne
  // =========================================================================
  describe("deleteOne", () => {
    it("should delete an item via DELETE", async () => {
      mockApiRequest.mockResolvedValueOnce(undefined);

      const service = new ItemsService("posts");
      await service.deleteOne(1);

      const [callUrl, callOpts] = mockApiRequest.mock.calls[0];
      expect(callUrl).toBe("/api/items/posts/1");
      expect(callOpts.method).toBe("DELETE");
    });
  });

  // =========================================================================
  // deleteMany
  // =========================================================================
  describe("deleteMany", () => {
    it("should delete multiple items via DELETE with filter query param", async () => {
      mockApiRequest.mockResolvedValueOnce(undefined);

      const service = new ItemsService("posts");
      await service.deleteMany([1, 2, 3]);

      const [callUrl, callOpts] = mockApiRequest.mock.calls[0];
      const expectedFilter = encodeURIComponent(JSON.stringify({ id: { _in: [1, 2, 3] } }));
      expect(callUrl).toBe(`/api/items/posts?filter=${expectedFilter}`);
      expect(callOpts.method).toBe("DELETE");
      expect(callOpts.body).toBeUndefined();
    });

    it("should use custom primary key field for filter", async () => {
      mockApiRequest.mockResolvedValueOnce(undefined);

      const service = new ItemsService("posts");
      await service.deleteMany([1, 2], "post_id");

      const [callUrl] = mockApiRequest.mock.calls[0];
      const expectedFilter = encodeURIComponent(JSON.stringify({ post_id: { _in: [1, 2] } }));
      expect(callUrl).toBe(`/api/items/posts?filter=${expectedFilter}`);
    });

    it("should not send request for empty array", async () => {
      const service = new ItemsService("posts");
      await service.deleteMany([]);

      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // updateMany
  // =========================================================================
  describe("updateMany", () => {
    it("should update multiple items via PATCH with keys+data payload", async () => {
      mockApiRequest.mockResolvedValueOnce(undefined);

      const service = new ItemsService("posts");
      await service.updateMany([1, 2], { status: "archived" });

      const [callUrl, callOpts] = mockApiRequest.mock.calls[0];
      expect(callUrl).toBe("/api/items/posts");
      expect(callOpts.method).toBe("PATCH");
      expect(JSON.parse(callOpts.body)).toEqual({
        keys: [1, 2],
        data: { status: "archived" },
      });
    });

    it("should not send request for empty array", async () => {
      const service = new ItemsService("posts");
      await service.updateMany([], { status: "archived" });

      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================
  describe("error handling", () => {
    it("should propagate API errors", async () => {
      mockApiRequest.mockRejectedValueOnce(
        new Error("API error: 404 - Not Found")
      );

      const service = new ItemsService("posts");
      await expect(service.readOne(999)).rejects.toThrow("API error: 404");
    });

    it("should propagate network errors", async () => {
      mockApiRequest.mockRejectedValueOnce(new Error("Network failure"));

      const service = new ItemsService("posts");
      await expect(service.readByQuery()).rejects.toThrow("Network failure");
    });
  });
});
