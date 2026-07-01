import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username.trim(), password);
      toast.success("Selamat datang!");
      nav("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-50">
      <div className="hidden lg:flex relative bg-slate-900 text-slate-50 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 opacity-90" />
        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-500 grid place-items-center">
              <Zap className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <div className="text-lg font-semibold">RelayLab</div>
              <div className="text-xs text-slate-400">Production System</div>
            </div>
          </div>
          <div className="space-y-5 max-w-md">
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              RelayLab Production System
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Sistem Dokumentasi dan Workflow Produksi RelayLab. Kelola Work Order, Cutting Sheet,
              Bundle Label, dan QC Checklist untuk produksi relay set otomotif.
              <span className="text-amber-400 font-medium"> Function First, Color Second.</span>
            </p>
            <div className="grid grid-cols-3 gap-3 pt-4 text-xs">
              <div className="border border-slate-700 rounded-md p-3">
                <div className="text-amber-400 font-mono">17</div>
                <div className="text-slate-400 mt-1">Kabel/produk</div>
              </div>
              <div className="border border-slate-700 rounded-md p-3">
                <div className="text-amber-400 font-mono">10</div>
                <div className="text-slate-400 mt-1">Bundle</div>
              </div>
              <div className="border border-slate-700 rounded-md p-3">
                <div className="text-amber-400 font-mono">10</div>
                <div className="text-slate-400 mt-1">QC items</div>
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            RelayLab Autolight — Internal Production System
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-amber-500 grid place-items-center">
              <Zap className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <div className="font-semibold">RelayLab Production System</div>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Masuk</h1>
            <p className="text-sm text-slate-500 mt-1">Gunakan akun produksi Anda.</p>
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              data-testid="login-username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="cth: arif"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button
            data-testid="login-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </div>
    </div>
  );
}
