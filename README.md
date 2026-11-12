# RENOVAPAN 2.0

Site institucional e catálogo com painel privado para o proprietário. O servidor Node usa SQLite persistente e mantém as páginas públicas em HTML, CSS e JavaScript.

## Rodar localmente

No checkout da branch `codex/ajustes-davis`, com Node.js 24 ou superior:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
npm.cmd start
```

Abra `http://127.0.0.1:8080/` para o site e `http://127.0.0.1:8080/admin` para o painel. O banco começa vazio e as migrations são aplicadas ao iniciar. A prévia aberta pelo Codex usa a porta 4175.

## Configurar o acesso do proprietário

No mesmo checkout, execute em PowerShell 7:

```powershell
$env:RENOVAPAN_ADMIN_PASSWORD = Read-Host 'Senha do proprietário (mínimo 14 caracteres)' -MaskInput
try {
  npm.cmd run admin:setup -- proprietario --totp
} finally {
  Remove-Item Env:RENOVAPAN_ADMIN_PASSWORD
}
```

Cadastre a chave exibida no aplicativo autenticador, com códigos de seis dígitos e intervalo de 30 segundos. Guarde a chave em local seguro. Use o usuário `proprietario`, a senha definida e um código novo ao entrar. Para configurar apenas senha, omita `--totp`. Para recuperar o acesso, execute o mesmo comando com uma nova senha e, se usar o segundo fator, cadastre a nova chave. A configuração substitui a conta única e revoga as sessões existentes. O comando requer acesso ao computador ou servidor que hospeda o banco.

## Operar o painel

1. Em **Equipamentos**, cadastre a ficha como rascunho. As especificações usam uma linha por par `Nome: valor`. Adicione fotos JPEG, PNG ou WebP de até 5 MB e um link HTTPS para o vídeo, se houver.
2. Salve e adicione as cores. Em **Máquinas e estoque**, cadastre cada máquina real com código único e etapa inicial. Somente máquinas livres compõem o estoque. A etapa Pronta entrega aparece como pronta; as demais aparecem como sob encomenda.
3. Volte ao equipamento e escolha **Publicado**. Use **Oculto** ou **Arquivado** para retirá-lo do catálogo. Um produto publicado com estoque zero continua visível e aceita consultas pelo WhatsApp.
4. Abra a ficha da máquina para mudar a etapa, reservar, vender, liberar, arquivar ou corrigir uma operação. Registre custos e consulte o resultado bruto estimado na ficha financeira. Fotos da unidade ficam privadas por padrão e podem ser publicadas com a identificação de antes, depois ou referência.
5. Registre demandas em **Máquinas procuradas**. Na visão geral, veja os indicadores de 7, 30 ou 90 dias. A medição é opcional e respeita GPC e DNT. Visitas são contadas por aba com medição habilitada. Visualizações, cliques, procuras e vendas são métricas separadas.
6. Em **Exportações**, abra o catálogo comercial e selecione **Imprimir ou salvar em PDF**. Baixe os relatórios privados em CSV com filtros de produto e datas. Inventário e ficha financeira usam a última atualização da unidade para o filtro de data. Vendas e procuras usam a data do registro comercial.

O preço interno aparece somente no painel. Informe um preço público separado para exibi-lo no catálogo. O botão público abre a conversa no WhatsApp com equipamento, código, cor e condição.

## Conciliação de bancos anteriores

A migração preserva os saldos e as reservas antigos em **Conciliação do estoque anterior**, assim como vendas e movimentações no histórico. O catálogo passa a contar somente máquinas com ficha individual. Faça um backup antes de atualizar e use **Vincular máquina** para cada unidade conferida. Uma reserva antiga vinculada mantém a unidade reservada. Use **Encerrar saldo por divergência** com o motivo registrado quando a conferência identificar saldo sem unidade correspondente.

## Banco e produção

- `RENOVAPAN_DB`: caminho do banco. O padrão é `.renovapan/catalogo.sqlite`, ignorado pelo Git. Use o mesmo caminho ao configurar a conta e rodar o servidor.
- `PORT`: porta do processo. O padrão é 8080. No ambiente local use o endereço `127.0.0.1` na porta escolhida.
- `RENOVAPAN_ORIGIN`: origem pública completa com HTTPS, por exemplo `https://catalogo.exemplo.com`. Preserve o cabeçalho Host original no proxy que termina TLS. HTTPS habilita o cookie Secure e o HSTS.
- `RENOVAPAN_HOST`: endereço interno do processo com proxy HTTPS. O padrão é `127.0.0.1`. Em produção mantenha o backend acessível pelo proxy e o banco em volume privado e persistente, com permissão para o usuário do serviço. Use apenas uma instância responsável pelo arquivo SQLite. Para backup por cópia, pare o serviço e copie o banco e os arquivos WAL/SHM caso existam.
- A leitura pública é limitada aos produtos publicados e às fotos vinculadas a eles. O upload valida tamanho, tipo declarado e assinatura do arquivo. Publique somente fotos autorizadas. Remova metadados privados das fotos antes de enviar.

A hospedagem precisa executar o servidor Node. Um host que serve somente arquivos estáticos não oferece o painel nem as APIs. Antes de publicar, configure o ambiente HTTPS, o volume de dados e a conta do proprietário e cadastre informações reais.

## Enviar a branch ao GitHub

Depois de testar e revisar os arquivos:

```powershell
git status --short --branch
git add -A
git commit -m "feat: adiciona painel e catálogo dinâmico"
git push -u origin codex/ajustes-davis
```

Abra um Pull Request para `main` após a validação.


## Identidade visual

Paleta: vermelho #DB1A22, azul-marinho #202B50, branco #FFFFFF e cinza #F5F6F7. A imagem em assets/logo-renovapan-original.png é o anexo oficial, preservado sem alteração. A apresentação foi refinada por CSS, sem redesenho do mascote. Header e rodapé compartilham a marca em todas as páginas.

### Logo atualizada

A logo fornecida em 12/11/2026 aparece no cabeçalho, rodapé e painel em uma versão PNG redimensionada para web. O ícone da aba usa uma versão menor da mesma arte. As versões anteriores continuam em `assets/`.

### Layout inspirado na referência da homepage

A homepage recebeu faixa institucional, hero claro com recorte diagonal vermelho, linhas de equipamentos, processo horizontal e destaques em cards. As cinco páginas compartilham `css/reference.css`, menu e identidade. As imagens `assets/referencia-*` são recortes ilustrativos da referência enviada pelo usuário; não comprovam estoque, modelo ou especificações. Substituir por fotos reais validadas antes de uso comercial. A logo oficial foi preservada.

### Preenchimento das áreas visuais

As áreas institucionais da página Sobre e as cenas do processo na homepage utilizam as três ilustrações geradas por IA, identificadas na interface. O comparativo vazio de antes/depois deu lugar a cenas independentes de avaliação e recuperação, sem alegar um caso real. A galeria de produtos exibe apenas a imagem disponível, sem miniaturas vazias ou ângulos inventados. Versões JPEG de 768 e 1536 px permitem carregamento responsivo. Consulte `assets/ORIGEM-DAS-IMAGENS.md` para a procedência.
