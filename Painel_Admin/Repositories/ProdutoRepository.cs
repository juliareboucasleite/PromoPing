using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;

namespace Painel_Admin.Repositories
{
    public class ProdutoRepository
    {
        private readonly string _connStr;

        public ProdutoRepository()
        {
            _connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
        }

        public DataTable GetAll()
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                string query = "SELECT Id, UserId, Nome, Link, PrecoAlvo, DataLimite, Loja FROM produtos";
                var adapter = new MySqlDataAdapter(query, con);
                var dt = new DataTable();
                adapter.Fill(dt);
                return dt;
            }
        }

        public void Add(int userId, string nome, string link, decimal precoAlvo, DateTime? dataLimite, string loja)
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                string query = @"INSERT INTO produtos (UserId, Nome, Link, PrecoAlvo, DataLimite, Loja)
                                 VALUES (@userId, @nome, @link, @precoAlvo, @dataLimite, @loja)";
                var cmd = new MySqlCommand(query, con);
                cmd.Parameters.AddWithValue("@userId", userId);
                cmd.Parameters.AddWithValue("@nome", nome);
                cmd.Parameters.AddWithValue("@link", link);
                cmd.Parameters.AddWithValue("@precoAlvo", precoAlvo);
                cmd.Parameters.AddWithValue("@dataLimite", (object)dataLimite ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@loja", loja);
                cmd.ExecuteNonQuery();
            }
        }

        public void Update(int id, int userId, string nome, string link, decimal precoAlvo, DateTime? dataLimite, string loja)
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                string query = @"UPDATE produtos 
                                 SET UserId=@userId, Nome=@nome, Link=@link, PrecoAlvo=@precoAlvo, DataLimite=@dataLimite, Loja=@loja
                                 WHERE Id=@id";
                var cmd = new MySqlCommand(query, con);
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@userId", userId);
                cmd.Parameters.AddWithValue("@nome", nome);
                cmd.Parameters.AddWithValue("@link", link);
                cmd.Parameters.AddWithValue("@precoAlvo", precoAlvo);
                cmd.Parameters.AddWithValue("@dataLimite", (object)dataLimite ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@loja", loja);
                cmd.ExecuteNonQuery();
            }
        }

        public void Delete(int id)
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                var cmd = new MySqlCommand("DELETE FROM produtos WHERE Id=@id", con);
                cmd.Parameters.AddWithValue("@id", id);
                cmd.ExecuteNonQuery();
            }
        }
    }
}
