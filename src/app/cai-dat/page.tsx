"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/AuthContext";
import { User } from "@/lib/mockData";
import { getUsers, getUserByPin, updateUserPin } from "@/lib/supabaseService";

// Ô nhập PIN: chỉ cho gõ số, tối đa 6 ký tự
function PinInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) {
  return (
    <input
      id={id}
      className="form-input"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      style={{ letterSpacing: 4, fontSize: 18 }}
    />
  );
}

export default function CaiDatPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // Đổi PIN của chính mình
  const [curPin, setCurPin] = useState("");
  const [myNew, setMyNew] = useState("");
  const [myNew2, setMyNew2] = useState("");
  const [myErr, setMyErr] = useState("");
  const [mySaving, setMySaving] = useState(false);

  // Đổi PIN của thợ
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wNew, setWNew] = useState("");
  const [wNew2, setWNew2] = useState("");
  const [wErr, setWErr] = useState("");
  const [wSaving, setWSaving] = useState(false);
  const [wDone, setWDone] = useState("");

  useEffect(() => {
    setMounted(true);
    getUsers().then(setUsers);
  }, []);

  if (!mounted) {
    return (
      <div className="app-shell">
        <div
          className="page-content"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "80dvh",
          }}
        >
          <span style={{ fontSize: 15, color: "var(--text-secondary)" }}>
            Đang tải...
          </span>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="app-shell">
        <div
          style={{ padding: 32, textAlign: "center", color: "var(--danger)" }}
        >
          Không có quyền
        </div>
        <BottomNav />
      </div>
    );
  }

  const workers = users.filter((u) => u.id !== user.id);

  // ── Đổi PIN của chính mình → bắt đăng nhập lại ──
  async function handleChangeMyPin() {
    setMyErr("");
    if (!user) return;
    if (myNew !== myNew2) {
      setMyErr("Hai lần nhập mã mới không giống nhau.");
      return;
    }
    if (myNew === curPin) {
      setMyErr("Mã mới trùng mã cũ.");
      return;
    }
    setMySaving(true);
    try {
      const me = await getUserByPin(curPin);
      if (!me || me.id !== user.id) {
        setMyErr("Mã PIN hiện tại không đúng.");
        return;
      }
      const err = await updateUserPin(user.id, myNew);
      if (err) {
        setMyErr(err);
        return;
      }
      // Đổi xong thì đăng xuất để chắc chắn mã mới dùng được
      logout();
      router.push("/dang-nhap");
    } finally {
      setMySaving(false);
    }
  }

  // ── Admin đổi PIN cho thợ: không cần biết mã cũ ──
  async function handleChangeWorkerPin(worker: User) {
    setWErr("");
    setWDone("");
    if (wNew !== wNew2) {
      setWErr("Hai lần nhập mã mới không giống nhau.");
      return;
    }
    setWSaving(true);
    try {
      const err = await updateUserPin(worker.id, wNew);
      if (err) {
        setWErr(err);
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === worker.id ? { ...u, pin: wNew } : u)),
      );
      setWDone(`Đã đổi mã PIN cho ${worker.name}.`);
      setEditingId(null);
      setWNew("");
      setWNew2("");
    } finally {
      setWSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="page-content scroll-top-padding">
        <div
          className="page-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1>Cài đặt</h1>
            <div className="subtitle">Quản lý mã PIN đăng nhập</div>
          </div>
          <button
            className="icon-btn"
            id="btn-back-settings"
            onClick={() => router.push("/don-hang")}
            title="Quay lại"
            aria-label="Quay lại"
          >
            ✕
          </button>
        </div>

        {/* ── Mã PIN của tôi ── */}
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Mã PIN của tôi</h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginBottom: 14,
            }}
          >
            Đổi xong sẽ phải đăng nhập lại bằng mã mới.
          </p>

          <div className="form-group">
            <label className="form-label">Mã PIN hiện tại</label>
            <PinInput
              id="pin-current"
              value={curPin}
              onChange={setCurPin}
              placeholder="••••"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Mã PIN mới (4–6 chữ số)</label>
            <PinInput
              id="pin-my-new"
              value={myNew}
              onChange={setMyNew}
              placeholder="••••"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nhập lại mã PIN mới</label>
            <PinInput
              id="pin-my-new-2"
              value={myNew2}
              onChange={setMyNew2}
              placeholder="••••"
            />
          </div>

          {myErr && (
            <div
              style={{
                color: "var(--danger)",
                fontSize: 14,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              {myErr}
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            id="btn-save-my-pin"
            disabled={
              mySaving ||
              curPin.length < 4 ||
              myNew.length < 4 ||
              myNew2.length < 4
            }
            onClick={handleChangeMyPin}
          >
            {mySaving ? "Đang lưu..." : "Đổi mã PIN của tôi"}
          </button>
        </div>

        {/* ── Mã PIN công nhân ── */}
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Mã PIN công nhân</h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginBottom: 14,
            }}
          >
            Đặt mã mới trực tiếp, không cần biết mã cũ. Dùng khi có người nghỉ
            việc hoặc mất điện thoại.
          </p>

          {wDone && (
            <div
              style={{
                color: "var(--success)",
                fontSize: 14,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              ✓ {wDone}
            </div>
          )}

          {workers.length === 0 && (
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Chưa có người dùng nào khác.
            </div>
          )}

          {workers.map((w) => (
            <div
              key={w.id}
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 12,
                marginTop: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{w.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {w.role === "admin" ? "Quản lý" : "Công nhân"}
                  </div>
                </div>
                {editingId === w.id ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditingId(null);
                      setWNew("");
                      setWNew2("");
                      setWErr("");
                    }}
                  >
                    Huỷ
                  </button>
                ) : (
                  <button
                    className="btn btn-outline btn-sm"
                    id={`btn-edit-pin-${w.id}`}
                    onClick={() => {
                      setEditingId(w.id);
                      setWNew("");
                      setWNew2("");
                      setWErr("");
                      setWDone("");
                    }}
                  >
                    Đổi PIN
                  </button>
                )}
              </div>

              {editingId === w.id && (
                <div style={{ marginTop: 12 }}>
                  <div className="form-group">
                    <label className="form-label">
                      Mã PIN mới (4–6 chữ số)
                    </label>
                    <PinInput
                      id={`pin-w-new-${w.id}`}
                      value={wNew}
                      onChange={setWNew}
                      placeholder="••••"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nhập lại mã PIN mới</label>
                    <PinInput
                      id={`pin-w-new2-${w.id}`}
                      value={wNew2}
                      onChange={setWNew2}
                      placeholder="••••"
                    />
                  </div>

                  {wErr && (
                    <div
                      style={{
                        color: "var(--danger)",
                        fontSize: 14,
                        marginBottom: 10,
                        fontWeight: 600,
                      }}
                    >
                      {wErr}
                    </div>
                  )}

                  <button
                    className="btn btn-primary btn-full"
                    id={`btn-save-pin-${w.id}`}
                    disabled={wSaving || wNew.length < 4 || wNew2.length < 4}
                    onClick={() => handleChangeWorkerPin(w)}
                  >
                    {wSaving ? "Đang lưu..." : `Lưu mã PIN cho ${w.name}`}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
