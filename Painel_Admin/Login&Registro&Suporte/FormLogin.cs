using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Configuration;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
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

        }

        private void BotaoEntrar_Click(object sender, EventArgs e)
        {
            string username = TxtNome.Text.Trim();
            string password = TxtSenha.Text.Trim();

            string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;

            using (MySqlConnection con = new MySqlConnection(connStr))
            {
                try
                {
                    con.Open();
                    string query = "SELECT Id, Nome FROM perfis WHERE Nome = @nome AND Senha = @senha";
                    MySqlCommand cmd = new MySqlCommand(query, con);
                    cmd.Parameters.AddWithValue("@nome", username);
                    cmd.Parameters.AddWithValue("@senha", password);

                    MySqlDataReader reader = cmd.ExecuteReader();

                    if (reader.Read())
                    {
                        string perfil = reader["Nome"].ToString();
                        MessageBox.Show($"Bem-vindo, {perfil}!");

                        // Abre o painel principal
                        Painel formMain = new Painel();
                        formMain.Show();
                        this.Hide();
                    }
                    else
                    {
                        MessageBox.Show("Utilizador ou senha inválidos!");
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
            // Abre o formulário de Registro
            FormRegistar formRegistar = new FormRegistar();
            formRegistar.ShowDialog();
            

        }
    }
}
