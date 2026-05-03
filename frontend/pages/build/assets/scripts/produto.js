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
        alert("Fill in all fields!");
        return;
    }

    const anoSelecionado = parseInt(data.split("-")[0], 10);
    if (anoSelecionado < 2025) {
        alert("Invalid date. Only 2025 onward is allowed.");
        return;
    }

    const produto = {
        nome: identificarProduto(link),
        link: link,
        preco: "100€",
        data: data,
        status: "Active"
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
    <td><a href="${produto.link}" target="_blank">View product</a></td>
    <td>${produto.preco}</td>
    <td>${produto.data}</td>
    <td>${produto.status}</td>
    <td>
      <button class="editar">Edit</button>
      <button class="remover">Remove</button>
      <button class="historico">History</button>
    </td>
  `;

    // Edit
    novaLinha.querySelector('.editar').addEventListener('click', () => {
        const novaData = prompt("New date (YYYY-MM-DD):", produto.data);
        if (novaData) {
            novaLinha.cells[3].innerText = novaData;
            salvarProdutos();
        }
    });

    // Remove
    novaLinha.querySelector('.remover').addEventListener('click', () => {
        tabela.deleteRow(novaLinha.rowIndex);
        salvarProdutos();
    });

    // History
    novaLinha.querySelector('.historico').addEventListener('click', () => {
        gerarHistorico(produto);
    });

    // expor função global para storage.js usar
    window.adicionarProdutoNaTabela = adicionarProdutoNaTabela;
}