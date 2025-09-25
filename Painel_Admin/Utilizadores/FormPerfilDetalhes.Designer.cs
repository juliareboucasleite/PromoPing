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
            this.IdNome = new System.Windows.Forms.Label();
            this.IdEmail = new System.Windows.Forms.Label();
            this.IdTelemovel = new System.Windows.Forms.Label();
            this.IdPlano = new System.Windows.Forms.Label();
            this.IdAtivo = new System.Windows.Forms.Label();
            this.IdProdutos = new System.Windows.Forms.Label();
            this.IdNotificacoes = new System.Windows.Forms.Label();
            this.IdDinheiro = new System.Windows.Forms.Label();
            this.IdMembroDesde = new System.Windows.Forms.Label();
            this.IdUltimoLogin = new System.Windows.Forms.Label();
            this.IdLimitesProdutos = new System.Windows.Forms.Label();
            this.IdCanalPreferido = new System.Windows.Forms.Label();
            this.grpInfo.SuspendLayout();
            this.grpEstatisticas.SuspendLayout();
            this.grpPreferencias.SuspendLayout();
            this.SuspendLayout();
            // 
            // grpInfo
            // 
            this.grpInfo.BackColor = System.Drawing.Color.WhiteSmoke;
            this.grpInfo.Controls.Add(this.IdAtivo);
            this.grpInfo.Controls.Add(this.IdPlano);
            this.grpInfo.Controls.Add(this.IdTelemovel);
            this.grpInfo.Controls.Add(this.IdEmail);
            this.grpInfo.Controls.Add(this.IdNome);
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
            this.lblNome.Text = "Nome:";
            // 
            // lblEmail
            // 
            this.lblEmail.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblEmail.Location = new System.Drawing.Point(10, 50);
            this.lblEmail.Name = "lblEmail";
            this.lblEmail.Size = new System.Drawing.Size(100, 23);
            this.lblEmail.TabIndex = 1;
            this.lblEmail.Text = "Email:";
            // 
            // lblTelefone
            // 
            this.lblTelefone.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblTelefone.Location = new System.Drawing.Point(10, 75);
            this.lblTelefone.Name = "lblTelefone";
            this.lblTelefone.Size = new System.Drawing.Size(100, 23);
            this.lblTelefone.TabIndex = 2;
            this.lblTelefone.Text = "&Telemovel:";
            // 
            // lblPlano
            // 
            this.lblPlano.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblPlano.Location = new System.Drawing.Point(10, 100);
            this.lblPlano.Name = "lblPlano";
            this.lblPlano.Size = new System.Drawing.Size(100, 23);
            this.lblPlano.TabIndex = 3;
            this.lblPlano.Text = "Plano:";
            // 
            // lblAtivo
            // 
            this.lblAtivo.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblAtivo.Location = new System.Drawing.Point(200, 100);
            this.lblAtivo.Name = "lblAtivo";
            this.lblAtivo.Size = new System.Drawing.Size(100, 23);
            this.lblAtivo.TabIndex = 4;
            this.lblAtivo.Text = "Ativo:";
            // 
            // grpEstatisticas
            // 
            this.grpEstatisticas.BackColor = System.Drawing.Color.WhiteSmoke;
            this.grpEstatisticas.Controls.Add(this.IdCanalPreferido);
            this.grpEstatisticas.Controls.Add(this.IdLimitesProdutos);
            this.grpEstatisticas.Controls.Add(this.IdUltimoLogin);
            this.grpEstatisticas.Controls.Add(this.IdMembroDesde);
            this.grpEstatisticas.Controls.Add(this.IdDinheiro);
            this.grpEstatisticas.Controls.Add(this.IdNotificacoes);
            this.grpEstatisticas.Controls.Add(this.IdProdutos);
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
            this.lblPoupado.Size = new System.Drawing.Size(130, 23);
            this.lblPoupado.TabIndex = 2;
            this.lblPoupado.Text = "Dinheiro poupado:";
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
            this.lblUltimoLogin.Text = "Último login:";
            // 
            // lblLimiteProdutos
            // 
            this.lblLimiteProdutos.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblLimiteProdutos.Location = new System.Drawing.Point(10, 130);
            this.lblLimiteProdutos.Name = "lblLimiteProdutos";
            this.lblLimiteProdutos.Size = new System.Drawing.Size(116, 23);
            this.lblLimiteProdutos.TabIndex = 5;
            this.lblLimiteProdutos.Text = "Limite de produtos:";
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
            // IdNome
            // 
            this.IdNome.AutoSize = true;
            this.IdNome.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdNome.Location = new System.Drawing.Point(52, 26);
            this.IdNome.Name = "IdNome";
            this.IdNome.Size = new System.Drawing.Size(38, 13);
            this.IdNome.TabIndex = 5;
            this.IdNome.Text = "label1";
            // 
            // IdEmail
            // 
            this.IdEmail.AutoSize = true;
            this.IdEmail.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdEmail.Location = new System.Drawing.Point(52, 51);
            this.IdEmail.Name = "IdEmail";
            this.IdEmail.Size = new System.Drawing.Size(38, 13);
            this.IdEmail.TabIndex = 6;
            this.IdEmail.Text = "label2";
            // 
            // IdTelemovel
            // 
            this.IdTelemovel.AutoSize = true;
            this.IdTelemovel.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdTelemovel.Location = new System.Drawing.Point(72, 76);
            this.IdTelemovel.Name = "IdTelemovel";
            this.IdTelemovel.Size = new System.Drawing.Size(38, 13);
            this.IdTelemovel.TabIndex = 7;
            this.IdTelemovel.Text = "label3";
            // 
            // IdPlano
            // 
            this.IdPlano.AutoSize = true;
            this.IdPlano.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdPlano.Location = new System.Drawing.Point(52, 101);
            this.IdPlano.Name = "IdPlano";
            this.IdPlano.Size = new System.Drawing.Size(38, 13);
            this.IdPlano.TabIndex = 8;
            this.IdPlano.Text = "label4";
            // 
            // IdAtivo
            // 
            this.IdAtivo.AutoSize = true;
            this.IdAtivo.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdAtivo.Location = new System.Drawing.Point(238, 101);
            this.IdAtivo.Name = "IdAtivo";
            this.IdAtivo.Size = new System.Drawing.Size(38, 13);
            this.IdAtivo.TabIndex = 9;
            this.IdAtivo.Text = "label5";
            // 
            // IdProdutos
            // 
            this.IdProdutos.AutoSize = true;
            this.IdProdutos.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdProdutos.Location = new System.Drawing.Point(72, 26);
            this.IdProdutos.Name = "IdProdutos";
            this.IdProdutos.Size = new System.Drawing.Size(38, 13);
            this.IdProdutos.TabIndex = 10;
            this.IdProdutos.Text = "label6";
            // 
            // IdNotificacoes
            // 
            this.IdNotificacoes.AutoSize = true;
            this.IdNotificacoes.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdNotificacoes.Location = new System.Drawing.Point(88, 46);
            this.IdNotificacoes.Name = "IdNotificacoes";
            this.IdNotificacoes.Size = new System.Drawing.Size(38, 13);
            this.IdNotificacoes.TabIndex = 11;
            this.IdNotificacoes.Text = "label7";
            // 
            // IdDinheiro
            // 
            this.IdDinheiro.AutoSize = true;
            this.IdDinheiro.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdDinheiro.Location = new System.Drawing.Point(116, 66);
            this.IdDinheiro.Name = "IdDinheiro";
            this.IdDinheiro.Size = new System.Drawing.Size(38, 13);
            this.IdDinheiro.TabIndex = 12;
            this.IdDinheiro.Text = "label8";
            // 
            // IdMembroDesde
            // 
            this.IdMembroDesde.AutoSize = true;
            this.IdMembroDesde.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdMembroDesde.Location = new System.Drawing.Point(102, 91);
            this.IdMembroDesde.Name = "IdMembroDesde";
            this.IdMembroDesde.Size = new System.Drawing.Size(38, 13);
            this.IdMembroDesde.TabIndex = 13;
            this.IdMembroDesde.Text = "label9";
            // 
            // IdUltimoLogin
            // 
            this.IdUltimoLogin.AutoSize = true;
            this.IdUltimoLogin.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdUltimoLogin.Location = new System.Drawing.Point(88, 111);
            this.IdUltimoLogin.Name = "IdUltimoLogin";
            this.IdUltimoLogin.Size = new System.Drawing.Size(44, 13);
            this.IdUltimoLogin.TabIndex = 14;
            this.IdUltimoLogin.Text = "label10";
            // 
            // IdLimitesProdutos
            // 
            this.IdLimitesProdutos.AutoSize = true;
            this.IdLimitesProdutos.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdLimitesProdutos.Location = new System.Drawing.Point(116, 131);
            this.IdLimitesProdutos.Name = "IdLimitesProdutos";
            this.IdLimitesProdutos.Size = new System.Drawing.Size(44, 13);
            this.IdLimitesProdutos.TabIndex = 15;
            this.IdLimitesProdutos.Text = "label11";
            // 
            // IdCanalPreferido
            // 
            this.IdCanalPreferido.AutoSize = true;
            this.IdCanalPreferido.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.IdCanalPreferido.Location = new System.Drawing.Point(102, 151);
            this.IdCanalPreferido.Name = "IdCanalPreferido";
            this.IdCanalPreferido.Size = new System.Drawing.Size(44, 13);
            this.IdCanalPreferido.TabIndex = 16;
            this.IdCanalPreferido.Text = "label12";
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
            this.grpInfo.PerformLayout();
            this.grpEstatisticas.ResumeLayout(false);
            this.grpEstatisticas.PerformLayout();
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
        private System.Windows.Forms.Label IdNome;
        private System.Windows.Forms.Label IdAtivo;
        private System.Windows.Forms.Label IdPlano;
        private System.Windows.Forms.Label IdTelemovel;
        private System.Windows.Forms.Label IdEmail;
        private System.Windows.Forms.Label IdCanalPreferido;
        private System.Windows.Forms.Label IdLimitesProdutos;
        private System.Windows.Forms.Label IdUltimoLogin;
        private System.Windows.Forms.Label IdMembroDesde;
        private System.Windows.Forms.Label IdDinheiro;
        private System.Windows.Forms.Label IdNotificacoes;
        private System.Windows.Forms.Label IdProdutos;
    }
}
