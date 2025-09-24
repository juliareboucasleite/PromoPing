using MySql.Data.MySqlClient;
using System;
using System.Configuration;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class PainelForm : Form
    {
        public PainelForm()
        {
            InitializeComponent();
        }

        private void Painel_Load(object sender, EventArgs e)
        {
            AtualizarDashboard();
        }

        private void btnAtualizarDashboard_Click_1(object sender, EventArgs e)
        {
            AtualizarDashboard();
        }

        private void AtualizarDashboard()
        {
            string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
            using (var con = new MySqlConnection(connStr))
            {
                con.Open();

                // Total de utilizadores
                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM utilizadores", con))
                {
                    lblTotalUsers.Text = $"Utilizadores: {cmd.ExecuteScalar()}";
                }

                // Total de produtos
                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM produtos", con))
                {
                    lblTotalProdutos.Text = $"Produtos: {cmd.ExecuteScalar()}";
                }

                // Total de notificações ativas
                using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM preferenciasnotificacao WHERE Ativo=1", con))
                {
                    lblTotalNotificacoes.Text = $"Notificações: {cmd.ExecuteScalar()}";
                }

                // Total poupado
                using (var cmd = new MySqlCommand("SELECT IFNULL(SUM(DinheiroPoupado),0) FROM perfilutilizador", con))
                {
                    lblTotalPoupado.Text = $"Poupado: €{cmd.ExecuteScalar()}";
                }
            }
        }

        private void editarProdutosToolStripMenuItem_Click(object sender, EventArgs e)
        {
            new ProdutosListForm().ShowDialog();
        }

        private void painelPerfisToolStripMenuItem_Click(object sender, EventArgs e)
        {
            new PainelPerfis().ShowDialog();
        }

        private void perfilDetalhesToolStripMenuItem_Click(object sender, EventArgs e)
        {
            // abrir detalhes de um utilizador específico (exemplo: id=1)
            new FormPerfilDetalhes(1).ShowDialog();
        }

        private void perfilEditarToolStripMenuItem_Click(object sender, EventArgs e)
        {
            // abrir editor de um utilizador específico (exemplo: id=1)
            new FormPerfilEditar(1, "Nome", "email@teste.com", "999999999", "free", "email", true).ShowDialog();
        }

        private void picProdutos_Click(object sender, EventArgs e)
        {

        }

        private void lblTotalProdutos_Click(object sender, EventArgs e)
        {

        }
    }
}
