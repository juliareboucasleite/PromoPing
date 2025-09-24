using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using MySql.Data.MySqlClient;


namespace Painel_Admin
{
    internal static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                // Debug: mostra qual string está sendo usada
                var conn = DbConfig.ConnString;
                var b = new MySqlConnectionStringBuilder(conn);
                MessageBox.Show($"🔎 A conectar no MySQL com usuário: {b.UserID}", "Debug");

                using (var con = new MySqlConnection(conn))
                {
                    con.Open();
                    Console.WriteLine("✅ Conexão bem sucedida!");
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("❌ Erro ao conectar na base de dados: " + ex.Message);
                return; // não inicia se não conseguir conectar
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new FormLogin());
        }
    }
}