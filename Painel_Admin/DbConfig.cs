using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Configuration;

namespace Painel_Admin
{
    public static class DbConfig
    {
        public static string ConnString =>
            ConfigurationManager.ConnectionStrings["MySqlConn"].ConnectionString;
    }
}