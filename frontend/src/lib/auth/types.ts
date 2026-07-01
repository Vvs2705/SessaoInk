export interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: "ADMIN" | "ARTISTA" | "RECEPCIONISTA";
  estudio_id: string;
  mfa_totp_ativo?: boolean;
  mfa_email_ativo?: boolean;
  criado_em?: string | null;
}

export interface LoginRequest {
  email: string;
  senha: string;
}
