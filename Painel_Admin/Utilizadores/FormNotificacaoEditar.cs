using Painel_Admin.Repositories;
using System;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class FormNotificacaoEditar : Form
    {
        private readonly PreferenciaNotificacaoRepository _repo;
        private int _id; // 0 = novo, >0 = editar

        public FormNotificacaoEditar()
        {
            InitializeComponent();
            _repo = new PreferenciaNotificacaoRepository();
            _id = 0;
        }

        // Construtor para edição
        public FormNotificacaoEditar(int id, int userId, string tipo, bool ativo)
        {
            InitializeComponent();
            _repo = new PreferenciaNotificacaoRepository();
            _id = id;

            txtUserId.Text = userId.ToString();
            cmbTipo.SelectedItem = tipo;
            chkAtivo.Checked = ativo;
        }

        private void btnSalvar_Click(object sender, EventArgs e)
        {
            try
            {
                int userId = int.Parse(txtUserId.Text);
                string tipo = cmbTipo.SelectedItem?.ToString() ?? "email";
                bool ativo = chkAtivo.Checked;

                if (_id == 0)
                {
                    _repo.Add(userId, tipo, ativo);
                }
                else
                {
                    _repo.Update(_id, userId, tipo, ativo);
                }

                MessageBox.Show("Preferência salva com sucesso!");
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
    }
}
