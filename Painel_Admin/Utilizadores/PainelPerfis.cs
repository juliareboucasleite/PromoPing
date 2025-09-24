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
                string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;

                using (MySqlConnection con = new MySqlConnection(connStr))
                {
                    con.Open();
                    string query = "SELECT Id, Nome, Senha FROM perfis";
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
            FormPerfilEditar form = new FormPerfilEditar();
            if (form.ShowDialog() == DialogResult.OK)
            {
                CarregarPerfis();
            }
        }

        private void btnEditar_Click(object sender, EventArgs e)
        {
            if (dgvPerfis.SelectedRows.Count > 0)
            {
                int id = Convert.ToInt32(dgvPerfis.SelectedRows[0].Cells["Id"].Value);
                string nome = dgvPerfis.SelectedRows[0].Cells["Nome"].Value.ToString();
                string senha = dgvPerfis.SelectedRows[0].Cells["Senha"].Value.ToString();

                FormPerfilEditar form = new FormPerfilEditar(id, nome, senha);
                if (form.ShowDialog() == DialogResult.OK)
                {
                    CarregarPerfis();
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
                    MySqlCommand cmd = new MySqlCommand("DELETE FROM perfis WHERE Id=@id", con);
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
    }
}