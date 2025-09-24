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
    public partial class FormPerfilEditar : Form
    {
        private int userId = 0;

        public FormPerfilEditar()
        {
            InitializeComponent();
        }

        // Construtor simplificado (apenas id, nome e senha)
        public FormPerfilEditar(int id, string nome, string senha) : this()
        {
            userId = id;
            txtNome.Text = nome;
            txtSenha.Text = senha;
        }

        // Construtor completo (todos os campos)
        public FormPerfilEditar(int id, string nome, string email, string senha, string telefone, string plano, int limiteProdutos) : this()
        {
            userId = id;
            txtNome.Text = nome;
            txtEmail.Text = email;
            txtSenha.Text = senha;
            txtTelefone.Text = telefone;
            txtPlano.Text = plano;
            txtLimiteProdutos.Text = limiteProdutos.ToString();
        }

        private void btnSalvar_Click(object sender, EventArgs e)
        {
            string nome = txtNome.Text.Trim();
            string email = txtEmail.Text.Trim();
            string senha = txtSenha.Text.Trim();
            string telefone = txtTelefone.Text.Trim();
            string plano = txtPlano.Text.Trim();
            int limiteProdutos = int.Parse(txtLimiteProdutos.Text);

            string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;

            using (MySqlConnection con = new MySqlConnection(connStr))
            {
                con.Open();

                MySqlCommand cmd;

                if (userId == 0) // Novo utilizador
                {
                    cmd = new MySqlCommand(@"
                        INSERT INTO utilizadores (nome, email, senha, telefone, ativo, PerfilId, data_registo) 
                        VALUES (@nome, @email, @senha, @telefone, 1, 2, NOW());
                        
                        INSERT INTO configutilizador (UserId, Plano, LimiteProdutos, HistoricoAtivo) 
                        VALUES (LAST_INSERT_ID(), @plano, @limiteProdutos, 1);
                    ", con);
                }
                else // Atualizar existente
                {
                    cmd = new MySqlCommand(@"
                        UPDATE utilizadores 
                        SET nome=@nome, email=@email, senha=@senha, telefone=@telefone 
                        WHERE id=@id;

                        UPDATE configutilizador 
                        SET Plano=@plano, LimiteProdutos=@limiteProdutos 
                        WHERE UserId=@id;
                    ", con);

                    cmd.Parameters.AddWithValue("@id", userId);
                }

                cmd.Parameters.AddWithValue("@nome", nome);
                cmd.Parameters.AddWithValue("@email", email);
                cmd.Parameters.AddWithValue("@senha", senha);
                cmd.Parameters.AddWithValue("@telefone", telefone);
                cmd.Parameters.AddWithValue("@plano", plano);
                cmd.Parameters.AddWithValue("@limiteProdutos", limiteProdutos);

                cmd.ExecuteNonQuery();
            }

            this.DialogResult = DialogResult.OK;
            this.Close();
        }

        private void btnCancelar_Click(object sender, EventArgs e)
        {
            this.DialogResult = DialogResult.Cancel;
            this.Close();
        }

        private void FormPerfilEditar_Load(object sender, EventArgs e)
        {
            // Deixa vazio (caso precises futuramente)
        }
        private void textBox1_TextChanged(object sender, EventArgs e) { }
    }
}