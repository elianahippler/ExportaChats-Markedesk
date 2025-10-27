// ================================
// 🔧 Variáveis principais e elementos
// ================================
const form = document.getElementById('consultaForm');
const resultadoDiv = document.getElementById('resultado');

let ultimoBody = {};        // Armazena os últimos parâmetros enviados no formulário
let contatos = [];          // Lista de contatos retornada do servidor
let paginaAtual = 1;        // Página atual da paginação
const itensPorPagina = 40;  // Quantos contatos mostrar por página


// ================================
// 📄 Renderiza a página de contatos
// ================================
function renderizarPagina() {
  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;
  const contatosPagina = contatos.slice(inicio, fim);

  let cardsHTML = `<div class="lista-contatos">`;

  contatosPagina.forEach(contato => {
    // Verifica se o contato já foi processado (está no cache)
    const cache = lerCache(contato.id);
    const processado = !!cache;

    cardsHTML += `
      <div class="contato-card" id="contato-${contato.id}">
        <div class="contato-info-wrapper">
          <div>👤 ${contato.name || 'Sem nome'}</div>
          <div>📞 ${contato.number || '-'}</div>
          <div>🆔 ${contato.id}</div>
        </div>
        <div class="buttons">
          <button class="consultar-btn" data-id="${contato.id}"
            ${processado ? 'disabled style="background-color:#a8e6cf;color:white;cursor:not-allowed;opacity:0.7;"' : ''}>
            ${processado ? '✅ Pronto!' : 'Processar'}
          </button>
          <button class="baixar-btn" data-id="${contato.id}"
            ${processado ? '' : 'disabled'}>
            ${processado ? '⬇️ Baixar' : 'Baixar'}
          </button>
        </div>
      </div>
    `;
  });

  cardsHTML += `</div>`;

  // Controle de paginação
  const totalPaginas = Math.ceil(contatos.length / itensPorPagina);
  cardsHTML += `
    <div class="paginacao"
        style="margin-top:12px; display:flex; justify-content:center; align-items:center; gap:10px; flex-wrap:nowrap; white-space:nowrap;">
      <button ${paginaAtual === 1 ? 'disabled' : ''} id="prevBtn">Anterior</button>
      <span class="page-info">Página <strong class="pagina-atual">${paginaAtual}</strong> de ${totalPaginas}</span>
      <button ${paginaAtual === totalPaginas ? 'disabled' : ''} id="nextBtn">Próximo</button>
    </div>
  `;

  // Atualiza o conteúdo na tela
  resultadoDiv.innerHTML = cardsHTML;

  // Eventos dos botões "Processar"
  document.querySelectorAll('.consultar-btn').forEach(btn => {
    btn.addEventListener('click', () => consultarHistorico(btn.dataset.id));
  });

  // Eventos dos botões "Baixar"
  document.querySelectorAll('.baixar-btn').forEach(btn => {
    const id = btn.dataset.id;
    const cache = lerCache(id);
    if (cache && cache.downloadUrl) {
      btn.onclick = () => window.open(cache.downloadUrl, "_blank");
    }
  });

  // Eventos da paginação
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => { paginaAtual--; renderizarPagina(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { paginaAtual++; renderizarPagina(); });
}


// ================================
// 🧹 Limpar cache ao clicar no título "Lista de Contatos"
// ================================
const listaTitulo = document.querySelector('.btnEscondido');
if (listaTitulo) {
  listaTitulo.addEventListener('click', () => {
    limparCache();
    console.log("🧹 Cache limpo ao clicar em Lista de Contatos");
    alert("Cache limpo com sucesso!");
  });
}


// ================================
// 🔍 Envio do formulário principal
// ================================
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const markedesk = form.markedesk.value.trim();
  const companyId = form.companyId.value.trim();

  // Validação simples
  if (!markedesk || !companyId) {
    alert("Por favor, preencha todos os campos.");
    return;
  }

  ultimoBody = { markedesk, companyId };

  const botao = form.querySelector("button[type='submit']");
  botao.disabled = true;
  botao.textContent = "⏳ Consultando...";

  const loader = document.getElementById('loader');
  loader.style.display = 'flex';
  resultadoDiv.innerHTML = '';

  /*LINK N8N*/
  //teste const webhookUrl = 'https://editor.n8n.markesistemas.com.br/webhook-test/59e9f170-f901-45db-8649-5a9fdf06293d';
  const webhookUrl = 'https://webhooks.n8n.markesistemas.com.br/webhook/59e9f170-f901-45db-8649-5a9fdf06293d';

  try {
    // Faz a requisição para buscar os contatos
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markedesk, companyId })
    });

    if (response.status !== 200) {
      throw new Error(`Erro HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text || text.trim() === "") {
      throw new Error("Resposta vazia do servidor.");
    }

    // Converte resposta para JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("❌ Resposta inválida:", text);
      throw new Error("O servidor não retornou um JSON válido.");
    }

    // Exibe contatos ou mensagem de vazio
    if (!Array.isArray(data) || data.length === 0) {
      resultadoDiv.innerHTML = '<p>Nenhum contato encontrado.</p>';
      return;
    }

    contatos = data;
    paginaAtual = 1;
    renderizarPagina();

  } catch (err) {
    console.error("❌ Erro ao consultar contatos:", err);
    resultadoDiv.innerHTML = `<p>${err.message}</p>`;
  } finally {
    loader.style.display = 'none';
    botao.disabled = false;
    botao.textContent = "Pesquisar Contatos";
  }
});


// ================================
// 🔄 Consulta o histórico de um contato específico
// ================================
async function consultarHistorico(id) {
  const card = document.getElementById(`contato-${id}`);
  const consultarBtn = card.querySelector(".consultar-btn");
  const baixarBtn = card.querySelector(".baixar-btn");

  // Verifica se o resultado já está no cache
  const cache = lerCache(id);
  if (cache) {
    consultarBtn.textContent = "✅ Pronto!";
    consultarBtn.style.backgroundColor = "#a8e6cf";
    consultarBtn.style.color = "white";
    consultarBtn.disabled = true;
    consultarBtn.style.cursor = "not-allowed";
    consultarBtn.style.opacity = "0.7";

    baixarBtn.disabled = false;
    baixarBtn.textContent = "⬇️ Baixar";
    baixarBtn.onclick = () => window.open(cache.downloadUrl, "_blank");
    return;
  }

  // Estado inicial enquanto processa
  consultarBtn.disabled = true;
  baixarBtn.disabled = true;
  consultarBtn.textContent = "⏳ Gerando...";

  try {
    /* LINK N8N */
    // TESTE const response = await fetch("https://editor.n8n.markesistemas.com.br/webhook-test/18bd1e69-7bda-4e92-99cc-f6d232ed26dd", {
    const response = await fetch("https://webhooks.n8n.markesistemas.com.br/webhook/18bd1e69-7bda-4e92-99cc-f6d232ed26dd", {
    
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      contatoId: id,
      companyId: ultimoBody.companyId,
      markedesk: ultimoBody.markedesk
      })
    });

    if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      alert("Você ainda não iniciou uma conversa com esse contato.");
      consultarBtn.textContent = "❌ Erro";
      return;
    }

    // Se veio o link de download, salva no cache
    if (result.downloadUrl && !result.downloadUrl.includes("{{")) {
      salvarCache(id, result);

      consultarBtn.textContent = "✅ Pronto!";
      consultarBtn.style.backgroundColor = "#a8e6cf";
      consultarBtn.style.color = "white";

      baixarBtn.disabled = false;
      baixarBtn.textContent = "⬇️ Baixar";
      baixarBtn.onclick = () => window.open(result.downloadUrl, "_blank");

      consultarBtn.onclick = () => {
        consultarBtn.disabled = true;
        consultarBtn.style.cursor = "not-allowed";
        consultarBtn.style.opacity = "0.7";
      };

    } else {
      consultarBtn.textContent = "⚠️ Erro no link";
      throw new Error("O servidor não retornou um link válido (downloadUrl).");
    }

  } catch (err) {
    console.error("❌ Erro ao consultar webhook:", err);
    consultarBtn.textContent = "❌ Erro";
    alert("Erro ao consultar webhook: " + err.message);
  }
}


// ================================
// 💾 Funções de cache local (LocalStorage)
// ================================
function salvarCache(contatoId, resultado) {
  const cache = JSON.parse(localStorage.getItem('contatosCache') || '{}');
  cache[contatoId] = resultado;
  localStorage.setItem('contatosCache', JSON.stringify(cache));
}

function lerCache(contatoId) {
  const cache = JSON.parse(localStorage.getItem('contatosCache') || '{}');
  return cache[contatoId] || null;
}

function limparCache() {
  localStorage.removeItem('contatosCache');
}
