export interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: "ADMIN" | "ARTISTA" | "RECEPCIONISTA";
  estudio_id: string;
}

export interface LoginRequest {
  email: string;
  senha: string;
}
