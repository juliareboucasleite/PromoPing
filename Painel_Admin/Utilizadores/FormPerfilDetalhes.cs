using System;
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
                        SELECT 
                            u.Nome, 
                            u.Email, 
                            u.Telefone, 
                            p.Nome AS Perfil,
                            u.Ativo,
                            u.Data_Registo,
                            u.ultimo_login,
                            u.dinheiro_poupado,
                            pl.Nome AS Plano,
                            pl.LimiteProdutos,
                            pl.VerificacaoIntervalo
                        FROM utilizadores u
                        LEFT JOIN perfis p ON p.Id = u.PerfilId
                        LEFT JOIN planos pl ON pl.Id = 1
                        WHERE u.Id = @id;";

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

                                IdProdutos.Text = ObterTotal("produtos", "UserId", _userId).ToString();
                                IdNotificacoes.Text = ObterTotal("notificacoes", "UserId", _userId).ToString();
                                IdDinheiro.Text = "€ " + Convert.ToDecimal(reader["dinheiro_poupado"]).ToString("F2");

                                IdMembroDesde.Text = Convert.ToDateTime(reader["Data_Registo"]).ToString("dd/MM/yyyy HH:mm");
                                IdUltimoLogin.Text = reader["ultimo_login"] != DBNull.Value
                                    ? Convert.ToDateTime(reader["ultimo_login"]).ToString("dd/MM/yyyy HH:mm")
                                    : "---";

                                IdLimitesProdutos.Text = reader["LimiteProdutos"].ToString();
                                IdCanalPreferido.Text = ObterCanalPreferido();
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

        private int ObterTotal(string tabela, string campoUser, int userId)
        {
            try
            {
                using (var con = new MySqlConnection(DbConfig.ConnectionString))
                {
                    con.Open();
                    string query = $"SELECT COUNT(*) FROM {tabela} WHERE {campoUser} = @id;";
                    using (var cmd = new MySqlCommand(query, con))
                    {
                        cmd.Parameters.AddWithValue("@id", userId);
                        return Convert.ToInt32(cmd.ExecuteScalar());
                    }
                }
            }
            catch
            {
                return 0;
            }
        }

        private string ObterCanalPreferido()
        {
            try
            {
                using (var con = new MySqlConnection(DbConfig.ConnectionString))
                {
                    con.Open();
                    var cmd = new MySqlCommand("SELECT CanalPreferido FROM configutilizador WHERE UserId=@id", con);
                    cmd.Parameters.AddWithValue("@id", _userId);
                    var result = cmd.ExecuteScalar();
                    return result != null ? result.ToString() : "Email";
                }
            }
            catch
            {
                return "Email";
            }
        }

        private void CarregarPreferencias()
        {
            try
            {
                // Limpa seleção atual
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
                        var cmd = new MySqlCommand(@"
                            INSERT INTO preferenciasnotificacao (UserId, Tipo, Ativo)
                            VALUES (@userId, @tipo, @ativo)
                            ON DUPLICATE KEY UPDATE Ativo=@ativo;", con);

                        cmd.Parameters.AddWithValue("@userId", _userId);
                        cmd.Parameters.AddWithValue("@tipo", item.ToLower());
                        cmd.Parameters.AddWithValue("@ativo", ativo);
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

        private void IdProdutos_Click(object sender, EventArgs e)
        {

        }

        private void IdNotificacoes_Click(object sender, EventArgs e)
        {

        }

        private void IdMembroDesde_Click(object sender, EventArgs e)
        {

        }
    }
}
