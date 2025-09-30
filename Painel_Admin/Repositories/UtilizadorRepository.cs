using MySql.Data.MySqlClient;
using System.Data;

namespace Painel_Admin
{
    public class UtilizadorRepository
    {
        public DataTable GetAll()
        {
            using (var con = new MySqlConnection(DbConfig.ConnectionString))
            {
                con.Open();
                string query = "SELECT UserId, Nome, Email, Telefone, Plano, Ativo FROM perfilutilizador";
                using (var cmd = new MySqlCommand(query, con))
                using (var adapter = new MySqlDataAdapter(cmd))
                {
                    var dt = new DataTable();
                    adapter.Fill(dt);
                    return dt;
                }
            }
        }

        public void Add(string nome, string email, string senhaHash, string telefone, string plano, bool ativo)
        {
            using (var con = new MySqlConnection(DbConfig.ConnectionString))
            {
                con.Open();
                string query = @"INSERT INTO perfilutilizador 
                                (Nome, Email, SenhaHash, Telefone, Plano, Ativo, MembroDesde)
                                 VALUES (@nome, @mail, @senhaHash, @tel, @plano, @ativo, NOW())";
                using (var cmd = new MySqlCommand(query, con))
                {
                    cmd.Parameters.AddWithValue("@nome", nome);
                    cmd.Parameters.AddWithValue("@mail", email);
                    cmd.Parameters.AddWithValue("@senhaHash", senhaHash);
                    cmd.Parameters.AddWithValue("@tel", telefone);
                    cmd.Parameters.AddWithValue("@plano", plano);
                    cmd.Parameters.AddWithValue("@ativo", ativo ? 1 : 0);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void Update(int id, string nome, string email, string telefone, string plano, bool ativo)
        {
            using (var con = new MySqlConnection(DbConfig.ConnectionString))
            {
                con.Open();
                string query = @"UPDATE perfilutilizador 
                                 SET Nome=@nome, Email=@mail, Telefone=@tel, Plano=@plano, Ativo=@ativo
                                 WHERE UserId=@id";
                using (var cmd = new MySqlCommand(query, con))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    cmd.Parameters.AddWithValue("@nome", nome);
                    cmd.Parameters.AddWithValue("@mail", email);
                    cmd.Parameters.AddWithValue("@tel", telefone);
                    cmd.Parameters.AddWithValue("@plano", plano);
                    cmd.Parameters.AddWithValue("@ativo", ativo ? 1 : 0);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void Delete(int id)
        {
            using (var con = new MySqlConnection(DbConfig.ConnectionString))
            {
                con.Open();
                string query = "DELETE FROM perfilutilizador WHERE UserId=@id";
                using (var cmd = new MySqlCommand(query, con))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}
