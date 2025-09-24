using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;

namespace Painel_Admin.Repositories
{
    public class UtilizadorRepository
    {
        private readonly string _connStr;

        public UtilizadorRepository()
        {
            _connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
        }

        public DataTable GetAll()
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                string query = "SELECT Id, Nome, Email, Perfil, DataRegisto FROM utilizadores";
                var adapter = new MySqlDataAdapter(query, con);
                var dt = new DataTable();
                adapter.Fill(dt);
                return dt;
            }
        }

        public void Add(string nome, string email, string senha, string perfil)
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                string query = @"INSERT INTO utilizadores (Nome, Email, Senha, Perfil, DataRegisto)
                                 VALUES (@nome, @email, @senha, @perfil, NOW())";
                var cmd = new MySqlCommand(query, con);
                cmd.Parameters.AddWithValue("@nome", nome);
                cmd.Parameters.AddWithValue("@email", email);
                cmd.Parameters.AddWithValue("@senha", senha);
                cmd.Parameters.AddWithValue("@perfil", perfil);
                cmd.ExecuteNonQuery();
            }
        }

        public void Update(int id, string nome, string email, string perfil)
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                string query = @"UPDATE utilizadores 
                                 SET Nome=@nome, Email=@email, Perfil=@perfil 
                                 WHERE Id=@id";
                var cmd = new MySqlCommand(query, con);
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@nome", nome);
                cmd.Parameters.AddWithValue("@email", email);
                cmd.Parameters.AddWithValue("@perfil", perfil);
                cmd.ExecuteNonQuery();
            }
        }

        public void Delete(int id)
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                var cmd = new MySqlCommand("DELETE FROM utilizadores WHERE Id=@id", con);
                cmd.Parameters.AddWithValue("@id", id);
                cmd.ExecuteNonQuery();
            }
        }
    }
}
