using MySql.Data.MySqlClient;
using System;
using System.Configuration;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class FormPerfilDetalhes : Form
    {
        private int _userId;

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
            string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
            using (var con = new MySqlConnection(connStr))
            {
                con.Open();
                string query = @"
                    SELECT p.Nome, p.Email, p.Telefone, p.Plano, p.Ativo,
                           p.MembroDesde, p.ProdutosMonitorizados, 
                           p.NotificacoesEnviadas, p.DinheiroPoupado,
                           c.LimiteProdutos, c.CanalPreferido, c.UltimoLogin
                    FROM perfilutilizador p
                    LEFT JOIN configutilizador c ON p.UserId = c.UserId
                    WHERE p.UserId=@id";

                var cmd = new MySqlCommand(query, con);
                cmd.Parameters.AddWithValue("@id", _userId);

                using (var reader = cmd.ExecuteReader())
                {
                    if (reader.Read())
                    {
                        // Info pessoal
                        lblNome.Text = "Nome: " + reader["Nome"].ToString();
                        lblEmail.Text = "Email: " + reader["Email"].ToString();
                        lblTelefone.Text = "Telefone: " + reader["Telefone"].ToString();
                        lblPlano.Text = "Plano: " + reader["Plano"].ToString();
                        lblAtivo.Text = "Ativo: " + ((Convert.ToInt32(reader["Ativo"]) == 1) ? "Sim ✅" : "Não ❌");

                        // Estatísticas
                        lblProdutos.Text = "Produtos monitorizados: " + reader["ProdutosMonitorizados"].ToString();
                        lblNotificacoes.Text = "Notificações enviadas: " + reader["NotificacoesEnviadas"].ToString();
                        lblPoupado.Text = "Dinheiro poupado: €" + reader["DinheiroPoupado"].ToString();
                        lblMembroDesde.Text = "Membro desde: " + Convert.ToDateTime(reader["MembroDesde"]).ToString("dd/MM/yyyy HH:mm");
                        lblUltimoLogin.Text = "Último login: " + (reader["UltimoLogin"] != DBNull.Value ? Convert.ToDateTime(reader["UltimoLogin"]).ToString("dd/MM/yyyy HH:mm") : "---");
                        lblLimiteProdutos.Text = "Limite de produtos: " + reader["LimiteProdutos"].ToString();
                        lblCanalPreferido.Text = "Canal preferido: " + reader["CanalPreferido"].ToString();
                    }
                }
            }
        }

        private void CarregarPreferencias()
        {
            // Desmarca tudo
            for (int i = 0; i < clbNotificacoes.Items.Count; i++)
                clbNotificacoes.SetItemChecked(i, false);

            string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
            using (var con = new MySqlConnection(connStr))
            {
                con.Open();
                string query = "SELECT Tipo, Ativo FROM preferenciasnotificacao WHERE UserId=@id";
                var cmd = new MySqlCommand(query, con);
                cmd.Parameters.AddWithValue("@id", _userId);

                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        string tipo = reader["Tipo"].ToString();
                        bool ativo = Convert.ToBoolean(reader["Ativo"]);

                        int index = clbNotificacoes.Items.IndexOf(char.ToUpper(tipo[0]) + tipo.Substring(1));
                        if (index >= 0)
                            clbNotificacoes.SetItemChecked(index, ativo);
                    }
                }
            }
        }

        private void btnSalvar_Click(object sender, EventArgs e)
        {
            string connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
            using (var con = new MySqlConnection(connStr))
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

        private void btnEditarPerfil_Click(object sender, EventArgs e)
        {
            // abre o editor passando os dados atuais
            var editar = new FormPerfilEditar(
                _userId,
                lblNome.Text.Replace("Nome: ", ""),
                lblEmail.Text.Replace("Email: ", ""),
                lblTelefone.Text.Replace("Telefone: ", ""),
                lblPlano.Text.Replace("Plano: ", ""),
                lblCanalPreferido.Text.Replace("Canal preferido: ", ""),
                lblAtivo.Text.Contains("Sim")
            );

            if (editar.ShowDialog() == DialogResult.OK)
            {
                CarregarPerfil();
                CarregarPreferencias();
            }
        }
    }
}
