import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/utils";

export type AuthMode = "login" | "signup";

/**
 * Formulário de entrada e cadastro, usado em /auth e no fim da página inicial. O admin vai para
 * /dashboard e o hunter para /inicio; no cadastro sem sessão, pede a confirmação do e-mail.
 */
export function AuthForm({ mode, idPrefix = "" }: { mode: AuthMode; idPrefix?: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const id = (k: string) => `${idPrefix}${k}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { data: signIn, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: signIn.user.id,
          _role: "admin",
        });
        navigate({ to: isAdmin ? "/dashboard" : "/inicio", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/inicio", replace: true });
        } else {
          toast.success("Conta criada. Confirme o e-mail pelo link que enviamos para entrar.");
        }
      }
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível continuar"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label htmlFor={id("nome")}>Seu nome</Label>
          <Input
            id={id("nome")}
            className="h-11"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como a equipe vai ver seu nome"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={id("email")}>E-mail</Label>
        <Input
          id={id("email")}
          type="email"
          autoComplete="email"
          className="h-11"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("senha")}>Senha</Label>
        <div className="relative">
          <Input
            id={id("senha")}
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3 text-muted-foreground transition-colors hover:text-heading"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
      </Button>
    </form>
  );
}
