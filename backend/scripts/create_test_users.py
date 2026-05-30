import asyncio
from app.core.database import async_session
from app.models.usuario import Usuario, Estudio, TipoUsuario
from app.core.security import hash_senha
from sqlalchemy import select

async def main():
    async with async_session() as session:
        # 1. Verifica se já existe um estúdio de teste, senão cria
        res_estudio = await session.execute(select(Estudio).filter(Estudio.slug == "sessaoink"))
        estudio = res_estudio.scalars().first()
        if not estudio:
            estudio = Estudio(
                nome="Estúdio SessãoInk",
                slug="sessaoink",
                bio="Estúdio de teste para homologação do sistema SessãoInk",
                cidade="São Paulo",
                uf="SP",
                instagram="@sessaoink"
            )
            session.add(estudio)
            await session.commit()
            await session.refresh(estudio)
            print(f"Estúdio criado com ID: {estudio.id}")
        else:
            print(f"Estúdio já existente com ID: {estudio.id}")

        # 2. Criar os dois usuários
        emails = ["vsouz009@gmail.com", "emijhow.12@gmail.com"]
        senha_plana = "Pq267@gtr417#"
        senha_hash_val = hash_senha(senha_plana)

        for email in emails:
            res_user = await session.execute(select(Usuario).filter(Usuario.email == email))
            user = res_user.scalars().first()
            if not user:
                user = Usuario(
                    estudio_id=estudio.id,
                    nome="Vinicius Souza" if email == "vsouz009@gmail.com" else "Emi Jhow",
                    email=email,
                    senha_hash=senha_hash_val,
                    tipo=TipoUsuario.ADMIN
                )
                session.add(user)
                print(f"Usuário {email} criado.")
            else:
                user.senha_hash = senha_hash_val  # garante a senha correta
                user.tipo = TipoUsuario.ADMIN     # garante acesso completo
                print(f"Usuário {email} já existia, senha e cargo atualizados.")
        
        await session.commit()
        print("Finalizado com sucesso!")

if __name__ == "__main__":
    asyncio.run(main())
