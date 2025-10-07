using System;
using System.Windows.Forms;
using BCrypt.Net;

namespace Painel_Admin.Utilizadores
{
    public partial class FormAdicionar : Form
    {
        private readonly UtilizadorRepository _repo;

        public FormAdicionar()
        {
            InitializeComponent();
            _repo = new UtilizadorRepository();
            if (cmbPlano.Items.Count > 0)
                cmbPlano.SelectedIndex = 0; 

            if (cmbCanal.Items.Count > 0)
                cmbCanal.SelectedIndex = 0; 

            if (ComboTipoUtilizador.Items.Count > 0)
                ComboTipoUtilizador.SelectedIndex = 1; 
        }

        private void txtNome_TextChanged(object sender, EventArgs e) { }
        private void txtEmail_TextChanged(object sender, EventArgs e) { }
        private void txtSenha_TextChanged(object sender, EventArgs e) { }
        private void cmbPlano_SelectedIndexChanged(object sender, EventArgs e) { }
        private void cmbCanal_SelectedIndexChanged(object sender, EventArgs e) { }
        private void clbNotificacoes_SelectedIndexChanged(object sender, EventArgs e) { }
        private void chkAtivo_CheckedChanged(object sender, EventArgs e) { }
        private void ComboTipoUtilizador_SelectedIndexChanged(object sender, EventArgs e) { }

        private void btnSalvar_Click(object sender, EventArgs e)
        {
            try
            {
                string nome = txtNome.Text.Trim();
                string email = txtEmail.Text.Trim();
                string senha = txtSenha.Text.Trim();
                bool ativo = chkAtivo.Checked;
                string plano = cmbPlano.SelectedItem?.ToString() ?? "free";
                string canal = cmbCanal.SelectedItem?.ToString() ?? "email";
                string tipo = ComboTipoUtilizador.SelectedItem?.ToString() ?? "Utilizador";
                string notificacoes = ObterNotificacoesSelecionadas();
                int perfilId = tipo == "Admin" ? 1 : 2;

                if (string.IsNullOrEmpty(nome) || string.IsNullOrEmpty(email) || string.IsNullOrEmpty(senha))
                {
                    MessageBox.Show("⚠ Por favor, preencha Nome, Email e Senha.", "Campos obrigatórios", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                string senhaHash = BCrypt.Net.BCrypt.HashPassword(senha);
                _repo.Add(nome, email, senhaHash, "", ativo, perfilId);

                MessageBox.Show("✅ Utilizador adicionado com sucesso!", "Sucesso", MessageBoxButtons.OK, MessageBoxIcon.Information);

                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("❌ Erro ao adicionar utilizador: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void btnCancelar_Click(object sender, EventArgs e)
        {
            this.DialogResult = DialogResult.Cancel;
            this.Close();
        }
        private string ObterNotificacoesSelecionadas()
        {
            string result = "";
            foreach (var item in clbNotificacoes.CheckedItems)
            {
                result += item.ToString() + "; ";
            }
            return result.TrimEnd(' ', ';');
        }
    }
}
