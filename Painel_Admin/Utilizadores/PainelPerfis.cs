using MySql.Data.MySqlClient;
using System;
using System.Data;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class PainelPerfis : Form
    {
        public PainelPerfis()
        {
            InitializeComponent();
        }

        private void PainelPerfis_Load(object sender, EventArgs e)
        {
            CarregarPerfis();
        }

        private void CarregarPerfis()
        {
            try
            {
                string connStr = DbConfig.ConnectionString;
                using (var con = new MySqlConnection(connStr))
                {
                    con.Open();
                    string query = @"
                SELECT u.Id, u.Nome, u.Email, u.Telefone, u.Ativo, p.Nome AS Perfil
                FROM utilizadores u
                INNER JOIN perfis p ON u.PerfilId = p.Id";


                    using (var da = new MySqlDataAdapter(query, con))
                    {
                        var dt = new DataTable();
                        da.Fill(dt);
                        dgvPerfis.DataSource = dt;
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao carregar perfis: " + ex.Message);
            }
        }



        private void btnAdicionar_Click(object sender, EventArgs e)
        {
            var frm = new FormPerfilEditar(0, "", "", "", "free", "email", true);
            if (frm.ShowDialog() == DialogResult.OK)
                CarregarPerfis();
        }

        private void btnEditar_Click(object sender, EventArgs e)
        {
            if (dgvPerfis.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvPerfis.CurrentRow.Cells["Id"].Value);
                string nome = dgvPerfis.CurrentRow.Cells["Nome"].Value.ToString();
                string email = dgvPerfis.CurrentRow.Cells["Email"].Value.ToString();
                string telefone = dgvPerfis.CurrentRow.Cells["Telefone"].Value.ToString();
                string perfil = dgvPerfis.CurrentRow.Cells["Perfil"].Value.ToString();
                bool ativo = Convert.ToInt32(dgvPerfis.CurrentRow.Cells["Ativo"].Value) == 1;

                // Por padrão definimos canal = "email"
                string canal = "email";

                // Como a tabela não tem "Plano", podes passar "free" como valor padrão
                var frm = new FormPerfilEditar(id, nome, email, telefone, "free", canal, ativo);
                if (frm.ShowDialog() == DialogResult.OK)
                    CarregarPerfis();
            }
        }


        private void btnRemover_Click(object sender, EventArgs e)
        {
            if (dgvPerfis.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvPerfis.CurrentRow.Cells["Id"].Value);
                if (MessageBox.Show("Remover este utilizador?", "Confirmação",
                        MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes)
                {
                    try
                    {
                        using (var con = new MySqlConnection(DbConfig.ConnectionString))
                        {
                            con.Open();
                            var cmd = new MySqlCommand("DELETE FROM utilizadores WHERE Id=@id", con);
                            cmd.Parameters.AddWithValue("@id", id);
                            cmd.ExecuteNonQuery();
                        }
                        CarregarPerfis();
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
            CarregarPerfis();
        }
    }
}
