using MySql.Data.MySqlClient;
using Painel_Admin.Auth; // ← adiciona isto para aceder ao Sessao

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
                    string query = "SELECT Id, Nome, Email, Senha FROM utilizadores WHERE Nome = @nome";
                    MySqlCommand cmd = new MySqlCommand(query, con);
                    cmd.Parameters.AddWithValue("@nome", username);

                    MySqlDataReader reader = cmd.ExecuteReader();

                    if (reader.Read())
                    {
                        string senhaDb = reader["Senha"].ToString();
                        bool senhaCorreta = false;

                        // Verifica se parece ser um hash BCrypt
                        if (senhaDb.StartsWith("$2a$") || senhaDb.StartsWith("$2b$") || senhaDb.StartsWith("$2y$"))
                        {
                            senhaCorreta = BCrypt.Net.BCrypt.Verify(password, senhaDb);
                        }
                        else
                        {
                            // Comparação direta (texto puro)
                            senhaCorreta = password == senhaDb;
                        }

                        if (senhaCorreta)
                        {
                            // ⚠️ Guardar dados do utilizador logado
                            Sessao.UserId = Convert.ToInt32(reader["Id"]);
                            Sessao.Nome = reader["Nome"].ToString();
                            Sessao.Email = reader["Email"].ToString();

                            MessageBox.Show($"Bem-vindo, {Sessao.Nome}!");

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

        private void AcessarSuporte(object sender, EventArgs e)
        {
            using (var formSuporte = new Suporte())
            {
                formSuporte.ShowDialog();
            }
        }
    }
}
