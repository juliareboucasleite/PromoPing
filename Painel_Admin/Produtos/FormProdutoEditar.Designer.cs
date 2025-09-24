namespace Painel_Admin
{
    partial class FormProdutoEditar
    {
        private System.ComponentModel.IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(FormProdutoEditar));
            this.lblNome = new System.Windows.Forms.Label();
            this.txtNome = new System.Windows.Forms.TextBox();
            this.lblLink = new System.Windows.Forms.Label();
            this.txtLink = new System.Windows.Forms.TextBox();
            this.lblPrecoAlvo = new System.Windows.Forms.Label();
            this.txtPrecoAlvo = new System.Windows.Forms.TextBox();
            this.lblDataLimite = new System.Windows.Forms.Label();
            this.dtpDataLimite = new System.Windows.Forms.DateTimePicker();
            this.lblLoja = new System.Windows.Forms.Label();
            this.txtLoja = new System.Windows.Forms.TextBox();
            this.btnSalvar = new System.Windows.Forms.Button();
            this.btnCancelar = new System.Windows.Forms.Button();
            this.SuspendLayout();
            // 
            // lblNome
            // 
            this.lblNome.AutoSize = true;
            this.lblNome.Location = new System.Drawing.Point(20, 20);
            this.lblNome.Name = "lblNome";
            this.lblNome.Size = new System.Drawing.Size(38, 13);
            this.lblNome.TabIndex = 0;
            this.lblNome.Text = "Nome:";
            // 
            // txtNome
            // 
            this.txtNome.Location = new System.Drawing.Point(100, 17);
            this.txtNome.Name = "txtNome";
            this.txtNome.Size = new System.Drawing.Size(250, 20);
            this.txtNome.TabIndex = 1;
            // 
            // lblLink
            // 
            this.lblLink.AutoSize = true;
            this.lblLink.Location = new System.Drawing.Point(20, 60);
            this.lblLink.Name = "lblLink";
            this.lblLink.Size = new System.Drawing.Size(30, 13);
            this.lblLink.TabIndex = 2;
            this.lblLink.Text = "Link:";
            // 
            // txtLink
            // 
            this.txtLink.Location = new System.Drawing.Point(100, 57);
            this.txtLink.Name = "txtLink";
            this.txtLink.Size = new System.Drawing.Size(250, 20);
            this.txtLink.TabIndex = 3;
            // 
            // lblPrecoAlvo
            // 
            this.lblPrecoAlvo.AutoSize = true;
            this.lblPrecoAlvo.Location = new System.Drawing.Point(20, 100);
            this.lblPrecoAlvo.Name = "lblPrecoAlvo";
            this.lblPrecoAlvo.Size = new System.Drawing.Size(62, 13);
            this.lblPrecoAlvo.TabIndex = 4;
            this.lblPrecoAlvo.Text = "Preço Alvo:";
            // 
            // txtPrecoAlvo
            // 
            this.txtPrecoAlvo.Location = new System.Drawing.Point(100, 97);
            this.txtPrecoAlvo.Name = "txtPrecoAlvo";
            this.txtPrecoAlvo.Size = new System.Drawing.Size(100, 20);
            this.txtPrecoAlvo.TabIndex = 5;
            // 
            // lblDataLimite
            // 
            this.lblDataLimite.AutoSize = true;
            this.lblDataLimite.Location = new System.Drawing.Point(20, 140);
            this.lblDataLimite.Name = "lblDataLimite";
            this.lblDataLimite.Size = new System.Drawing.Size(63, 13);
            this.lblDataLimite.TabIndex = 6;
            this.lblDataLimite.Text = "Data Limite:";
            // 
            // dtpDataLimite
            // 
            this.dtpDataLimite.Format = System.Windows.Forms.DateTimePickerFormat.Short;
            this.dtpDataLimite.Location = new System.Drawing.Point(100, 137);
            this.dtpDataLimite.Name = "dtpDataLimite";
            this.dtpDataLimite.Size = new System.Drawing.Size(100, 20);
            this.dtpDataLimite.TabIndex = 7;
            // 
            // lblLoja
            // 
            this.lblLoja.AutoSize = true;
            this.lblLoja.Location = new System.Drawing.Point(20, 180);
            this.lblLoja.Name = "lblLoja";
            this.lblLoja.Size = new System.Drawing.Size(30, 13);
            this.lblLoja.TabIndex = 8;
            this.lblLoja.Text = "Loja:";
            // 
            // txtLoja
            // 
            this.txtLoja.Location = new System.Drawing.Point(100, 177);
            this.txtLoja.Name = "txtLoja";
            this.txtLoja.Size = new System.Drawing.Size(250, 20);
            this.txtLoja.TabIndex = 9;
            // 
            // btnSalvar
            // 
            this.btnSalvar.Location = new System.Drawing.Point(100, 220);
            this.btnSalvar.Name = "btnSalvar";
            this.btnSalvar.Size = new System.Drawing.Size(100, 30);
            this.btnSalvar.TabIndex = 10;
            this.btnSalvar.Text = "Salvar";
            this.btnSalvar.UseVisualStyleBackColor = true;
            this.btnSalvar.Click += new System.EventHandler(this.btnSalvar_Click);
            // 
            // btnCancelar
            // 
            this.btnCancelar.Location = new System.Drawing.Point(250, 220);
            this.btnCancelar.Name = "btnCancelar";
            this.btnCancelar.Size = new System.Drawing.Size(100, 30);
            this.btnCancelar.TabIndex = 11;
            this.btnCancelar.Text = "Cancelar";
            this.btnCancelar.UseVisualStyleBackColor = true;
            this.btnCancelar.Click += new System.EventHandler(this.btnCancelar_Click);
            // 
            // FormProdutoEditar
            // 
            this.ClientSize = new System.Drawing.Size(400, 280);
            this.Controls.Add(this.lblNome);
            this.Controls.Add(this.txtNome);
            this.Controls.Add(this.lblLink);
            this.Controls.Add(this.txtLink);
            this.Controls.Add(this.lblPrecoAlvo);
            this.Controls.Add(this.txtPrecoAlvo);
            this.Controls.Add(this.lblDataLimite);
            this.Controls.Add(this.dtpDataLimite);
            this.Controls.Add(this.lblLoja);
            this.Controls.Add(this.txtLoja);
            this.Controls.Add(this.btnSalvar);
            this.Controls.Add(this.btnCancelar);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog;
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.Name = "FormProdutoEditar";
            this.Text = "Produto";
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Label lblNome;
        private System.Windows.Forms.TextBox txtNome;
        private System.Windows.Forms.Label lblLink;
        private System.Windows.Forms.TextBox txtLink;
        private System.Windows.Forms.Label lblPrecoAlvo;
        private System.Windows.Forms.TextBox txtPrecoAlvo;
        private System.Windows.Forms.Label lblDataLimite;
        private System.Windows.Forms.DateTimePicker dtpDataLimite;
        private System.Windows.Forms.Label lblLoja;
        private System.Windows.Forms.TextBox txtLoja;
        private System.Windows.Forms.Button btnSalvar;
        private System.Windows.Forms.Button btnCancelar;
    }
}
