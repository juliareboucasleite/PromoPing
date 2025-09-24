using Painel_Admin.Repositories;
using System;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class FormNotificacoes : Form
    {
        private readonly PreferenciaNotificacaoRepository _repo;

        public FormNotificacoes()
        {
            InitializeComponent();
            _repo = new PreferenciaNotificacaoRepository();
        }

        private void FormNotificacoes_Load(object sender, EventArgs e)
        {
            CarregarPreferencias();
        }

        private void CarregarPreferencias()
        {
            dgvNotificacoes.DataSource = _repo.GetAll();
        }

        private void btnAdicionar_Click(object sender, EventArgs e)
        {
            FormNotificacaoEditar form = new FormNotificacaoEditar();
            if (form.ShowDialog() == DialogResult.OK)
            {
                CarregarPreferencias();
            }
        }

        private void btnEditar_Click(object sender, EventArgs e)
        {
            if (dgvNotificacoes.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvNotificacoes.CurrentRow.Cells["Id"].Value);
                int userId = Convert.ToInt32(dgvNotificacoes.CurrentRow.Cells["UserId"].Value);
                string tipo = dgvNotificacoes.CurrentRow.Cells["Tipo"].Value.ToString();
                bool ativo = Convert.ToBoolean(dgvNotificacoes.CurrentRow.Cells["Ativo"].Value);

                FormNotificacaoEditar form = new FormNotificacaoEditar(id, userId, tipo, ativo);
                if (form.ShowDialog() == DialogResult.OK)
                {
                    CarregarPreferencias();
                }
            }
        }

        private void btnRemover_Click(object sender, EventArgs e)
        {
            if (dgvNotificacoes.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvNotificacoes.CurrentRow.Cells["Id"].Value);
                if (MessageBox.Show("Deseja realmente remover esta preferência?", "Confirmação",
                    MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes)
                {
                    _repo.Delete(id);
                    CarregarPreferencias();
                }
            }
        }

        private void btnAtualizar_Click(object sender, EventArgs e)
        {
            CarregarPreferencias();
        }
    }
}
