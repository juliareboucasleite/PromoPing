using MySql.Data.MySqlClient;
using System;
using System.Configuration;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class FormLogin : Form
    {
        public FormLogin()
        {
            InitializeComponent();
        }

        private void FormLogin_Load(object sender, EventArgs e)
        {
            TxtNome.Clear();
            TxtSenha.Clear();
        }

        private void BotaoEntrar_Click(object sender, EventArgs e)
        {
            string username = TxtNome.Text.Trim();
            string password = TxtSenha.Text.Trim();

            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            {
                MessageBox.Show("Por favor, preencha todos os campos.");
                return;
            }

            string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;

            using (MySqlConnection con = new MySqlConnection(connStr))
            {
                try
                {
                    con.Open();
                    string query = "SELECT Id, Nome, Senha FROM utilizadores WHERE Email = @mail";
                    MySqlCommand cmd = new MySqlCommand(query, con);
                    cmd.Parameters.AddWithValue("@mail", username);

                    MySqlDataReader reader = cmd.ExecuteReader();

                    if (reader.Read())
                    {
                        string senhaHash = reader["Senha"].ToString();

                        if (BCrypt.Net.BCrypt.Verify(password, senhaHash))
                        {
                            string perfil = reader["Nome"].ToString();
                            MessageBox.Show($"Bem-vindo, {perfil}!");

                            this.Hide();
                            using (var formMain = new PainelForm())
                            {
                                formMain.ShowDialog();
                            }
                            this.Show();
                        }
                        else
                        {
                            MessageBox.Show("Senha inválida!");
                        }
                    }
                    else
                    {
                        MessageBox.Show("Utilizador não encontrado!");
                    }

                }
                catch (Exception ex)
                {
                    MessageBox.Show("Erro ao autenticar: " + ex.Message);
                }
            }
        }

        private void BotaoLimpar_Click(object sender, EventArgs e)
        {
            TxtNome.Clear();
            TxtSenha.Clear();
        }

        private void AcessoRegistar(object sender, EventArgs e)
        {
            using (var formRegistar = new FormRegistar())
            {
                formRegistar.ShowDialog();
            }
        }

        private void suporteToolStripMenuItem_Click(object sender, EventArgs e)
        {
            try
            {
                System.Diagnostics.Process.Start("https://github.com/juliareboucasleite"); // teu link de suporte
            }
            catch (Exception ex)
            {
                MessageBox.Show("Não foi possível abrir o suporte: " + ex.Message);
            }
        }
    }
}
