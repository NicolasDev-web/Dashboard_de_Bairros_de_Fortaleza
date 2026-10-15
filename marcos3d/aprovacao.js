const VISTAS = ["perspectiva", "frente", "close", "topo"];

const MODELOS = [
  ["centro", "Catedral, Praça do Ferreira e Mercado", "Centro", "existente", "centro-catedral-praca-do-ferreira-mercado.glb", "aprimorador-1.md", "centro"],
  ["castelao", "Arena Castelão", "Boa Vista / Castelão", "existente", "arena-castelao.glb", "aprimorador-1.md", "castelao"],
  ["aeroporto", "Aeroporto Pinto Martins", "Aeroporto", "existente", "aeroporto-pinto-martins.glb", "aprimorador-1.md", "aeroporto"],
  ["messejana", "Lagoa e Matriz de Messejana", "Messejana", "existente", "lagoa-e-centro-de-messejana.glb", "aprimorador-1.md", "messejana"],
  ["praiaIracema", "Praia de Iracema", "Praia de Iracema", "existente", "praia-de-iracema.glb", "aprimorador-1.md", "praiaIracema"],
  ["praiaFuturo", "Praia do Futuro", "Praia do Futuro I e II", "existente", "praia-do-futuro.glb", "aprimorador-1.md", "praiaFuturo"],
  ["cambeba", "Centro Administrativo do Cambeba", "Cambeba", "existente", "centro-administrativo-do-cambeba.glb", "aprimorador-1.md", "cambeba"],
  ["unifor", "Universidade de Fortaleza", "Edson Queiroz", "existente", "unifor.glb", "aprimorador-2.md", "Unifor"],
  ["iguatemi", "Shopping Iguatemi Bosque", "Edson Queiroz", "existente", "shopping-iguatemi.glb", "aprimorador-2.md", "Iguatemi"],
  ["northShopping", "North Shopping Fortaleza", "Presidente Kennedy", "existente", "north-shopping-fortaleza.glb", "aprimorador-2.md", "North Shopping"],
  ["riomarFortaleza", "RioMar Fortaleza", "Papicu", "existente", "riomar-fortaleza.glb", "aprimorador-2.md", "RioMar Fortaleza"],
  ["riomarKennedy", "RioMar Kennedy", "Presidente Kennedy", "existente", "riomar-kennedy.glb", "aprimorador-2.md", "RioMar Kennedy"],
  ["terminalAntonioBezerra", "Terminal Antônio Bezerra", "Antônio Bezerra", "existente", "terminal-antonio-bezerra.glb", "aprimorador-2.md", "Terminal Antônio"],
  ["theatroJoseDeAlencar", "Theatro José de Alencar", "Centro", "novo", "theatro-jose-de-alencar.glb", "criador-1.md", "Theatro"],
  ["passeioPublico", "Passeio Público", "Centro", "novo", "passeio-publico.glb", "criador-1.md", "Passeio"],
  ["forteAssuncao", "Fortaleza de Nossa Senhora da Assunção", "Centro", "novo", "fortaleza-nossa-senhora-da-assuncao.glb", "criador-1.md", "Assunção"],
  ["dragaoDoMar", "Centro Dragão do Mar", "Centro", "novo", "centro-dragao-do-mar.glb", "criador-1.md", "Dragão"],
  ["estoril", "Estoril", "Praia de Iracema", "novo", "estoril.glb", "criador-1.md", "Estoril"],
  ["farolMucuripe", "Farol do Mucuripe", "Cais do Porto", "novo", "farol-do-mucuripe.glb", "criador-1.md", "Farol"],
  ["palacioAbolicao", "Palácio da Abolição", "Meireles", "novo", "palacio-da-abolicao.glb", "criador-1.md", "Palácio"],
  ["iracemaMartim", "Iracema e Martim", "Mucuripe", "novo", "iracema-e-martim-mucuripe.glb", "criador-1.md", "Iracema"],
  ["marcoZero", "Marco Zero / Praça de Santiago", "Barra do Ceará", "novo", "marco-zero-barra-do-ceara.glb", "criador-1.md", "Marco Zero"],
  ["reitoriaUfc", "Reitoria da UFC", "Benfica", "novo", "reitoria-ufc.glb", "criador-2.md", "Reitoria"],
  ["estadioPv", "Estádio Presidente Vargas", "Benfica", "novo", "estadio-presidente-vargas.glb", "criador-2.md", "Presidente Vargas"],
  ["igrejaFatima", "Igreja de Nossa Senhora de Fátima", "Fátima", "novo", "igreja-de-fatima.glb", "criador-2.md", "Fátima"],
  ["mosteiroSaoBento", "Mosteiro de São Bento", "São Bento", "novo", "mosteiro-de-sao-bento.glb", "criador-2.md", "Mosteiro"],
  ["casaAlencar", "Casa de José de Alencar", "José de Alencar", "novo", "casa-de-jose-de-alencar.glb", "criador-2.md", "Casa de José"],
  ["mercadoAerolandia", "Mercado da Aerolândia", "Alto da Balança", "novo", "mercado-da-aerolandia.glb", "criador-2.md", "Mercado da Aerolândia"],
  ["centroEventos", "Centro de Eventos do Ceará", "Edson Queiroz", "novo", "centro-de-eventos-do-ceara.glb", "criador-2.md", "Centro de Eventos"],
  ["ccbj", "Centro Cultural Bom Jardim", "Granja Lisboa", "novo", "centro-cultural-bom-jardim.glb", "criador-2.md", "Bom Jardim"],
].map(([id, nome, bairro, grupo, arquivo, relatorio, termo]) => ({ id, nome, bairro, grupo, arquivo, relatorio, termo }));

const estado = {
  filtro: "todos",
  vista: "perspectiva",
  busca: "",
  decisoes: JSON.parse(localStorage.getItem("aprovacao-marcos3d") || "{}"),
};

const lista = document.querySelector("#modelos");
const template = document.querySelector("#modelo-template");
const normalizar = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function caminhoRender(modelo, fonte) {
  return `/renders/${modelo.id}/${fonte}-${estado.vista}.png`;
}

function definirImagem(img, quadro, src, alt) {
  quadro.classList.remove("sem-imagem");
  img.hidden = false;
  img.alt = alt;
  img.onerror = () => { img.hidden = true; quadro.classList.add("sem-imagem"); };
  img.onload = () => { img.hidden = false; quadro.classList.remove("sem-imagem"); };
  img.src = src;
}

async function verificarGlb(modelo, elemento) {
  try {
    const resposta = await fetch(`/saida/${modelo.arquivo}`, { method: "HEAD", cache: "no-store" });
    if (!resposta.ok) throw new Error();
    const bytes = +(resposta.headers.get("content-length") || 0);
    elemento.classList.add("ok");
    elemento.querySelector(".estado-texto").textContent = bytes ? `GLB pronto · ${Math.round(bytes / 1024)} KB` : "GLB pronto · controle automático pendente";
  } catch {
    elemento.classList.add("falha");
    elemento.querySelector(".estado-texto").textContent = "GLB ainda não exportado";
  }
}

function trechoRelatorio(markdown, modelo) {
  const linhas = markdown.split(/\r?\n/);
  const termo = normalizar(modelo.termo);
  let inicio = linhas.findIndex((linha) => /^##\s/.test(linha) && normalizar(linha).includes(termo));
  if (inicio < 0) inicio = linhas.findIndex((linha) => normalizar(linha).includes(termo));
  if (inicio < 0) return "O relatório existe, mas a seção deste modelo ainda não foi localizada.";
  let fim = linhas.findIndex((linha, i) => i > inicio && /^##\s/.test(linha));
  if (fim < 0) fim = linhas.length;
  return linhas.slice(inicio, fim).join("\n").replace(/^#{1,4}\s*/gm, "").trim();
}

async function carregarDiagnostico(modelo, conteudo) {
  if (conteudo.dataset.carregado) return;
  conteudo.textContent = "Carregando relatório…";
  try {
    const resposta = await fetch(`/relatorios/${modelo.relatorio}`, { cache: "no-store" });
    if (!resposta.ok) throw new Error();
    conteudo.textContent = trechoRelatorio(await resposta.text(), modelo);
  } catch {
    conteudo.textContent = "Relatório ainda não concluído para este lote.";
  }
  conteudo.dataset.carregado = "1";
}

function aplicarDecisao(artigo, modelo) {
  const atual = estado.decisoes[modelo.id];
  artigo.dataset.decisao = atual || "pendente";
  artigo.querySelectorAll("[data-decisao]").forEach((botao) => botao.classList.toggle("ativo", botao.dataset.decisao === atual));
}

function criarModelo(modelo) {
  const artigo = template.content.firstElementChild.cloneNode(true);
  artigo.dataset.id = modelo.id;
  artigo.dataset.grupo = modelo.grupo;
  artigo.querySelector(".modelo-tipo").textContent = modelo.grupo === "novo" ? "Maquete nova" : "Maquete aprimorada";
  artigo.querySelector(".modelo-nome").textContent = modelo.nome;
  artigo.querySelector(".modelo-bairro").textContent = modelo.bairro;
  const antes = artigo.querySelector(".quadro-antes");
  const depois = artigo.querySelector(".quadro-depois");
  if (modelo.grupo === "existente") definirImagem(antes.querySelector("img"), antes, caminhoRender(modelo, "glb"), `${modelo.nome}, versão anterior, vista ${estado.vista}`);
  definirImagem(depois.querySelector("img"), depois, caminhoRender(modelo, "tsx"), `${modelo.nome}, versão nova, vista ${estado.vista}`);
  artigo.querySelectorAll("[data-decisao]").forEach((botao) => botao.addEventListener("click", () => {
    estado.decisoes[modelo.id] = estado.decisoes[modelo.id] === botao.dataset.decisao ? undefined : botao.dataset.decisao;
    if (!estado.decisoes[modelo.id]) delete estado.decisoes[modelo.id];
    localStorage.setItem("aprovacao-marcos3d", JSON.stringify(estado.decisoes));
    aplicarDecisao(artigo, modelo);
    atualizarPlacar();
    filtrar();
  }));
  const details = artigo.querySelector("details");
  details.addEventListener("toggle", () => details.open && carregarDiagnostico(modelo, artigo.querySelector(".diagnostico-conteudo")));
  verificarGlb(modelo, artigo.querySelector(".estado-tecnico"));
  aplicarDecisao(artigo, modelo);
  return artigo;
}

function montar() {
  lista.replaceChildren(...MODELOS.map(criarModelo));
  document.querySelector("#faixa-renders").replaceChildren(...["centro", "reitoriaUfc", "castelao", "theatroJoseDeAlencar", "messejana"].map((id) => {
    const img = document.createElement("img"); img.src = `/renders/${id}/tsx-perspectiva.png`; img.alt = ""; return img;
  }));
  atualizarPlacar();
}

function filtrar() {
  const q = normalizar(estado.busca);
  let visiveis = 0;
  MODELOS.forEach((modelo) => {
    const artigo = lista.querySelector(`[data-id="${modelo.id}"]`);
    const bateTexto = normalizar(`${modelo.nome} ${modelo.bairro}`).includes(q);
    const bateFiltro = estado.filtro === "todos" || modelo.grupo === estado.filtro || (estado.filtro === "revisar" && estado.decisoes[modelo.id] === "revisar");
    artigo.hidden = !(bateTexto && bateFiltro);
    if (!artigo.hidden) visiveis++;
  });
  lista.querySelector(".vazio")?.remove();
  if (!visiveis) { const p = document.createElement("p"); p.className = "vazio"; p.textContent = "Nenhuma maquete corresponde a este filtro."; lista.append(p); }
}

function trocarVista(vista) {
  estado.vista = VISTAS.includes(vista) ? vista : "perspectiva";
  document.querySelectorAll(".vista").forEach((b) => b.classList.toggle("ativo", b.dataset.vista === estado.vista));
  MODELOS.forEach((modelo) => {
    const artigo = lista.querySelector(`[data-id="${modelo.id}"]`);
    if (modelo.grupo === "existente") definirImagem(artigo.querySelector(".quadro-antes img"), artigo.querySelector(".quadro-antes"), caminhoRender(modelo, "glb"), `${modelo.nome}, versão anterior, vista ${estado.vista}`);
    definirImagem(artigo.querySelector(".quadro-depois img"), artigo.querySelector(".quadro-depois"), caminhoRender(modelo, "tsx"), `${modelo.nome}, versão nova, vista ${estado.vista}`);
  });
}

function atualizarPlacar() {
  const valores = Object.values(estado.decisoes);
  const aprovados = valores.filter((x) => x === "aprovado").length;
  const revisar = valores.filter((x) => x === "revisar").length;
  document.querySelector("#total-aprovados").textContent = aprovados;
  document.querySelector("#total-revisar").textContent = revisar;
  document.querySelector("#total-pendentes").textContent = MODELOS.length - aprovados - revisar;
}

document.querySelectorAll(".filtro").forEach((botao) => botao.addEventListener("click", () => {
  estado.filtro = botao.dataset.filtro;
  document.querySelectorAll(".filtro").forEach((b) => b.classList.toggle("ativo", b === botao));
  filtrar();
}));
document.querySelectorAll(".vista").forEach((botao) => botao.addEventListener("click", () => trocarVista(botao.dataset.vista)));
document.querySelector("#busca").addEventListener("input", (e) => { estado.busca = e.target.value; filtrar(); });
document.querySelector("#exportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ geradoEm: new Date().toISOString(), decisoes: estado.decisoes }, null, 2)], { type: "application/json" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "aprovacao-marcos3d.json" });
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

montar();
