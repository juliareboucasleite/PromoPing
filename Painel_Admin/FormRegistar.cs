using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class FormRegistar : Form
    {
        public FormRegistar()
        {
            InitializeComponent();
        }

        private void BotaoEntrar_Click(object sender, EventArgs e)
        {
            string nome = TxtNome.Text;
            string email = TxtEmail.Text;
            string senha = TxtSenha.Text;

            if (string.IsNullOrWhiteSpace(nome) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(senha))
            {
                MessageBox.Show("⚠️ Preencha todos os campos!");
                return;
            }

            using (var con = new MySqlConnection(DbConfig.ConnString))
            {
                try
                {
                    con.Open();
                    string query = @"INSERT INTO utilizadores (nome, email, senha, perfil, ativo, data_registo) 
                                     VALUES (@nome, @email, @senha, 'user', 1, NOW())";
                    MySqlCommand cmd = new MySqlCommand(query, con);
                    cmd.Parameters.AddWithValue("@nome", nome);
                    cmd.Parameters.AddWithValue("@email", email);
                    cmd.Parameters.AddWithValue("@senha", senha);

                    int rows = cmd.ExecuteNonQuery();

                    if (rows > 0)
                    {
                        MessageBox.Show("✅ Utilizador registrado com sucesso!");
                        this.Close();
                    }
                    else
                    {
                        MessageBox.Show("❌ Falha ao registrar utilizador.");
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Erro: " + ex.Message);
                }
            }
        }



        private void BotaoLimpar_Click(object sender, EventArgs e)
        {
            TxtNome.Clear();
            TxtSenha.Clear();
        }

        private void btnLogin(object sender, EventArgs e)
        {
            // Abre o formulário de Login
            FormLogin formlogin = new FormLogin();
            formlogin.ShowDialog();
            
        }
    }
}
