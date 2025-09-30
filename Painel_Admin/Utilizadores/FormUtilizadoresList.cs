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
            try
            {
                using (var con = new MySqlConnection(DbConfig.ConnectionString))
                {
                    con.Open();
                    string query = "SELECT UserId, Nome, Email, Telefone, Plano, Ativo FROM perfilutilizador";
                    var adapter = new MySqlDataAdapter(query, con);
                    var dt = new DataTable();
                    adapter.Fill(dt);
                    dgvUtilizadores.DataSource = dt;

                    // Ajustar cabeçalhos
                    dgvUtilizadores.Columns["UserId"].HeaderText = "ID";
                    dgvUtilizadores.Columns["Nome"].HeaderText = "Nome";
                    dgvUtilizadores.Columns["Email"].HeaderText = "Email";
                    dgvUtilizadores.Columns["Telefone"].HeaderText = "Telefone";
                    dgvUtilizadores.Columns["Plano"].HeaderText = "Plano";
                    dgvUtilizadores.Columns["Ativo"].HeaderText = "Ativo";
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao carregar utilizadores: " + ex.Message);
            }
        }

        private void btnAdicionar_Click(object sender, EventArgs e)
        {
            var form = new FormPerfilEditar(0, "", "", "", "free", "email", true);
            if (form.ShowDialog() == DialogResult.OK)
                CarregarUtilizadores();
        }

        private void btnEditar_Click(object sender, EventArgs e)
        {
            if (dgvUtilizadores.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvUtilizadores.CurrentRow.Cells["UserId"].Value);
                string nome = dgvUtilizadores.CurrentRow.Cells["Nome"].Value.ToString();
                string email = dgvUtilizadores.CurrentRow.Cells["Email"].Value.ToString();
                string telefone = dgvUtilizadores.CurrentRow.Cells["Telefone"].Value.ToString();
                string plano = dgvUtilizadores.CurrentRow.Cells["Plano"].Value.ToString();
                bool ativo = Convert.ToInt32(dgvUtilizadores.CurrentRow.Cells["Ativo"].Value) == 1;

                string canal = "email";
                using (var con = new MySqlConnection(DbConfig.ConnectionString))
                {
                    con.Open();
                    var cmd = new MySqlCommand("SELECT CanalPreferido FROM configutilizador WHERE UserId=@id", con);
                    cmd.Parameters.AddWithValue("@id", id);
                    var result = cmd.ExecuteScalar();
                    if (result != null) canal = result.ToString();
                }

                var form = new FormPerfilEditar(id, nome, email, telefone, plano, canal, ativo);
                if (form.ShowDialog() == DialogResult.OK)
                    CarregarUtilizadores();
            }
        }

        private void btnDetalhes_Click(object sender, EventArgs e)
        {
            if (dgvUtilizadores.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvUtilizadores.CurrentRow.Cells["UserId"].Value);
                var form = new FormPerfilDetalhes(id);
                form.ShowDialog();
            }
        }

        private void btnRemover_Click(object sender, EventArgs e)
        {
            if (dgvUtilizadores.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvUtilizadores.CurrentRow.Cells["UserId"].Value);
                if (MessageBox.Show("Remover este utilizador?", "Confirmação", MessageBoxButtons.YesNo) == DialogResult.Yes)
                {
                    try
                    {
                        using (var con = new MySqlConnection(DbConfig.ConnectionString))
                        {
                            con.Open();
                            var cmd = new MySqlCommand("DELETE FROM perfilutilizador WHERE UserId=@id", con);
                            cmd.Parameters.AddWithValue("@id", id);
                            cmd.ExecuteNonQuery();
                        }
                        CarregarUtilizadores();
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show("Erro ao remover: " + ex.Message);
                    }
                }
            }
        }

        private void btnAtualizar_Click(object sender, EventArgs e)
        {
            CarregarUtilizadores();
        }
    }
}
