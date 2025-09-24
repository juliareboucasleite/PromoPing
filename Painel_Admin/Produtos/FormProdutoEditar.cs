using Painel_Admin.Repositories;
using System;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class FormProdutoEditar : Form
    {
        private readonly ProdutoRepository _produtoRepo;
        private int _id; // se 0 = novo produto, se > 0 = edição

        public FormProdutoEditar()
        {
            InitializeComponent();
            _produtoRepo = new ProdutoRepository();
            _id = 0;
        }

        // Construtor para edição de produto existente
        public FormProdutoEditar(int id, int userId, string nome, string link, decimal precoAlvo, DateTime? dataLimite, string loja)
        {
            InitializeComponent();
            _produtoRepo = new ProdutoRepository();

            _id = id;

            // Preenche os campos
            txtNome.Text = nome;
            txtLink.Text = link;
            txtPrecoAlvo.Text = precoAlvo.ToString("0.00");
            if (dataLimite.HasValue)
                dtpDataLimite.Value = dataLimite.Value;
            txtLoja.Text = loja;
        }

        private void btnSalvar_Click(object sender, EventArgs e)
        {
            try
            {
                int userId = 1; // ⚠️ Exemplo fixo (depois podemos integrar com login)

                string nome = txtNome.Text;
                string link = txtLink.Text;
                decimal precoAlvo = decimal.TryParse(txtPrecoAlvo.Text, out decimal preco) ? preco : 0;
                DateTime? dataLimite = dtpDataLimite.Value;
                string loja = txtLoja.Text;

                if (_id == 0)
                {
                    // Novo produto
                    _produtoRepo.Add(userId, nome, link, precoAlvo, dataLimite, loja);
                }
                else
                {
                    // Atualizar produto existente
                    _produtoRepo.Update(_id, userId, nome, link, precoAlvo, dataLimite, loja);
                }

                MessageBox.Show("Produto salvo com sucesso!");
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao salvar produto: " + ex.Message);
            }
        }

        private void btnCancelar_Click(object sender, EventArgs e)
        {
            this.DialogResult = DialogResult.Cancel;
            this.Close();
        }

        private void FormProdutoEditar_Load(object sender, EventArgs e)
        {
            // opcional: inicializar defaults
        }
    }
}
