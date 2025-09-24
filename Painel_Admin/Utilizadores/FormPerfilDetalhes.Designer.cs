namespace Painel_Admin
{
    partial class FormPerfilDetalhes
    {
        private System.ComponentModel.IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null)) components.Dispose();
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(FormPerfilDetalhes));
            this.grpInfo = new System.Windows.Forms.GroupBox();
            this.lblNome = new System.Windows.Forms.Label();
            this.lblEmail = new System.Windows.Forms.Label();
            this.lblTelefone = new System.Windows.Forms.Label();
            this.lblPlano = new System.Windows.Forms.Label();
            this.lblAtivo = new System.Windows.Forms.Label();
            this.grpEstatisticas = new System.Windows.Forms.GroupBox();
            this.lblProdutos = new System.Windows.Forms.Label();
            this.lblNotificacoes = new System.Windows.Forms.Label();
            this.lblPoupado = new System.Windows.Forms.Label();
            this.lblMembroDesde = new System.Windows.Forms.Label();
            this.lblUltimoLogin = new System.Windows.Forms.Label();
            this.lblLimiteProdutos = new System.Windows.Forms.Label();
            this.lblCanalPreferido = new System.Windows.Forms.Label();
            this.grpPreferencias = new System.Windows.Forms.GroupBox();
            this.clbNotificacoes = new System.Windows.Forms.CheckedListBox();
            this.btnSalvar = new System.Windows.Forms.Button();
            this.btnEditarPerfil = new System.Windows.Forms.Button();
            this.grpInfo.SuspendLayout();
            this.grpEstatisticas.SuspendLayout();
            this.grpPreferencias.SuspendLayout();
            this.SuspendLayout();
            // 
            // grpInfo
            // 
            this.grpInfo.BackColor = System.Drawing.Color.WhiteSmoke;
            this.grpInfo.Controls.Add(this.lblNome);
            this.grpInfo.Controls.Add(this.lblEmail);
            this.grpInfo.Controls.Add(this.lblTelefone);
            this.grpInfo.Controls.Add(this.lblPlano);
            this.grpInfo.Controls.Add(this.lblAtivo);
            this.grpInfo.Font = new System.Drawing.Font("Segoe UI", 10F, System.Drawing.FontStyle.Bold);
            this.grpInfo.Location = new System.Drawing.Point(20, 20);
            this.grpInfo.Name = "grpInfo";
            this.grpInfo.Size = new System.Drawing.Size(350, 130);
            this.grpInfo.TabIndex = 0;
            this.grpInfo.TabStop = false;
            this.grpInfo.Text = "Informações Pessoais";
            // 
            // lblNome
            // 
            this.lblNome.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblNome.Location = new System.Drawing.Point(10, 25);
            this.lblNome.Name = "lblNome";
            this.lblNome.Size = new System.Drawing.Size(100, 23);
            this.lblNome.TabIndex = 0;
            this.lblNome.Text = "Nome: [---]";
            // 
            // lblEmail
            // 
            this.lblEmail.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblEmail.Location = new System.Drawing.Point(10, 50);
            this.lblEmail.Name = "lblEmail";
            this.lblEmail.Size = new System.Drawing.Size(100, 23);
            this.lblEmail.TabIndex = 1;
            this.lblEmail.Text = "Email: [---]";
            // 
            // lblTelefone
            // 
            this.lblTelefone.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblTelefone.Location = new System.Drawing.Point(10, 75);
            this.lblTelefone.Name = "lblTelefone";
            this.lblTelefone.Size = new System.Drawing.Size(100, 23);
            this.lblTelefone.TabIndex = 2;
            this.lblTelefone.Text = "Telefone: [---]";
            // 
            // lblPlano
            // 
            this.lblPlano.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblPlano.Location = new System.Drawing.Point(10, 100);
            this.lblPlano.Name = "lblPlano";
            this.lblPlano.Size = new System.Drawing.Size(100, 23);
            this.lblPlano.TabIndex = 3;
            this.lblPlano.Text = "Plano: [---]";
            // 
            // lblAtivo
            // 
            this.lblAtivo.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblAtivo.Location = new System.Drawing.Point(200, 100);
            this.lblAtivo.Name = "lblAtivo";
            this.lblAtivo.Size = new System.Drawing.Size(100, 23);
            this.lblAtivo.TabIndex = 4;
            this.lblAtivo.Text = "Ativo: [---]";
            // 
            // grpEstatisticas
            // 
            this.grpEstatisticas.BackColor = System.Drawing.Color.WhiteSmoke;
            this.grpEstatisticas.Controls.Add(this.lblProdutos);
            this.grpEstatisticas.Controls.Add(this.lblNotificacoes);
            this.grpEstatisticas.Controls.Add(this.lblPoupado);
            this.grpEstatisticas.Controls.Add(this.lblMembroDesde);
            this.grpEstatisticas.Controls.Add(this.lblUltimoLogin);
            this.grpEstatisticas.Controls.Add(this.lblLimiteProdutos);
            this.grpEstatisticas.Controls.Add(this.lblCanalPreferido);
            this.grpEstatisticas.Font = new System.Drawing.Font("Segoe UI", 10F, System.Drawing.FontStyle.Bold);
            this.grpEstatisticas.Location = new System.Drawing.Point(20, 160);
            this.grpEstatisticas.Name = "grpEstatisticas";
            this.grpEstatisticas.Size = new System.Drawing.Size(350, 170);
            this.grpEstatisticas.TabIndex = 1;
            this.grpEstatisticas.TabStop = false;
            this.grpEstatisticas.Text = "Estatísticas";
            // 
            // lblProdutos
            // 
            this.lblProdutos.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblProdutos.Location = new System.Drawing.Point(10, 25);
            this.lblProdutos.Name = "lblProdutos";
            this.lblProdutos.Size = new System.Drawing.Size(100, 23);
            this.lblProdutos.TabIndex = 0;
            this.lblProdutos.Text = "Produtos monitorizados: [0]";
            // 
            // lblNotificacoes
            // 
            this.lblNotificacoes.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblNotificacoes.Location = new System.Drawing.Point(10, 45);
            this.lblNotificacoes.Name = "lblNotificacoes";
            this.lblNotificacoes.Size = new System.Drawing.Size(100, 23);
            this.lblNotificacoes.TabIndex = 1;
            this.lblNotificacoes.Text = "Notificações enviadas: [0]";
            // 
            // lblPoupado
            // 
            this.lblPoupado.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.lblPoupado.ForeColor = System.Drawing.Color.ForestGreen;
            this.lblPoupado.Location = new System.Drawing.Point(10, 65);
            this.lblPoupado.Name = "lblPoupado";
            this.lblPoupado.Size = new System.Drawing.Size(100, 23);
            this.lblPoupado.TabIndex = 2;
            this.lblPoupado.Text = "Dinheiro poupado: €0,00";
            // 
            // lblMembroDesde
            // 
            this.lblMembroDesde.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblMembroDesde.Location = new System.Drawing.Point(10, 90);
            this.lblMembroDesde.Name = "lblMembroDesde";
            this.lblMembroDesde.Size = new System.Drawing.Size(100, 23);
            this.lblMembroDesde.TabIndex = 3;
            this.lblMembroDesde.Text = "Membro desde: ---";
            // 
            // lblUltimoLogin
            // 
            this.lblUltimoLogin.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblUltimoLogin.Location = new System.Drawing.Point(10, 110);
            this.lblUltimoLogin.Name = "lblUltimoLogin";
            this.lblUltimoLogin.Size = new System.Drawing.Size(100, 23);
            this.lblUltimoLogin.TabIndex = 4;
            this.lblUltimoLogin.Text = "Último login: ---";
            // 
            // lblLimiteProdutos
            // 
            this.lblLimiteProdutos.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblLimiteProdutos.Location = new System.Drawing.Point(10, 130);
            this.lblLimiteProdutos.Name = "lblLimiteProdutos";
            this.lblLimiteProdutos.Size = new System.Drawing.Size(100, 23);
            this.lblLimiteProdutos.TabIndex = 5;
            this.lblLimiteProdutos.Text = "Limite de produtos: ---";
            // 
            // lblCanalPreferido
            // 
            this.lblCanalPreferido.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblCanalPreferido.Location = new System.Drawing.Point(10, 150);
            this.lblCanalPreferido.Name = "lblCanalPreferido";
            this.lblCanalPreferido.Size = new System.Drawing.Size(100, 23);
            this.lblCanalPreferido.TabIndex = 6;
            this.lblCanalPreferido.Text = "Canal preferido: ---";
            // 
            // grpPreferencias
            // 
            this.grpPreferencias.BackColor = System.Drawing.Color.WhiteSmoke;
            this.grpPreferencias.Controls.Add(this.clbNotificacoes);
            this.grpPreferencias.Font = new System.Drawing.Font("Segoe UI", 10F, System.Drawing.FontStyle.Bold);
            this.grpPreferencias.Location = new System.Drawing.Point(20, 340);
            this.grpPreferencias.Name = "grpPreferencias";
            this.grpPreferencias.Size = new System.Drawing.Size(350, 120);
            this.grpPreferencias.TabIndex = 2;
            this.grpPreferencias.TabStop = false;
            this.grpPreferencias.Text = "Preferências de Notificação";
            // 
            // clbNotificacoes
            // 
            this.clbNotificacoes.CheckOnClick = true;
            this.clbNotificacoes.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.clbNotificacoes.Items.AddRange(new object[] {
            "Email",
            "Discord",
            "Telegram",
            "WhatsApp"});
            this.clbNotificacoes.Location = new System.Drawing.Point(10, 25);
            this.clbNotificacoes.Name = "clbNotificacoes";
            this.clbNotificacoes.Size = new System.Drawing.Size(200, 76);
            this.clbNotificacoes.TabIndex = 0;
            // 
            // btnSalvar
            // 
            this.btnSalvar.BackColor = System.Drawing.Color.Firebrick;
            this.btnSalvar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnSalvar.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.btnSalvar.ForeColor = System.Drawing.Color.White;
            this.btnSalvar.Location = new System.Drawing.Point(40, 470);
            this.btnSalvar.Name = "btnSalvar";
            this.btnSalvar.Size = new System.Drawing.Size(140, 40);
            this.btnSalvar.TabIndex = 3;
            this.btnSalvar.Text = "💾 Salvar Preferências";
            this.btnSalvar.UseVisualStyleBackColor = false;
            this.btnSalvar.Click += new System.EventHandler(this.btnSalvar_Click);
            // 
            // btnEditarPerfil
            // 
            this.btnEditarPerfil.BackColor = System.Drawing.Color.SteelBlue;
            this.btnEditarPerfil.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnEditarPerfil.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.btnEditarPerfil.ForeColor = System.Drawing.Color.White;
            this.btnEditarPerfil.Location = new System.Drawing.Point(200, 470);
            this.btnEditarPerfil.Name = "btnEditarPerfil";
            this.btnEditarPerfil.Size = new System.Drawing.Size(140, 40);
            this.btnEditarPerfil.TabIndex = 4;
            this.btnEditarPerfil.Text = "✏️ Editar Perfil";
            this.btnEditarPerfil.UseVisualStyleBackColor = false;
            this.btnEditarPerfil.Click += new System.EventHandler(this.btnEditarPerfil_Click);
            // 
            // FormPerfilDetalhes
            // 
            this.BackColor = System.Drawing.Color.Gainsboro;
            this.ClientSize = new System.Drawing.Size(400, 530);
            this.Controls.Add(this.grpInfo);
            this.Controls.Add(this.grpEstatisticas);
            this.Controls.Add(this.grpPreferencias);
            this.Controls.Add(this.btnSalvar);
            this.Controls.Add(this.btnEditarPerfil);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog;
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.Name = "FormPerfilDetalhes";
            this.Text = "Detalhes do Perfil";
            this.Load += new System.EventHandler(this.FormPerfilDetalhes_Load);
            this.grpInfo.ResumeLayout(false);
            this.grpEstatisticas.ResumeLayout(false);
            this.grpPreferencias.ResumeLayout(false);
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.GroupBox grpInfo;
        private System.Windows.Forms.Label lblNome;
        private System.Windows.Forms.Label lblEmail;
        private System.Windows.Forms.Label lblTelefone;
        private System.Windows.Forms.Label lblPlano;
        private System.Windows.Forms.Label lblAtivo;

        private System.Windows.Forms.GroupBox grpEstatisticas;
        private System.Windows.Forms.Label lblProdutos;
        private System.Windows.Forms.Label lblNotificacoes;
        private System.Windows.Forms.Label lblPoupado;
        private System.Windows.Forms.Label lblMembroDesde;
        private System.Windows.Forms.Label lblUltimoLogin;
        private System.Windows.Forms.Label lblLimiteProdutos;
        private System.Windows.Forms.Label lblCanalPreferido;

        private System.Windows.Forms.GroupBox grpPreferencias;
        private System.Windows.Forms.CheckedListBox clbNotificacoes;

        private System.Windows.Forms.Button btnSalvar;
        private System.Windows.Forms.Button btnEditarPerfil;
    }
}
