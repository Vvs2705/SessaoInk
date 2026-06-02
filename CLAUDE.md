# SessãoInk — Diretrizes de Desenvolvimento (Agentes de Elite)

Este arquivo contém as instruções e regras de qualidade técnica estabelecidas para o projeto SessãoInk. Qualquer agente ou desenvolvedor deve seguir rigorosamente estes padrões.

## 🛠️ Comandos de Execução e Validação

- **Instalar Dependências:** `npm install`
- **Desenvolvimento Local:** `npm run dev`
- **Validação de Tipos (TypeScript):** `npm run tsc`
- **Build de Produção:** `npm run build`
- **Executar Testes (Playwright):** `npx playwright test`

---

## 🎨 Diretrizes do AGENTE FRONTEND ECOMMERCE ENTERPRISE

### 📱 Responsividade e Mobile-First
- **Design Responsivo Obligatório:** Todas as telas devem se adaptar a larguras a partir de **320px** sem criar barras de rolagem horizontais na página principal e sem exigir pinch-to-zoom para leitura.
- **Navegação Secundária/Abas:** Em dispositivos móveis, menus de abas horizontais devem usar rolagem lateral (`overflow-x-auto`) com a barra de rolagem oculta.
- **Tamanho dos Alvos de Toque:** Elementos clicáveis/interativos em celulares devem ter tamanho mínimo de **44x44px** CSS para evitar erros de toque (critério WCAG 2.2).
- **Sem Alturas/Larguras Fixas:** Evite declarar larguras de pixel estáticas (`w-[500px]`, etc.) em layouts principais. Use classes flexíveis, grades responsivas (`grid-cols-1 md:grid-cols-3`) e largura máxima (`max-w-*`).

### ♿ Acessibilidade (WCAG 2.2 AA)
- **Foco Visível:** Todos os elementos interativos devem possuir foco visível ao navegar por teclado.
- **Formulários e Inputs:** Todo campo de entrada precisa de um rótulo associado e mensagens de erro descritivas associadas via `aria-describedby` quando apropriado.
- **Contraste de Cores:** Manter o contraste mínimo de 4.5:1 para texto normal e 3:1 para componentes visuais interativos.

### ⚡ Performance e Core Web Vitals
- **CLS (Cumulative Layout Shift):** Reservar espaço para elementos de carregamento assíncrono (como skeletons ou min-heights) para evitar que a página "salte" ao carregar dados.
- **LCP (Largest Contentful Paint):** Carregar imagens críticas de hero com o atributo `priority` do Next.js Image.

---

## 🎯 Diretrizes do AGENTE PRODUCT UX CONVERSION

### 🛒 Padrões de Conversão Mobile (CRO)
- **Fricção Mínima:** Minimizar o número de cliques ou toques para concluir ações cruciais (configurações de segurança, login e checkout).
- **UX Writing:** Mensagens de erro claras e acionáveis (explicar o que aconteceu e como o usuário pode corrigir).
- **Redução de Ansiedade:** Fornecer estados visuais claros de carregamento (`Loader`, botões desabilitados) e feedbacks imediatos de sucesso via Toast.
