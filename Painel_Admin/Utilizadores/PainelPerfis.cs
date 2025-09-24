using MySql.Data.MySqlClient;
using System;
using System.Configuration;
using System.Data;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class PainelPerfis : Form
    {
        public PainelPerfis()
        {
            InitializeComponent();
            CarregarPerfis();
        }

        private void PainelPerfis_Load(object sender, EventArgs e)
        {
            CarregarPerfis();
        }

        private void CarregarPerfis()
        {
            try
            {
                string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;

                using (MySqlConnection con = new MySqlConnection(connStr))
                {
                    con.Open();
                    string query = @"
                        SELECT u.id, u.nome, u.email, u.senha, u.telefone, 
                               c.Plano, c.LimiteProdutos
                        FROM utilizadores u
                        LEFT JOIN configutilizador c ON u.id = c.UserId";

                    MySqlDataAdapter adapter = new MySqlDataAdapter(query, con);
                    DataTable dt = new DataTable();
                    adapter.Fill(dt);

                    dgvPerfis.DataSource = dt;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao carregar perfis: " + ex.Message);
            }
        }

        private void btnAdicionar_Click(object sender, EventArgs e)
        {
            FormRegistar frm = new FormRegistar();
            if (frm.ShowDialog() == DialogResult.OK)
            {
                CarregarPerfis();
            }
        }

        private void btnEditar_Click(object sender, EventArgs e)
        {
            if (dgvPerfis.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvPerfis.CurrentRow.Cells["id"].Value);
                string nome = dgvPerfis.CurrentRow.Cells["nome"].Value.ToString();
                string email = dgvPerfis.CurrentRow.Cells["email"].Value.ToString();
                string telefone = dgvPerfis.CurrentRow.Cells["telefone"].Value.ToString();
                string plano = dgvPerfis.CurrentRow.Cells["Plano"].Value.ToString();

                // valores adicionais (canal e ativo) — puxar depois do banco ou default
                string canal = "email";
                bool ativo = true;

                FormPerfilEditar frm = new FormPerfilEditar(id, nome, email, telefone, plano, canal, ativo);
                if (frm.ShowDialog() == DialogResult.OK)
                {
                    CarregarPerfis(); // recarregar depois de editar
                }
            }
        }

        private void btnRemover_Click(object sender, EventArgs e)
        {
            if (dgvPerfis.SelectedRows.Count > 0)
            {
                int id = Convert.ToInt32(dgvPerfis.SelectedRows[0].Cells["Id"].Value);

                string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
                using (MySqlConnection con = new MySqlConnection(connStr))
                {
                    con.Open();
                    // remove utilizador (configutilizador é ON DELETE CASCADE se FK configurada)
                    MySqlCommand cmd = new MySqlCommand("DELETE FROM utilizadores WHERE Id=@id", con);
                    cmd.Parameters.AddWithValue("@id", id);
                    cmd.ExecuteNonQuery();
                }

                CarregarPerfis();
            }
        }

        private void btnAtualizar_Click(object sender, EventArgs e)
        {
            CarregarPerfis();
        }

        private void panelBotoes_Paint(object sender, PaintEventArgs e)
        {

        }
    }
}
