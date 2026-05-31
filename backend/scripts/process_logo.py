from PIL import Image

orig_path = "C:/Users/VINICIUS/.gemini/antigravity/brain/2a743f15-5838-451d-be30-90fdf525db45/media__1780177774515.png"
public_dir = "C:/Users/VINICIUS/.gemini/antigravity/worktrees/SessãoInk/implement-project-roadmap-files/frontend/public"

try:
    img = Image.open(orig_path)

    # 1. Salva a logo retangular wide
    img.save(f"{public_dir}/logo-wide.png")
    print("Logo wide salva.")

    # 2. Recorta o símbolo quadrado à esquerda (de x=0 a x=576, y=0 a y=576)
    # Isso vai focar no símbolo da marca 'S' e na ponta da máquina
    symbol_box = (0, 0, 576, 576)
    symbol_img = img.crop(symbol_box)

    # Salva em tamanhos de ícone
    icon_512 = symbol_img.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(f"{public_dir}/icon-512.png")
    icon_512.save(f"{public_dir}/apple-touch-icon.png")

    icon_192 = symbol_img.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(f"{public_dir}/icon-192.png")

    # Salva como favicon.ico
    favicon = symbol_img.resize((32, 32), Image.Resampling.LANCZOS)
    favicon.save(f"{public_dir}/favicon.ico")

    print("Ícones PWA e favicons criados e salvos com sucesso!")
except Exception as e:
    print(f"Erro ao processar imagem: {e}")
