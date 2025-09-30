using System;
using System.Configuration;
using System.Data;
using System.Windows.Forms;
using MySql.Data.MySqlClient;

namespace Painel_Admin
{
    public partial class FormPerfilDetalhes : Form
    {
        private readonly int _userId;

        public FormPerfilDetalhes(int userId)
        {
            InitializeComponent();
            _userId = userId;
        }

        private void FormPerfilDetalhes_Load(object sender, EventArgs e)
        {
            CarregarPerfil();
            CarregarPreferencias();
        }

        private void CarregarPerfil()
        {
            try
            {
                using (var con = new MySqlConnection(DbConfig.ConnectionString))
                {
                    con.Open();
                    string query = @"
                        SELECT Nome, Email, Telefone, Plano, Ativo,
                               MembroDesde, ProdutosMonitorizados, 
                               NotificacoesEnviadas, DinheiroPoupado,
                               UltimoLogin, LimiteProdutos, CanalPreferido
                        FROM perfilutilizador
                        WHERE UserId=@id";

                    using (var cmd = new MySqlCommand(query, con))
                    {
                        cmd.Parameters.AddWithValue("@id", _userId);

                        using (var reader = cmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                IdNome.Text = reader["Nome"].ToString();
                                IdEmail.Text = reader["Email"].ToString();
                                IdTelemovel.Text = reader["Telefone"].ToString();
                                IdPlano.Text = reader["Plano"].ToString();
                                IdAtivo.Text = (Convert.ToInt32(reader["Ativo"]) == 1) ? "Sim ✅" : "Não ❌";

                                IdProdutos.Text = reader["ProdutosMonitorizados"].ToString();
                                IdNotificacoes.Text = reader["NotificacoesEnviadas"].ToString();
                                IdDinheiro.Text = "€ " + reader["DinheiroPoupado"].ToString();

                                IdMembroDesde.Text = Convert.ToDateTime(reader["MembroDesde"]).ToString("dd/MM/yyyy HH:mm");
                                IdUltimoLogin.Text = reader["UltimoLogin"] != DBNull.Value
                                    ? Convert.ToDateTime(reader["UltimoLogin"]).ToString("dd/MM/yyyy HH:mm")
                                    : "---";

                                IdLimitesProdutos.Text = reader["LimiteProdutos"].ToString();
                                IdCanalPreferido.Text = reader["CanalPreferido"].ToString();
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao carregar perfil: " + ex.Message);
            }
        }

        private void CarregarPreferencias()
        {
            try
            {
                for (int i = 0; i < clbNotificacoes.Items.Count; i++)
                    clbNotificacoes.SetItemChecked(i, false);

                using (var con = new MySqlConnection(DbConfig.ConnectionString))
                {
                    con.Open();
                    string query = "SELECT Tipo, Ativo FROM preferenciasnotificacao WHERE UserId=@id";

                    using (var cmd = new MySqlCommand(query, con))
                    {
                        cmd.Parameters.AddWithValue("@id", _userId);

                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                string tipo = reader["Tipo"].ToString();
                                bool ativo = Convert.ToInt32(reader["Ativo"]) == 1;

                                int index = clbNotificacoes.Items.IndexOf(
                                    char.ToUpper(tipo[0]) + tipo.Substring(1)
                                );

                                if (index >= 0)
                                    clbNotificacoes.SetItemChecked(index, ativo);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao carregar preferências: " + ex.Message);
            }
        }

        private void btnSalvar_Click(object sender, EventArgs e)
        {
            try
            {
                using (var con = new MySqlConnection(DbConfig.ConnectionString))
                {
                    con.Open();

                    foreach (string item in clbNotificacoes.Items)
                    {
                        int ativo = clbNotificacoes.CheckedItems.Contains(item) ? 1 : 0;

                        var cmd = new MySqlCommand(
                            @"UPDATE preferenciasnotificacao 
                              SET Ativo=@ativo 
                              WHERE UserId=@userId AND Tipo=@tipo", con);

                        cmd.Parameters.AddWithValue("@ativo", ativo);
                        cmd.Parameters.AddWithValue("@userId", _userId);
                        cmd.Parameters.AddWithValue("@tipo", item.ToLower());

                        cmd.ExecuteNonQuery();
                    }
                }

                MessageBox.Show("Preferências atualizadas com sucesso!", "Perfil", MessageBoxButtons.OK, MessageBoxIcon.Information);
                CarregarPreferencias();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao salvar preferências: " + ex.Message);
            }
        }

        private void btnEditarPerfil_Click(object sender, EventArgs e)
        {
            var editar = new FormPerfilEditar(
                _userId,
                IdNome.Text,
                IdEmail.Text,
                IdTelemovel.Text,
                IdPlano.Text,
                IdCanalPreferido.Text,
                IdAtivo.Text.Contains("Sim")
            );

            if (editar.ShowDialog() == DialogResult.OK)
            {
                CarregarPerfil();
                CarregarPreferencias();
            }
        }
    }
}
