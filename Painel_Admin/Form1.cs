using System;
using System.Data;
using System.Windows.Forms;
using MySql.Data.MySqlClient;
using System.Configuration;

namespace Painel_Admin
{
    public partial class Painel : Form
    {
        public Painel()
        {
            InitializeComponent();

            // Liga os eventos dos menus
            PainelPrincipal.Click += PainelPrincipal_Click;
            produtosToolStripMenuItem.Click += ProdutosToolStripMenuItem_Click;
        }

        private void Painel_Load(object sender, EventArgs e)
        {
            // Aqui podes colocar um "bem-vindo" ou carregar algo padrão
            MessageBox.Show("Bem-vindo ao Painel de Administração!");
        }



        // Clique no menu "Utilizadores"
        private void PainelPrincipal_Click(object sender, EventArgs e)
        {
            try
            {
                string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;

                using (MySqlConnection con = new MySqlConnection(connStr))
                {
                    con.Open();
                    string query = "SELECT id, nome, email, perfil, ativo, telefone, dinheiro_poupado FROM utilizadores";
                    MySqlDataAdapter adapter = new MySqlDataAdapter(query, con);

                    DataTable dt = new DataTable();
                    adapter.Fill(dt);

                    dgvUtilizadores.DataSource = dt;

                    // Mostrar apenas Utilizadores
                    dgvUtilizadores.Visible = true;
                    dgvProdutos.Visible = false;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao carregar utilizadores: " + ex.Message);
            }
        }

        // Clique no menu "Produtos"
        private void ProdutosToolStripMenuItem_Click(object sender, EventArgs e)
        {
            try
            {
                string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;

                using (MySqlConnection con = new MySqlConnection(connStr))
                {
                    con.Open();
                    string query = "SELECT Id, UserId, Nome, Link, PrecoAlvo, DataLimite, Loja FROM produtos";
                    MySqlDataAdapter adapter = new MySqlDataAdapter(query, con);

                    DataTable dt = new DataTable();
                    adapter.Fill(dt);

                    dgvProdutos.DataSource = dt;

                    // Mostrar apenas Produtos
                    dgvProdutos.Visible = true;
                    dgvUtilizadores.Visible = false;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao carregar produtos: " + ex.Message);
            }
        }
    }
}
