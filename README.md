# RENOVAPAN — MVP do site

Protótipo funcional e responsivo feito apenas com HTML, CSS e JavaScript.

## Como visualizar

Opção mais simples: abra `index.html` em um navegador moderno.

Para uma visualização mais confiável com servidor local e recarregamento automático (Live Reload):

Com Node.js / npm:

```powershell
npm run dev
# ou
npm start
```

Caso prefira utilizar Python:

```powershell
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Funcionalidades incluídas

- Página inicial institucional e responsiva.
- Catálogo com busca e filtros por categoria.
- Página dinâmica de detalhes de cada equipamento.
- Página institucional sobre a RENOVAPAN.
- Formulário demonstrativo com validação no navegador.
- Menu responsivo e animações com suporte a `prefers-reduced-motion`.
- Seis equipamentos fictícios, separados em `js/data.js`.

## Importante antes de publicar

Este MVP não envia ou armazena dados. Imagens de máquinas são ilustrações em SVG e os equipamentos, especificações e disponibilidades são demonstrativos. Antes de qualquer publicação, substitua:

- telefone e e-mail oficiais;
- equipamentos e especificações por dados reais;
- ilustrações por fotografias autorizadas;
- espaços reservados por fotos reais da oficina;
- cases e depoimentos apenas por conteúdo autorizado;
- formulário demonstrativo por uma integração aprovada.

## Estrutura

```text
site-mvp/
├── index.html
├── catalogo.html
├── equipamento.html
├── sobre.html
├── orcamento.html
├── css/styles.css
└── js/
    ├── data.js
    ├── components.js
    ├── main.js
    ├── catalogo.js
    ├── equipamento.js
    └── orcamento.js
```

## Identidade visual

Paleta: vermelho #DB1A22, azul-marinho #202B50, branco #FFFFFF e cinza #F5F6F7. A imagem em assets/logo-renovapan-original.png é o anexo oficial, preservado sem alteração. A apresentação foi refinada por CSS, sem redesenho do mascote. Header e rodapé compartilham a marca em todas as páginas.

Projeto estático: não há etapa de build nem dependências de aplicação.

### Logo oficial atualizada

O arquivo `assets/logo-renovapan-oficial.png` é o PNG enviado em 10/11/2026, sem edição. O anexo anterior permanece em `assets/logo-renovapan-original.png`. Header e rodapé usam o novo arquivo em todas as páginas. A marca orienta o cabeçalho branco, títulos serifados, fundos azul-marinho e botões vermelhos. O layout permanece responsivo.

### Layout inspirado na referência da homepage

A homepage recebeu faixa institucional, hero claro com recorte diagonal vermelho, linhas de equipamentos, processo horizontal e destaques em cards. As cinco páginas compartilham `css/reference.css`, menu e identidade. As imagens `assets/referencia-*` são recortes ilustrativos da referência enviada pelo usuário; não comprovam estoque, modelo ou especificações. Substituir por fotos reais validadas antes de uso comercial. A logo oficial foi preservada.

### Preenchimento das áreas visuais

As áreas institucionais da página Sobre e as cenas do processo na homepage utilizam as três ilustrações geradas por IA, identificadas na interface. O comparativo vazio de antes/depois deu lugar a cenas independentes de avaliação e recuperação, sem alegar um caso real. A galeria de produtos exibe apenas a imagem disponível, sem miniaturas vazias ou ângulos inventados. Versões JPEG de 768 e 1536 px permitem carregamento responsivo. Consulte `assets/ORIGEM-DAS-IMAGENS.md` para a procedência.
