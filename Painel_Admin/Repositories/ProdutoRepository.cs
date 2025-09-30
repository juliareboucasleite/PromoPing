using MySql.Data.MySqlClient;
using System;
using System.Data;

namespace Painel_Admin
{
    public class ProdutoRepository
    {
        public DataTable GetAll()
        {
            using (var con = new MySqlConnection(DbConfig.ConnectionString))
            {
                con.Open();
                string query = "SELECT Id, UserId, Nome, Link, PrecoAlvo, DataLimite, Loja FROM produtos";
                using (var cmd = new MySqlCommand(query, con))
                using (var adapter = new MySqlDataAdapter(cmd))
                {
                    var dt = new DataTable();
                    adapter.Fill(dt);
                    return dt;
                }
            }
        }

        public void Add(int userId, string nome, string link, decimal precoAlvo, DateTime? dataLimite, string loja)
        {
            using (var con = new MySqlConnection(DbConfig.ConnectionString))
            {
                con.Open();
                string query = @"INSERT INTO produtos (UserId, Nome, Link, PrecoAlvo, DataLimite, Loja)
                                 VALUES (@userId, @nome, @link, @precoAlvo, @dataLimite, @loja)";
                using (var cmd = new MySqlCommand(query, con))
                {
                    cmd.Parameters.AddWithValue("@userId", userId);
                    cmd.Parameters.AddWithValue("@nome", nome);
                    cmd.Parameters.AddWithValue("@link", link);
                    cmd.Parameters.AddWithValue("@precoAlvo", precoAlvo);
                    cmd.Parameters.AddWithValue("@dataLimite", (object)dataLimite ?? DBNull.Value);
                    cmd.Parameters.AddWithValue("@loja", loja);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void Update(int id, string nome, string link, decimal precoAlvo, DateTime? dataLimite, string loja)
        {
            using (var con = new MySqlConnection(DbConfig.ConnectionString))
            {
                con.Open();
                string query = @"UPDATE produtos 
                                 SET Nome=@nome, Link=@link, PrecoAlvo=@precoAlvo, DataLimite=@dataLimite, Loja=@loja
                                 WHERE Id=@id";
                using (var cmd = new MySqlCommand(query, con))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    cmd.Parameters.AddWithValue("@nome", nome);
                    cmd.Parameters.AddWithValue("@link", link);
                    cmd.Parameters.AddWithValue("@precoAlvo", precoAlvo);
                    cmd.Parameters.AddWithValue("@dataLimite", (object)dataLimite ?? DBNull.Value);
                    cmd.Parameters.AddWithValue("@loja", loja);
                    cmd.ExecuteNonQuery();
                }
            }
        }

        public void Delete(int id)
        {
            using (var con = new MySqlConnection(DbConfig.ConnectionString))
            {
                con.Open();
                string query = "DELETE FROM produtos WHERE Id=@id";
                using (var cmd = new MySqlCommand(query, con))
                {
                    cmd.Parameters.AddWithValue("@id", id);
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}
