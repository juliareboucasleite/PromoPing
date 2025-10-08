using System;
using System.Data;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class FormNotificacaoEditar : Form
    {
        private readonly PreferenciaNotificacaoRepository _repo;
        private readonly ProdutoRepository _produtoRepo; // para buscar utilizadores
        private int _id; // 0 = novo, >0 = editar

        public FormNotificacaoEditar()
        {
            InitializeComponent();
            _repo = new PreferenciaNotificacaoRepository();
            _produtoRepo = new ProdutoRepository();
            _id = 0;
        }

        // 🔹 Construtor para edição
        public FormNotificacaoEditar(int id, int userId, string tipo, bool ativo)
        {
            InitializeComponent();
            _repo = new PreferenciaNotificacaoRepository();
            _produtoRepo = new ProdutoRepository();
            _id = id;

            CarregarUtilizadores();

            if (userId > 0)
                cmbUser.SelectedValue = userId;

            cmbTipo.SelectedItem = tipo;
            chkAtivo.Checked = ativo;
        }

        private void FormNotificacaoEditar_Load(object sender, EventArgs e)
        {
            CarregarUtilizadores();

            // 🔹 Preenche tipos de notificação
            cmbTipo.Items.Clear();
            cmbTipo.Items.Add("email");
            cmbTipo.Items.Add("whatsapp");
            cmbTipo.Items.Add("discord");
            cmbTipo.Items.Add("telegram");

            if (string.IsNullOrEmpty(cmbTipo.Text))
                cmbTipo.SelectedIndex = 0;
        }

        private void CarregarUtilizadores()
        {
            try
            {
                // Busca todos os utilizadores com produtos
                DataTable dtUsers = _produtoRepo.GetUserIdsComProdutos();

                cmbUser.DataSource = dtUsers;
                cmbUser.DisplayMember = "Nome";
                cmbUser.ValueMember = "Id";
                cmbUser.SelectedIndex = -1;
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao carregar utilizadores: " + ex.Message);
            }
        }

        private void btnSalvar_Click(object sender, EventArgs e)
        {
            try
            {
                if (cmbUser.SelectedValue == null)
                {
                    MessageBox.Show("Selecione um utilizador!");
                    return;
                }

                int userId = Convert.ToInt32(cmbUser.SelectedValue);
                string tipo = cmbTipo.SelectedItem?.ToString() ?? "email";
                bool ativo = chkAtivo.Checked;

                if (_id == 0)
                    _repo.Add(userId, tipo, ativo);
                else
                    _repo.Update(_id, userId, tipo, ativo);

                MessageBox.Show("Preferência salva com sucesso!",
                                "Notificações", MessageBoxButtons.OK, MessageBoxIcon.Information);

                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao salvar: " + ex.Message);
            }
        }

        private void btnCancelar_Click(object sender, EventArgs e)
        {
            this.DialogResult = DialogResult.Cancel;
            this.Close();
        }

        private void FormNotificacaoEditar_Load_1(object sender, EventArgs e)
        {

        }
    }
}
