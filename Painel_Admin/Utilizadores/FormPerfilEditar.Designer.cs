namespace Painel_Admin
{
    partial class FormPerfilEditar
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(FormPerfilEditar));
            this.lblNome = new System.Windows.Forms.Label();
            this.txtNome = new System.Windows.Forms.TextBox();
            this.lblEmail = new System.Windows.Forms.Label();
            this.txtEmail = new System.Windows.Forms.TextBox();
            this.lblTelefone = new System.Windows.Forms.Label();
            this.txtTelefone = new System.Windows.Forms.TextBox();
            this.lblPlano = new System.Windows.Forms.Label();
            this.cmbPlano = new System.Windows.Forms.ComboBox();
            this.lblCanal = new System.Windows.Forms.Label();
            this.cmbCanal = new System.Windows.Forms.ComboBox();
            this.lblNotificacoes = new System.Windows.Forms.Label();
            this.clbNotificacoes = new System.Windows.Forms.CheckedListBox();
            this.chkAtivo = new System.Windows.Forms.CheckBox();
            this.btnSalvar = new System.Windows.Forms.Button();
            this.btnCancelar = new System.Windows.Forms.Button();
            this.SuspendLayout();
            // 
            // lblNome
            // 
            this.lblNome.Location = new System.Drawing.Point(20, 20);
            this.lblNome.Name = "lblNome";
            this.lblNome.Size = new System.Drawing.Size(100, 23);
            this.lblNome.TabIndex = 0;
            this.lblNome.Text = "Nome:";
            // 
            // txtNome
            // 
            this.txtNome.Location = new System.Drawing.Point(120, 17);
            this.txtNome.Name = "txtNome";
            this.txtNome.Size = new System.Drawing.Size(220, 20);
            this.txtNome.TabIndex = 1;
            // 
            // lblEmail
            // 
            this.lblEmail.Location = new System.Drawing.Point(20, 55);
            this.lblEmail.Name = "lblEmail";
            this.lblEmail.Size = new System.Drawing.Size(100, 23);
            this.lblEmail.TabIndex = 2;
            this.lblEmail.Text = "Email:";
            // 
            // txtEmail
            // 
            this.txtEmail.Location = new System.Drawing.Point(120, 52);
            this.txtEmail.Name = "txtEmail";
            this.txtEmail.Size = new System.Drawing.Size(220, 20);
            this.txtEmail.TabIndex = 3;
            // 
            // lblTelefone
            // 
            this.lblTelefone.Location = new System.Drawing.Point(20, 90);
            this.lblTelefone.Name = "lblTelefone";
            this.lblTelefone.Size = new System.Drawing.Size(100, 23);
            this.lblTelefone.TabIndex = 4;
            this.lblTelefone.Text = "Telefone:";
            // 
            // txtTelefone
            // 
            this.txtTelefone.Location = new System.Drawing.Point(120, 87);
            this.txtTelefone.Name = "txtTelefone";
            this.txtTelefone.Size = new System.Drawing.Size(220, 20);
            this.txtTelefone.TabIndex = 5;
            // 
            // lblPlano
            // 
            this.lblPlano.Location = new System.Drawing.Point(20, 125);
            this.lblPlano.Name = "lblPlano";
            this.lblPlano.Size = new System.Drawing.Size(100, 23);
            this.lblPlano.TabIndex = 6;
            this.lblPlano.Text = "Plano:";
            // 
            // cmbPlano
            // 
            this.cmbPlano.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.cmbPlano.Items.AddRange(new object[] {
            "free",
            "premium"});
            this.cmbPlano.Location = new System.Drawing.Point(120, 122);
            this.cmbPlano.Name = "cmbPlano";
            this.cmbPlano.Size = new System.Drawing.Size(220, 21);
            this.cmbPlano.TabIndex = 7;
            // 
            // lblCanal
            // 
            this.lblCanal.Location = new System.Drawing.Point(20, 160);
            this.lblCanal.Name = "lblCanal";
            this.lblCanal.Size = new System.Drawing.Size(100, 23);
            this.lblCanal.TabIndex = 8;
            this.lblCanal.Text = "Canal preferido:";
            // 
            // cmbCanal
            // 
            this.cmbCanal.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.cmbCanal.Items.AddRange(new object[] {
            "email",
            "discord",
            "telegram",
            "whatsapp"});
            this.cmbCanal.Location = new System.Drawing.Point(120, 157);
            this.cmbCanal.Name = "cmbCanal";
            this.cmbCanal.Size = new System.Drawing.Size(220, 21);
            this.cmbCanal.TabIndex = 9;
            // 
            // lblNotificacoes
            // 
            this.lblNotificacoes.Location = new System.Drawing.Point(20, 190);
            this.lblNotificacoes.Name = "lblNotificacoes";
            this.lblNotificacoes.Size = new System.Drawing.Size(100, 23);
            this.lblNotificacoes.TabIndex = 10;
            this.lblNotificacoes.Text = "Notificações:";
            // 
            // clbNotificacoes
            // 
            this.clbNotificacoes.CheckOnClick = true;
            this.clbNotificacoes.Items.AddRange(new object[] {
            "Email",
            "Discord",
            "Telegram",
            "WhatsApp"});
            this.clbNotificacoes.Location = new System.Drawing.Point(120, 190);
            this.clbNotificacoes.Name = "clbNotificacoes";
            this.clbNotificacoes.Size = new System.Drawing.Size(220, 64);
            this.clbNotificacoes.TabIndex = 11;
            // 
            // chkAtivo
            // 
            this.chkAtivo.Location = new System.Drawing.Point(23, 216);
            this.chkAtivo.Name = "chkAtivo";
            this.chkAtivo.Size = new System.Drawing.Size(104, 24);
            this.chkAtivo.TabIndex = 12;
            this.chkAtivo.Text = "Ativo";
            // 
            // btnSalvar
            // 
            this.btnSalvar.Location = new System.Drawing.Point(120, 269);
            this.btnSalvar.Name = "btnSalvar";
            this.btnSalvar.Size = new System.Drawing.Size(75, 23);
            this.btnSalvar.TabIndex = 13;
            this.btnSalvar.Text = "Salvar";
            this.btnSalvar.Click += new System.EventHandler(this.btnSalvar_Click);
            // 
            // btnCancelar
            // 
            this.btnCancelar.Location = new System.Drawing.Point(265, 269);
            this.btnCancelar.Name = "btnCancelar";
            this.btnCancelar.Size = new System.Drawing.Size(75, 23);
            this.btnCancelar.TabIndex = 14;
            this.btnCancelar.Text = "Cancelar";
            this.btnCancelar.Click += new System.EventHandler(this.btnCancelar_Click);
            // 
            // FormPerfilEditar
            // 
            this.ClientSize = new System.Drawing.Size(380, 314);
            this.Controls.Add(this.lblNome);
            this.Controls.Add(this.txtNome);
            this.Controls.Add(this.lblEmail);
            this.Controls.Add(this.txtEmail);
            this.Controls.Add(this.lblTelefone);
            this.Controls.Add(this.txtTelefone);
            this.Controls.Add(this.lblPlano);
            this.Controls.Add(this.cmbPlano);
            this.Controls.Add(this.lblCanal);
            this.Controls.Add(this.cmbCanal);
            this.Controls.Add(this.lblNotificacoes);
            this.Controls.Add(this.clbNotificacoes);
            this.Controls.Add(this.chkAtivo);
            this.Controls.Add(this.btnSalvar);
            this.Controls.Add(this.btnCancelar);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.Name = "FormPerfilEditar";
            this.Text = "Editar Perfil";
            this.Load += new System.EventHandler(this.FormPerfilEditar_Load);
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Label lblNome;
        private System.Windows.Forms.TextBox txtNome;
        private System.Windows.Forms.Label lblEmail;
        private System.Windows.Forms.TextBox txtEmail;
        private System.Windows.Forms.Label lblTelefone;
        private System.Windows.Forms.TextBox txtTelefone;
        private System.Windows.Forms.Label lblPlano;
        private System.Windows.Forms.ComboBox cmbPlano;
        private System.Windows.Forms.Label lblCanal;
        private System.Windows.Forms.ComboBox cmbCanal;
        private System.Windows.Forms.Label lblNotificacoes;
        private System.Windows.Forms.CheckedListBox clbNotificacoes;
        private System.Windows.Forms.CheckBox chkAtivo;
        private System.Windows.Forms.Button btnSalvar;
        private System.Windows.Forms.Button btnCancelar;
    }
}
