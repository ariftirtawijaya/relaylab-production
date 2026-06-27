import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, hasRole } from "@/lib/auth";
import {
  LayoutDashboard, Boxes, Cable, Cpu, ClipboardList, Workflow,
  GraduationCap, Users, LogOut, Menu, X, Zap, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/api";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "Production", "QC"], end: true },
  { to: "/work-orders", label: "Perintah Kerja", icon: Workflow, roles: ["Admin", "Production", "QC"] },
  { to: "/products", label: "Produk / SKU", icon: Boxes, roles: ["Admin", "Production", "QC"] },
  { to: "/cable-functions", label: "Master Kabel", icon: Cable, roles: ["Admin", "Production", "QC"] },
  { to: "/machine-programs", label: "Program Mesin", icon: Cpu, roles: ["Admin", "Production"] },
  { to: "/training", label: "Training Matrix", icon: GraduationCap, roles: ["Admin", "Production", "QC"] },
  { to: "/users", label: "Pengguna", icon: Users, roles: ["Admin"] },
];

function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const submit = async () => {
    try {
      await api.post("/auth/change-password", { current_password: cur, new_password: nw });
      toast.success("Password berhasil diubah");
      setOpen(false);
      setCur(""); setNw("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengubah password");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem data-testid="open-change-password" onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
          <KeyRound className="w-4 h-4 mr-2" /> Ubah Password
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Ubah Password</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Password saat ini</Label>
            <Input data-testid="cp-current" type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div>
            <Label>Password baru</Label>
            <Input data-testid="cp-new" type="password" value={nw} onChange={(e) => setNw(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button data-testid="cp-submit" onClick={submit} className="bg-amber-600 hover:bg-amber-700">Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  const filteredNav = NAV.filter(n => hasRole(user, ...n.roles));

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 text-slate-100 flex flex-col transform transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        data-testid="sidebar"
      >
        <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-amber-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">RelayLab</div>
            <div className="text-xs text-slate-400 -mt-0.5">Production OS</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              data-testid={`nav-${item.to.replace(/^\//, "").replace(/\//g, "-") || "home"}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-l-2 ${
                  isActive
                    ? "bg-slate-800 border-amber-500 text-white"
                    : "border-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
          v1.0 — Function First, Color Second
        </div>
      </aside>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 lg:px-8 py-3 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-md hover:bg-slate-100" onClick={() => setOpen(!open)} data-testid="toggle-sidebar">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="text-sm text-slate-500 hidden sm:block">
              Dokumentasi · Work Order · Cutting · QC
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="user-menu" className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 grid place-items-center text-sm font-semibold">
                  {user?.name?.slice(0, 1).toUpperCase() || "?"}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium leading-tight">{user?.name}</div>
                  <div className="text-xs text-slate-500 leading-tight">{user?.role}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ChangePasswordDialog />
              <DropdownMenuItem data-testid="logout-btn" onClick={handleLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" /> Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 px-4 lg:px-8 py-6 max-w-screen-2xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
