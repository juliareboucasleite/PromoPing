using MySql.Data.MySqlClient;
using System;
using System.Configuration;
using System.Data;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class FormUtilizadoresList : Form
    {
        public FormUtilizadoresList()
        {
            InitializeComponent();
        }

        private void FormUtilizadoresList_Load(object sender, EventArgs e)
        {
            CarregarUtilizadores();
        }

        private void CarregarUtilizadores()
        {
            string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
            using (var con = new MySqlConnection(connStr))
            {
                con.Open();
                string query = "SELECT Id, Nome, Email, Telefone, Plano, Ativo FROM perfilutilizador";
                var adapter = new MySqlDataAdapter(query, con);
                var dt = new DataTable();
                adapter.Fill(dt);
                dgvUtilizadores.DataSource = dt;
            }
        }

        private void btnAdicionar_Click(object sender, EventArgs e)
        {
            FormPerfilEditar form = new FormPerfilEditar(0, "", "", "", "free", "email", true);
            if (form.ShowDialog() == DialogResult.OK)
            {
                CarregarUtilizadores();
            }
        }

        private void btnEditar_Click(object sender, EventArgs e)
        {
            if (dgvUtilizadores.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvUtilizadores.CurrentRow.Cells["Id"].Value);
                string nome = dgvUtilizadores.CurrentRow.Cells["Nome"].Value.ToString();
                string email = dgvUtilizadores.CurrentRow.Cells["Email"].Value.ToString();
                string telefone = dgvUtilizadores.CurrentRow.Cells["Telefone"].Value.ToString();
                string plano = dgvUtilizadores.CurrentRow.Cells["Plano"].Value.ToString();
                bool ativo = Convert.ToBoolean(dgvUtilizadores.CurrentRow.Cells["Ativo"].Value);

                string canal = "email";
                string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
                using (var con = new MySqlConnection(connStr))
                {
                    con.Open();
                    var cmd = new MySqlCommand("SELECT CanalPreferido FROM configutilizador WHERE UserId=@id", con);
                    cmd.Parameters.AddWithValue("@id", id);
                    var result = cmd.ExecuteScalar();
                    if (result != null) canal = result.ToString();
                }

                FormPerfilEditar form = new FormPerfilEditar(id, nome, email, telefone, plano, canal, ativo);
                if (form.ShowDialog() == DialogResult.OK)
                {
                    CarregarUtilizadores();
                }
            }
        }

        private void btnDetalhes_Click(object sender, EventArgs e)
        {
            if (dgvUtilizadores.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvUtilizadores.CurrentRow.Cells["Id"].Value);
                FormPerfilDetalhes form = new FormPerfilDetalhes(id);
                form.ShowDialog();
            }
        }

        private void btnRemover_Click(object sender, EventArgs e)
        {
            if (dgvUtilizadores.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvUtilizadores.CurrentRow.Cells["Id"].Value);
                if (MessageBox.Show("Remover este utilizador?", "Confirmação", MessageBoxButtons.YesNo) == DialogResult.Yes)
                {
                    string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
                    using (var con = new MySqlConnection(connStr))
                    {
                        con.Open();
                        var cmd = new MySqlCommand("DELETE FROM utilizadores WHERE Id=@id", con);
                        cmd.Parameters.AddWithValue("@id", id);
                        cmd.ExecuteNonQuery();
                    }
                    CarregarUtilizadores();
                }
            }
        }

        private void btnAtualizar_Click(object sender, EventArgs e)
        {
            CarregarUtilizadores();
        }
    }
}
