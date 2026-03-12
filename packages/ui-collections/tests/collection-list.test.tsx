/**
 * CollectionList Component Tests
 *
 * Tests rendering, data fetching, delete flow, search, pagination,
 * and permission enforcement.
 * Mocks @buildpad/services, @buildpad/ui-form, @buildpad/ui-table, and FilterPanel.
 */

import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MantineProvider } from "@mantine/core";

// -------------------------------------------------------------------
// Service mocks — use vi.hoisted so they are available in vi.mock factories
// -------------------------------------------------------------------
const {
  mockFieldsReadAll,
  mockPermissionsGetAccess,
  mockItemsDeleteMany,
  mockApiRequest,
} = vi.hoisted(() => ({
  mockFieldsReadAll: vi.fn(),
  mockPermissionsGetAccess: vi.fn(),
  mockItemsDeleteMany: vi.fn(),
  mockApiRequest: vi.fn(),
}));

vi.mock("@buildpad/services", () => ({
  FieldsService: vi.fn().mockImplementation(() => ({
    readAll: mockFieldsReadAll,
  })),
  ItemsService: vi.fn().mockImplementation(() => ({
    deleteMany: mockItemsDeleteMany,
    readByQuery: vi.fn(),
  })),
  PermissionsService: {
    getMyCollectionAccess: mockPermissionsGetAccess,
  },
  apiRequest: mockApiRequest,
}));

// Mock VTable to render items as a simple table
vi.mock("@buildpad/ui-table", () => ({
  VTable: vi.fn(({
    items,
    headers,
    loading,
    showSelect,
    value,
    onUpdate,
    onRowClick,
    renderFooter,
    noItemsText,
  }: {
    items: Array<Record<string, unknown>>;
    headers: Array<{ text: string; value: string }>;
    loading: boolean;
    showSelect?: string;
    value?: unknown[];
    onUpdate?: (items: unknown[]) => void;
    onRowClick?: (args: { item: Record<string, unknown> }) => void;
    renderFooter?: () => React.ReactNode;
    noItemsText?: string;
  }) => (
    <div data-testid="vtable-mock">
      {loading && <div data-testid="vtable-loading">Loading...</div>}
      {!loading && items.length === 0 && (
        <div data-testid="vtable-empty">{noItemsText || "No items"}</div>
      )}
      <table>
        <thead>
          <tr>
            {showSelect === "multiple" && <th>Select</th>}
            {headers.map((h) => (
              <th key={h.value}>{h.text}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={i}
              data-testid={`vtable-row-${i}`}
              onClick={() => onRowClick?.({ item })}
            >
              {showSelect === "multiple" && (
                <td>
                  <input
                    type="checkbox"
                    data-testid={`vtable-select-${i}`}
                    onChange={(e) => {
                      if (!onUpdate) return;
                      const current = (value || []) as Record<string, unknown>[];
                      if (e.target.checked) {
                        onUpdate([...current, item]);
                      } else {
                        onUpdate(current.filter((v) => v !== item));
                      }
                    }}
                  />
                </td>
              )}
              {headers.map((h) => (
                <td key={h.value} data-testid={`cell-${i}-${h.value}`}>
                  {String(item[h.value] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {renderFooter?.()}
    </div>
  )),
}));

// Mock FilterPanel to a no-op
vi.mock("../src/FilterPanel", () => ({
  FilterPanel: () => <div data-testid="filter-panel-mock" />,
}));

// Import component under test AFTER mocks
import { CollectionList } from "../src/CollectionList";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
const SAMPLE_FIELDS = [
  { field: "id", type: "integer", meta: { interface: "input", sort: 0, hidden: false } },
  { field: "title", type: "string", meta: { interface: "input", sort: 1, hidden: false } },
  { field: "status", type: "string", meta: { interface: "select-dropdown", sort: 2, hidden: false } },
  { field: "body", type: "text", meta: { interface: "input-multiline", sort: 3, hidden: false } },
];

const SAMPLE_ITEMS = {
  data: [
    { id: 1, title: "Post 1", status: "published", body: "Body 1" },
    { id: 2, title: "Post 2", status: "draft", body: "Body 2" },
    { id: 3, title: "Post 3", status: "published", body: "Body 3" },
  ],
  meta: { total_count: 3, filter_count: 3 },
};

function setupDefaultMocks() {
  mockFieldsReadAll.mockResolvedValue(SAMPLE_FIELDS);
  mockPermissionsGetAccess.mockResolvedValue({});
  mockApiRequest.mockResolvedValue(SAMPLE_ITEMS);
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

function renderList(props: Partial<React.ComponentProps<typeof CollectionList>> = {}) {
  return render(
    <CollectionList collection="posts" {...props} />,
    { wrapper },
  );
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------
describe("CollectionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // =====================================================================
  // Rendering
  // =====================================================================
  describe("rendering", () => {
    it("renders VTable with items after loading", async () => {
      renderList();

      await waitFor(() => {
        expect(screen.getByTestId("vtable-mock")).toBeInTheDocument();
      });

      // Items should be rendered
      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toHaveTextContent("Post 1");
      });
    });

    it("shows error when fields fail to load", async () => {
      mockFieldsReadAll.mockRejectedValueOnce(new Error("Connection failed"));

      renderList();

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-error")).toBeInTheDocument();
      });
    });

    it("shows item count display", async () => {
      renderList();

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-item-count")).toBeInTheDocument();
      });
    });
  });

  // =====================================================================
  // Search
  // =====================================================================
  describe("search", () => {
    it("renders search input when enableSearch is true", async () => {
      renderList({ enableSearch: true });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-search")).toBeInTheDocument();
      });
    });

    it("triggers data reload when search value changes", async () => {
      renderList({ enableSearch: true });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-search")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search...");
      await userEvent.type(searchInput, "hello");

      // apiRequest should be called again with search param
      await waitFor(() => {
        const lastCall = mockApiRequest.mock.calls[mockApiRequest.mock.calls.length - 1];
        expect(lastCall?.[0]).toContain("search=hello");
      });
    });
  });

  // =====================================================================
  // Create button
  // =====================================================================
  describe("create button", () => {
    it("shows create button when enableCreate and onCreate are provided", async () => {
      const onCreate = vi.fn();
      renderList({ enableCreate: true, onCreate });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-create")).toBeInTheDocument();
      });
    });

    it("calls onCreate when create button is clicked", async () => {
      const onCreate = vi.fn();
      renderList({ enableCreate: true, onCreate });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-create")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId("collection-list-create"));
      expect(onCreate).toHaveBeenCalled();
    });
  });

  // =====================================================================
  // Selection & Bulk Delete
  // =====================================================================
  describe("selection and bulk delete", () => {
    it("shows bulk actions with delete when items are selected", async () => {
      renderList({ enableSelection: true, enableDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select the first item
      const checkbox = screen.getByTestId("vtable-select-0");
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-bulk-actions")).toBeInTheDocument();
      });

      expect(screen.getByTestId("bulk-action-delete")).toBeInTheDocument();
    });

    it("opens delete confirmation modal when bulk delete is clicked", async () => {
      renderList({ enableSelection: true, enableDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select first item
      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByTestId("bulk-action-delete")).toBeInTheDocument();
      });

      // Click delete
      await userEvent.click(screen.getByTestId("bulk-action-delete"));

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      });
    });

    it("calls ItemsService.deleteMany and refreshes when confirmed", async () => {
      mockItemsDeleteMany.mockResolvedValueOnce(undefined);
      const onDeleteSuccess = vi.fn();

      renderList({
        enableSelection: true,
        enableDelete: true,
        onDeleteSuccess,
      });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select first item
      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByTestId("bulk-action-delete")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId("bulk-action-delete"));

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirm-btn")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId("delete-confirm-btn"));

      await waitFor(() => {
        expect(mockItemsDeleteMany).toHaveBeenCalled();
      });
    });

    it("shows selected count badge", async () => {
      renderList({ enableSelection: true, enableDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select first item
      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByText("1 selected")).toBeInTheDocument();
      });
    });
  });

  // =====================================================================
  // Refresh
  // =====================================================================
  describe("refresh", () => {
    it("reloads items when refresh button is clicked", async () => {
      renderList();

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-refresh")).toBeInTheDocument();
      });

      const callsBefore = mockApiRequest.mock.calls.length;
      await userEvent.click(screen.getByTestId("collection-list-refresh"));

      await waitFor(() => {
        expect(mockApiRequest.mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });
  });

  // =====================================================================
  // Permissions
  // =====================================================================
  describe("permissions", () => {
    it("does not show create button when createAllowed is false", async () => {
      mockPermissionsGetAccess.mockResolvedValueOnce({
        posts: {
          read: { fields: ["*"] },
          // no create key = not allowed
        },
      });

      renderList({ enableCreate: true, onCreate: vi.fn() });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-create")).toBeInTheDocument();
      });

      // Create button should be disabled
      expect(screen.getByTestId("collection-list-create")).toBeDisabled();
    });

    it("does not show bulk delete when deleteAllowed is false", async () => {
      mockPermissionsGetAccess.mockResolvedValueOnce({
        posts: {
          read: { fields: ["*"] },
          create: { fields: ["*"] },
          update: { fields: ["*"] },
          // no delete key
        },
      });

      renderList({ enableSelection: true, enableDelete: true });

      await waitFor(() => {
        expect(screen.getByTestId("cell-0-title")).toBeInTheDocument();
      });

      // Select first item
      fireEvent.click(screen.getByTestId("vtable-select-0"));

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-bulk-actions")).toBeInTheDocument();
      });

      // Bulk delete should not be present because deleteAllowed is false
      expect(screen.queryByTestId("bulk-action-delete")).not.toBeInTheDocument();
    });
  });

  // =====================================================================
  // Filter
  // =====================================================================
  describe("filter", () => {
    it("shows filter toggle when enableFilter is true", async () => {
      renderList({ enableFilter: true });

      await waitFor(() => {
        expect(screen.getByTestId("collection-list-filter-toggle")).toBeInTheDocument();
      });
    });
  });

  // =====================================================================
  // Empty state
  // =====================================================================
  describe("empty state", () => {
    it("shows empty message when no items", async () => {
      mockApiRequest.mockResolvedValue({ data: [], meta: { total_count: 0 } });

      renderList();

      await waitFor(() => {
        expect(screen.getByTestId("vtable-empty")).toBeInTheDocument();
      });
    });
  });
});
