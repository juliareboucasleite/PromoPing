using MySql.Data.MySqlClient;
using System;
using System.Configuration;
using System.Windows.Forms;
using BCrypt.Net; // Biblioteca para hash de senha

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
                MessageBox.Show("Preencha todos os campos!");
                return;
            }

            try
            {
                string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
                using (var con = new MySqlConnection(connStr))
                {
                    con.Open();
                    string query = @"INSERT INTO utilizadores (nome, email, senha, ativo, data_registo) 
                             VALUES (@nome, @mail, @senha, 1, NOW())";

                    MySqlCommand cmd = new MySqlCommand(query, con);
                    cmd.Parameters.AddWithValue("@nome", nome);
                    cmd.Parameters.AddWithValue("@mail", email);
                    cmd.Parameters.AddWithValue("@senha", senha);

                    cmd.ExecuteNonQuery();
                }

                MessageBox.Show("Utilizador registado com sucesso!");
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao registar: " + ex.Message);
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
