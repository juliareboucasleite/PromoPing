using MySql.Data.MySqlClient;
using System;
using System.Configuration;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class FormPerfilEditar : Form
    {
        private int _userId;

        public FormPerfilEditar(int userId, string nome, string email, string telefone, string plano, string canal, bool ativo)
        {
            InitializeComponent();
            _userId = userId;

            // Preenche os campos
            txtNome.Text = nome;
            txtEmail.Text = email;
            txtTelefone.Text = telefone;
            cmbPlano.SelectedItem = plano;
            cmbCanal.SelectedItem = canal;
            chkAtivo.Checked = ativo;

            // Lista de notificações
            clbNotificacoes.Items.Clear();
            clbNotificacoes.Items.Add("Email", false);
            clbNotificacoes.Items.Add("Discord", false);
            clbNotificacoes.Items.Add("Telegram", false);
            clbNotificacoes.Items.Add("WhatsApp", false);
        }

        // 🔹 Load do formulário
        private void FormPerfilEditar_Load(object sender, EventArgs e)
        {
            CarregarPreferencias();
        }

        private void CarregarPreferencias()
        {
            try
            {
                using (var con = new MySqlConnection(DbConfig.ConnectionString))
                {
                    con.Open();
                    string query = "SELECT Tipo, Ativo FROM preferenciasnotificacao WHERE UserId=@id";

                    using (var cmd = new MySqlCommand(query, con))
                    {
                        cmd.Parameters.AddWithValue("@id", _userId);

                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                string tipo = reader["Tipo"].ToString();
                                bool ativo = Convert.ToInt32(reader["Ativo"]) == 1;

                                string display = char.ToUpper(tipo[0]) + tipo.Substring(1);
                                int index = clbNotificacoes.Items.IndexOf(display);

                                if (index >= 0)
                                    clbNotificacoes.SetItemChecked(index, ativo);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao carregar preferências: " + ex.Message);
            }
        }

        // 🔹 Botão salvar
        private void btnSalvar_Click(object sender, EventArgs e)
        {
            try
            {
                using (var con = new MySqlConnection(DbConfig.ConnectionString))
                {
                    con.Open();

                    // Atualizar dados principais
                    var cmd = new MySqlCommand(@"
                        UPDATE perfilutilizador 
                        SET Nome=@nome, Email=@mail, Telefone=@tel, Plano=@plano, Ativo=@ativo
                        WHERE UserId=@id;", con);

                    cmd.Parameters.AddWithValue("@id", _userId);
                    cmd.Parameters.AddWithValue("@nome", txtNome.Text);
                    cmd.Parameters.AddWithValue("@mail", txtEmail.Text);
                    cmd.Parameters.AddWithValue("@tel", txtTelefone.Text);
                    cmd.Parameters.AddWithValue("@plano", cmbPlano.SelectedItem?.ToString() ?? "free");
                    cmd.Parameters.AddWithValue("@ativo", chkAtivo.Checked ? 1 : 0);
                    cmd.ExecuteNonQuery();

                    // Atualizar notificações
                    foreach (string item in clbNotificacoes.Items)
                    {
                        int ativo = clbNotificacoes.CheckedItems.Contains(item) ? 1 : 0;

                        var cmd2 = new MySqlCommand(
                            @"UPDATE preferenciasnotificacao 
                              SET Ativo=@ativo 
                              WHERE UserId=@userId AND Tipo=@tipo", con);

                        cmd2.Parameters.AddWithValue("@ativo", ativo);
                        cmd2.Parameters.AddWithValue("@userId", _userId);
                        cmd2.Parameters.AddWithValue("@tipo", item.ToLower());
                        cmd2.ExecuteNonQuery();
                    }
                }

                MessageBox.Show("Perfil atualizado com sucesso!", "Perfil", MessageBoxButtons.OK, MessageBoxIcon.Information);
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao salvar: " + ex.Message);
            }
        }

        // 🔹 Botão cancelar
        private void btnCancelar_Click(object sender, EventArgs e)
        {
            this.DialogResult = DialogResult.Cancel;
            this.Close();
        }
    }
}
