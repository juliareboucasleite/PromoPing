import { salvarProdutos } from './storage.js';
import { gerarHistorico } from './historico.js';
import { identificarProduto } from './utils.js';

export function adicionarProduto() {
    const inputLink = document.querySelector('input[type="text"]');
    const inputData = document.querySelector('input[type="date"]');
    const tabela = document.querySelector('table');

    const link = inputLink.value.trim();
    const data = inputData.value;

    if (!link || !data) {
        alert("Preencha todos os campos!");
        return;
    }

    const anoSelecionado = parseInt(data.split("-")[0], 10);
    if (anoSelecionado < 2025) {
        alert("Data inválida. Só a partir de 2025.");
        return;
    }

    const produto = {
        nome: identificarProduto(link),
        link: link,
        preco: "100€",
        data: data,
        status: "Ativo"
    };

    adicionarProdutoNaTabela(produto);
    salvarProdutos();

    inputLink.value = "";
    inputData.value = "";
}

export function adicionarProdutoNaTabela(produto) {
    const tabela = document.querySelector('table');
    const novaLinha = tabela.insertRow(-1);

    novaLinha.innerHTML = `
    <td>${produto.nome}</td>
    <td><a href="${produto.link}" target="_blank">Ver produto</a></td>
    <td>${produto.preco}</td>
    <td>${produto.data}</td>
    <td>${produto.status}</td>
    <td>
      <button class="editar">Editar</button>
      <button class="remover">Remover</button>
      <button class="historico">Histórico</button>
    </td>
  `;

    // Editar
    novaLinha.querySelector('.editar').addEventListener('click', () => {
        const novaData = prompt("Nova data (AAAA-MM-DD):", produto.data);
        if (novaData) {
            novaLinha.cells[3].innerText = novaData;
            salvarProdutos();
        }
    });

    // Remover
    novaLinha.querySelector('.remover').addEventListener('click', () => {
        tabela.deleteRow(novaLinha.rowIndex);
        salvarProdutos();
    });

    // Histórico
    novaLinha.querySelector('.historico').addEventListener('click', () => {
        gerarHistorico(produto);
    });

    // expor função global para storage.js usar
    window.adicionarProdutoNaTabela = adicionarProdutoNaTabela;
}