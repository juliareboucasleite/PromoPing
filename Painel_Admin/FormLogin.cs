using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.ComponentModel;
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
            string nome = TxtNome.Text;
            string senha = TxtSenha.Text;

            using (var con = new MySqlConnection(DbConfig.ConnString))
            {
                try
                {
                    con.Open();
                    string query = "SELECT * FROM utilizadores WHERE nome=@nome AND senha=@senha AND ativo=1";
                    MySqlCommand cmd = new MySqlCommand(query, con);
                    cmd.Parameters.AddWithValue("@nome", nome);
                    cmd.Parameters.AddWithValue("@senha", senha);

                    var reader = cmd.ExecuteReader();

                    if (reader.Read())
                    {
                        string perfil = reader["perfil"].ToString();
                        if (perfil == "admin")
                        {
                            MessageBox.Show($"Bem-vindo administrador {reader["nome"]}!");
                            Painel painel = new Painel();
                            painel.Show();
                            this.Hide();
                        }
                        else
                        {
                            MessageBox.Show("Acesso negado! Apenas administradores podem entrar.");
                        }
                    }
                    else
                    {
                        MessageBox.Show("Utilizador ou senha inválidos!");
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

        private void AcessoRegistar(object sender, EventArgs e)
        {
            // Abre o formulário de Registro
            FormRegistar formRegistar = new FormRegistar();
            formRegistar.ShowDialog();
            

        }
    }
}
