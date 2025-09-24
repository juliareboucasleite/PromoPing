using MySql.Data.MySqlClient;
using System;
using System.Configuration;
using System.Data;

namespace Painel_Admin.Repositories
{
    public class PreferenciaNotificacaoRepository
    {
        private readonly string _connStr;

        public PreferenciaNotificacaoRepository()
        {
            _connStr = ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
        }

        public DataTable GetAll()
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                string query = @"SELECT pn.Id, u.Nome AS Utilizador, pn.Tipo, pn.Ativo
                                 FROM preferenciasnotificacao pn
                                 INNER JOIN utilizadores u ON u.Id = pn.UserId";
                var adapter = new MySqlDataAdapter(query, con);
                var dt = new DataTable();
                adapter.Fill(dt);
                return dt;
            }
        }

        public void Add(int userId, string tipo, bool ativo)
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                string query = @"INSERT INTO preferenciasnotificacao (UserId, Tipo, Ativo)
                                 VALUES (@userId, @tipo, @ativo)";
                var cmd = new MySqlCommand(query, con);
                cmd.Parameters.AddWithValue("@userId", userId);
                cmd.Parameters.AddWithValue("@tipo", tipo);
                cmd.Parameters.AddWithValue("@ativo", ativo ? 1 : 0);
                cmd.ExecuteNonQuery();
            }
        }

        public void Update(int id, int userId, string tipo, bool ativo)
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                string query = @"UPDATE preferenciasnotificacao 
                                 SET UserId=@userId, Tipo=@tipo, Ativo=@ativo
                                 WHERE Id=@id";
                var cmd = new MySqlCommand(query, con);
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@userId", userId);
                cmd.Parameters.AddWithValue("@tipo", tipo);
                cmd.Parameters.AddWithValue("@ativo", ativo ? 1 : 0);
                cmd.ExecuteNonQuery();
            }
        }

        public void Delete(int id)
        {
            using (var con = new MySqlConnection(_connStr))
            {
                con.Open();
                var cmd = new MySqlCommand("DELETE FROM preferenciasnotificacao WHERE Id=@id", con);
                cmd.Parameters.AddWithValue("@id", id);
                cmd.ExecuteNonQuery();
            }
        }
    }
}
