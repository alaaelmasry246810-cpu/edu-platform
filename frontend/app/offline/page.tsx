"use client";

export default function OfflinePage() {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc" }}>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📡</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#1e293b", marginBottom: "0.5rem" }}>
            لا يوجد اتصال بالإنترنت
          </h1>
          <p style={{ color: "#64748b", maxWidth: "360px", lineHeight: 1.6 }}>
            تحقق من اتصالك بالإنترنت وحاول مجدداً. يمكنك الوصول للصفحات التي زرتها من قبل.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "2rem",
              background: "#2563eb",
              color: "white",
              border: "none",
              padding: "0.75rem 2rem",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
