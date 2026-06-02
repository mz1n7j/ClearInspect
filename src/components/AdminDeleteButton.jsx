// src/components/AdminDeleteButton.jsx
// Drop this component onto any inspector card to show a delete button for admins only.
// Usage: <AdminDeleteButton licenseNo={inspector.license_no} onDeleted={() => refetchList()} />

import { useState } from "react";

export default function AdminDeleteButton({ licenseNo, inspectorName, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Read the logged-in user from localStorage (adjust key to match your auth setup)
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin";

  if (!isAdmin) return null; // Hidden for non-admins

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inspector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_inspector",
          licenseNo,
          adminUserId: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      setConfirming(false);
      if (onDeleted) onDeleted(licenseNo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: "8px" }}>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          style={{
            backgroundColor: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "6px 14px",
            fontSize: "13px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          🗑 Delete Registry
        </button>
      ) : (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: "8px",
          padding: "12px",
          maxWidth: "320px",
        }}>
          <p style={{ margin: "0 0 10px", fontSize: "14px", color: "#991b1b", fontWeight: "600" }}>
            Delete {inspectorName || licenseNo}?
          </p>
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#7f1d1d" }}>
            This will permanently remove this inspector from the registry. This cannot be undone.
          </p>
          {error && (
            <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "8px" }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{
                backgroundColor: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "13px",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: "600",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Deleting..." : "Yes, Delete"}
            </button>
            <button
              onClick={() => { setConfirming(false); setError(null); }}
              disabled={loading}
              style={{
                backgroundColor: "#e5e7eb",
                color: "#374151",
                border: "none",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "13px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
