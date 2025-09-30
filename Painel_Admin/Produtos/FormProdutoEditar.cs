using System;
using System.Windows.Forms;
using Painel_Admin.Auth;

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

            // Marca "Sem limite" por padrão
            chkSemData.Checked = true;
            dtpDataLimite.Enabled = false;
        }

        // Construtor para edição de produto existente
        public FormProdutoEditar(int id, int userId, string nome, string link, decimal precoAlvo, DateTime? dataLimite, string loja)
        {
            InitializeComponent();
            _produtoRepo = new ProdutoRepository();
            _id = id;

            txtNome.Text = nome;
            txtLink.Text = link;
            txtPrecoAlvo.Text = precoAlvo.ToString("0.00");

            if (dataLimite.HasValue)
            {
                dtpDataLimite.Value = dataLimite.Value;
                chkSemData.Checked = false;
                dtpDataLimite.Enabled = true;
            }
            else
            {
                chkSemData.Checked = true;
                dtpDataLimite.Enabled = false;
            }

            txtLoja.Text = loja;
        }

        private void FormProdutoEditar_Load(object sender, EventArgs e)
        {
            // Ativa ou desativa o DateTimePicker conforme o check
            chkSemData.CheckedChanged += (s, ev) =>
            {
                dtpDataLimite.Enabled = !chkSemData.Checked;
            };
        }

        private void btnSalvar_Click(object sender, EventArgs e)
        {
            try
            {
                // Pega sempre o usuário logado
                int userId = Sessao.UserId;

                string nome = txtNome.Text.Trim();
                string link = txtLink.Text.Trim();
                decimal precoAlvo = decimal.TryParse(txtPrecoAlvo.Text, out decimal preco) ? preco : 0;
                DateTime? dataLimite = chkSemData.Checked ? (DateTime?)null : dtpDataLimite.Value;
                string loja = txtLoja.Text.Trim();

                if (string.IsNullOrEmpty(nome) || string.IsNullOrEmpty(link))
                {
                    MessageBox.Show("Nome e Link são obrigatórios!", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                if (_id == 0)
                {
                    // Novo produto → precisa do dono (UserId)
                    _produtoRepo.Add(userId, nome, link, precoAlvo, dataLimite, loja);
                }
                else
                {
                    // Atualizar produto existente → não altera o dono
                    _produtoRepo.Update(_id, nome, link, precoAlvo, dataLimite, loja);
                }

                MessageBox.Show("✅ Produto salvo com sucesso!", "Sucesso", MessageBoxButtons.OK, MessageBoxIcon.Information);
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("❌ Erro ao salvar produto: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void btnCancelar_Click(object sender, EventArgs e)
        {
            this.DialogResult = DialogResult.Cancel;
            this.Close();
        }
    }
}
