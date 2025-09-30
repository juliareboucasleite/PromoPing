using MySql.Data.MySqlClient;
using System;
using System.Configuration;
using System.Windows.Forms;
using BCrypt.Net;

namespace Painel_Admin
{
    public partial class FormRegistar : Form
    {
        public FormRegistar()
        {
            InitializeComponent();
        }

        private void FormRegistar_Load(object sender, EventArgs e)
        {
            TxtNome.Clear();
            TxtEmail.Clear();
            TxtSenha.Clear();
        }

        private void BotaoEntrar_Click(object sender, EventArgs e)
        {
            string nome = TxtNome.Text.Trim();
            string email = TxtEmail.Text.Trim();
            string senha = TxtSenha.Text.Trim();

            if (string.IsNullOrEmpty(nome) || string.IsNullOrEmpty(email) || string.IsNullOrEmpty(senha))
            {
                MessageBox.Show("⚠ Preencha todos os campos!");
                return;
            }

            try
            {
                // Gera hash seguro da senha
                string senhaHash = BCrypt.Net.BCrypt.HashPassword(senha);

                string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
                using (var con = new MySqlConnection(connStr))
                {
                    con.Open();

                    // Verifica duplicados
                    var checkCmd = new MySqlCommand("SELECT COUNT(*) FROM utilizadores WHERE Email=@mail", con);
                    checkCmd.Parameters.AddWithValue("@mail", email);
                    long count = (long)checkCmd.ExecuteScalar();
                    if (count > 0)
                    {
                        MessageBox.Show("❌ Já existe um utilizador registado com este email!");
                        return;
                    }

                    // Insere sempre como ADMIN (PerfilId = 1)
                    string query = @"INSERT INTO utilizadores 
                                    (Nome, Email, SenhaHash, Ativo, PerfilId, Data_Registo)
                                    VALUES (@nome, @mail, @senhaHash, 1, 1, NOW())";

                    using (var cmd = new MySqlCommand(query, con))
                    {
                        cmd.Parameters.AddWithValue("@nome", nome);
                        cmd.Parameters.AddWithValue("@mail", email);
                        cmd.Parameters.AddWithValue("@senhaHash", senhaHash);
                        cmd.ExecuteNonQuery();
                    }
                }

                MessageBox.Show("✅ Utilizador Admin registado com sucesso!");
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("❌ Erro ao registar: " + ex.Message);
            }
        }

        private void BotaoLimpar_Click(object sender, EventArgs e)
        {
            TxtNome.Clear();
            TxtEmail.Clear();
            TxtSenha.Clear();
        }

        private void btnLogin(object sender, EventArgs e)
        {
            this.Hide();
            using (var login = new FormLogin())
            {
                login.ShowDialog();
            }
            this.Show();
        }
    }
}
